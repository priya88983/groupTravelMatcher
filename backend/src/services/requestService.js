import db from '../config/database.js';
import * as groupRepo from '../repositories/groupRepository.js';
import * as travellerRepo from '../repositories/travellerRepository.js';
import * as requestRepo from '../repositories/requestRepository.js';
import * as matchingService from './matchingService.js';
import { notFound, forbidden, conflict, badRequest } from '../utils/httpError.js';
import { isNonEmptyString } from '../middleware/validate.js';

export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// Build the seeker-side search used for a request, defaulting date/budget
// fields to the group's own values when the seeker did not provide a search.
function buildSeekerForRequest(group, owner, traveller, body = {}) {
  const interests = Array.isArray(body.interests) && body.interests.length
    ? body.interests
    : traveller.interests;
  return {
    destination: isNonEmptyString(body.destination) ? body.destination.trim() : group.city,
    check_in: isNonEmptyString(body.check_in) ? body.check_in : group.check_in,
    check_out: isNonEmptyString(body.check_out) ? body.check_out : group.check_out,
    budget_inr: Number.isInteger(body.budget_inr) ? body.budget_inr : group.budget_inr,
    interests,
    gender: traveller.gender,
    gender_preference: traveller.gender_preference,
    traveller_id: traveller.traveller_id,
  };
}

function withInterests(traveller) {
  if (!traveller) return traveller;
  return {
    ...traveller,
    interests: travellerRepo.findInterests(traveller.traveller_id),
  };
}

export function sendRequest(groupId, userId, body) {
  const traveller = withInterests(travellerRepo.findByUserId(userId));
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Complete your traveller profile before joining a group.');
  }

  const group = groupRepo.findById(groupId);
  if (!group) {
    throw notFound('GROUP_NOT_FOUND', 'Group not found.');
  }

  if (group.owner_id === traveller.traveller_id) {
    throw badRequest('OWN_GROUP', 'You cannot request to join your own group.');
  }

  if (groupRepo.findMember(groupId, traveller.traveller_id)) {
    throw conflict('ALREADY_MEMBER', 'You are already a member of this group.');
  }

  const existing = requestRepo.findByGroupAndTraveller(groupId, traveller.traveller_id);
  if (existing) {
    throw conflict('REQUEST_EXISTS', `You already have a ${existing.status.toLowerCase()} request for this group.`);
  }

  if (groupRepo.memberCount(groupId) >= Number(group.max_size)) {
    throw conflict('GROUP_FULL', 'This group is full.');
  }

  const owner = withInterests(travellerRepo.findById(group.owner_id));
  if (!owner) {
    throw notFound('OWNER_NOT_FOUND', 'Group owner not found.');
  }

  const seeker = buildSeekerForRequest(group, owner, traveller, body);
  const decorated = { ...group, member_count: groupRepo.memberCount(groupId) };
  const eligibility = matchingService.isEligible(decorated, owner, seeker);
  if (!eligibility.eligible) {
    throw conflict('NOT_ELIGIBLE', 'This group does not currently match your profile and search criteria.');
  }

  const id = requestRepo.createRequest({
    groupId,
    travellerId: traveller.traveller_id,
    status: REQUEST_STATUS.PENDING,
    destination: seeker.destination,
    checkIn: seeker.check_in,
    checkOut: seeker.check_out,
    budgetInr: seeker.budget_inr,
    interests: seeker.interests,
  });
  return requestRepo.findById(id);
}

export function listForGroup(groupId, userId) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  }
  const group = groupRepo.findById(groupId);
  if (!group) {
    throw notFound('GROUP_NOT_FOUND', 'Group not found.');
  }
  if (group.owner_id !== traveller.traveller_id) {
    throw forbidden('FORBIDDEN', 'Only the group owner can view requests.');
  }
  const rows = requestRepo.listByGroup(groupId);
  return rows.map((row) => ({
    ...row,
    interests: row.interests ? JSON.parse(row.interests) : null,
    budget_inr: row.budget_inr != null ? Number(row.budget_inr) : null,
  }));
}

export function profileRequests(userId) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  }
  const decorate = (row) => ({
    ...row,
    interests: row.interests ? JSON.parse(row.interests) : null,
    budget_inr: row.budget_inr != null ? Number(row.budget_inr) : null,
    group_budget_inr: row.group_budget_inr != null ? Number(row.group_budget_inr) : null,
    member_count: Number(row.member_count),
  });
  return {
    received: requestRepo.listReceivedByOwner(traveller.traveller_id).map(decorate),
    sent: requestRepo.listSentByTraveller(traveller.traveller_id).map(decorate),
  };
}

export function decideRequest(requestId, userId, action) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  }
  const request = requestRepo.findById(requestId);
  if (!request) {
    throw notFound('REQUEST_NOT_FOUND', 'Request not found.');
  }
  const group = groupRepo.findById(request.group_id);
  if (!group) {
    throw notFound('GROUP_NOT_FOUND', 'Group not found.');
  }
  if (group.owner_id !== traveller.traveller_id) {
    throw forbidden('FORBIDDEN', 'Only the group owner can decide requests.');
  }
  if (request.status !== REQUEST_STATUS.PENDING) {
    throw conflict('ALREADY_DECIDED', `This request was already ${request.status.toLowerCase()}.`);
  }

  if (action === 'approve') {
    const owner = withInterests(travellerRepo.findById(group.owner_id));
    const seeker = withInterests(travellerRepo.findById(request.traveller_id));
    if (!owner || !seeker) {
      throw notFound('TRAVELLER_NOT_FOUND', 'Related traveller not found.');
    }

    // Capacity is checked before the remaining compatibility rules so that a
    // full group always surfaces as GROUP_FULL rather than NOT_ELIGIBLE.
    if (groupRepo.memberCount(group.group_id) >= Number(group.max_size)) {
      throw conflict('GROUP_FULL', 'This group is full; the request cannot be approved.');
    }

    const seekerSearch = {
      destination: request.destination || group.city,
      check_in: request.check_in || group.check_in,
      check_out: request.check_out || group.check_out,
      budget_inr: request.budget_inr != null ? request.budget_inr : group.budget_inr,
      interests: seeker.interests,
      gender: seeker.gender,
      gender_preference: seeker.gender_preference,
      traveller_id: seeker.traveller_id,
    };
    const eligibility = matchingService.isEligible(
      { ...group, member_count: groupRepo.memberCount(group.group_id) },
      owner,
      seekerSearch,
    );
    if (!eligibility.eligible) {
      throw conflict('NOT_ELIGIBLE', 'This request no longer matches the group criteria.');
    }

    const tx = db.transaction(() => {
      if (groupRepo.memberCount(group.group_id) >= Number(group.max_size)) {
        throw conflict('GROUP_FULL', 'This group is full; the request cannot be approved.');
      }
      groupRepo.addMember(
        group.group_id,
        seeker.traveller_id,
        'member',
        request.check_in || group.check_in,
        request.check_out || group.check_out,
      );
      requestRepo.updateStatus(requestId, REQUEST_STATUS.APPROVED);
    });
    tx();
  } else if (action === 'reject') {
    requestRepo.updateStatus(requestId, REQUEST_STATUS.REJECTED);
  } else {
    throw badRequest('INVALID_ACTION', 'Action must be "approve" or "reject".');
  }

  const updated = requestRepo.findById(requestId);
  return {
    ...updated,
    interests: updated.interests ? JSON.parse(updated.interests) : null,
    budget_inr: updated.budget_inr != null ? Number(updated.budget_inr) : null,
  };
}
