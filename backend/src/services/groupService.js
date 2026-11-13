import * as groupRepo from '../repositories/groupRepository.js';
import * as travellerRepo from '../repositories/travellerRepository.js';
import * as requestRepo from '../repositories/requestRepository.js';
import * as matchingService from './matchingService.js';
import { isValidDestinationCity, DATA_WINDOW } from '../data/destinationsCatalog.js';
import { isValidInterest } from '../data/interestsCatalog.js';
import { HttpError, notFound, badRequest } from '../utils/httpError.js';
import { isNonEmptyString, isIntegerInRange } from '../middleware/validate.js';

export const GROUP_STATUS = {
  OPEN: 'OPEN',
  FULL: 'FULL',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function inDataWindow(value) {
  return value >= DATA_WINDOW.firstNight && value <= DATA_WINDOW.lastDeparture;
}

function decorateGroup(group) {
  if (!group) return null;
  const memberCount = Number(group.member_count);
  const maxSize = Number(group.max_size);
  const availableSpots = Math.max(0, maxSize - memberCount);
  return {
    ...group,
    member_count: memberCount,
    max_size: maxSize,
    budget_inr: Number(group.budget_inr),
    available_spots: availableSpots,
    status: availableSpots > 0 ? GROUP_STATUS.OPEN : GROUP_STATUS.FULL,
  };
}

function validateInterestList(interests) {
  if (!Array.isArray(interests)) {
    throw badRequest('INVALID_INTERESTS', 'Interests must be a list.');
  }
  for (const interest of interests) {
    if (!isValidInterest(interest)) {
      throw badRequest('INVALID_INTERESTS', `Unknown interest: ${interest}`);
    }
  }
  return [...new Set(interests)];
}

function validateDates(checkIn, checkOut, { groupContext = false } = {}) {
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    throw badRequest('INVALID_DATES', 'Check-in and check-out must be valid dates (YYYY-MM-DD).');
  }
  if (!inDataWindow(checkIn) || !inDataWindow(checkOut)) {
    throw badRequest('INVALID_DATES', 'Dates must be between 1 and 20 April 2027.');
  }
  if (checkOut <= checkIn) {
    throw badRequest('INVALID_DATES', 'Check-out must be after check-in.');
  }
  const _ = groupContext;
  return { checkIn, checkOut };
}

export function validateCreateGroup(input) {
  if (!input || typeof input !== 'object') {
    throw badRequest('INVALID_GROUP', 'Group data is required.');
  }
  const name = isNonEmptyString(input.name) ? input.name.trim() : '';
  if (!name) {
    throw badRequest('INVALID_GROUP', 'Group name is required.');
  }
  const city = isNonEmptyString(input.city) ? input.city.trim() : '';
  if (!isValidDestinationCity(city)) {
    throw badRequest('INVALID_DESTINATION', 'Destination must be one of the supported cities.');
  }
  const { checkIn, checkOut } = validateDates(input.check_in, input.check_out, { groupContext: true });
  const maxSize = input.max_size;
  if (!isIntegerInRange(maxSize, 1, 4)) {
    throw badRequest('INVALID_GROUP_SIZE', 'Maximum group size must be an integer between 1 and 4.');
  }
  const budgetInr = input.budget_inr;
  if (!Number.isInteger(budgetInr) || budgetInr <= 0) {
    throw badRequest('INVALID_BUDGET', 'Budget must be a positive whole number in INR.');
  }
  const itinerary = input.itinerary !== undefined && input.itinerary !== null
    ? String(input.itinerary).trim()
    : '';
  return { name, city, checkIn, checkOut, maxSize, budgetInr, itinerary };
}

export function createGroup(userId, input) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Complete your traveller profile before creating a group.');
  }
  const fields = validateCreateGroup(input);
  const groupId = groupRepo.nextGroupId();
  const group = groupRepo.createGroupWithOwner(
    {
      group_id: groupId,
      name: fields.name,
      city: fields.city,
      check_in: fields.checkIn,
      check_out: fields.checkOut,
      max_size: fields.maxSize,
      budget_inr: fields.budgetInr,
      itinerary: fields.itinerary,
      owner_id: traveller.traveller_id,
    },
    traveller.traveller_id,
  );
  return decorateGroup(group);
}

export function listGroups(filters = {}) {
  const city = typeof filters.city === 'string' && filters.city.trim() ? filters.city.trim() : null;
  const limit = Number.isInteger(Number(filters.limit)) && Number(filters.limit) > 0
    ? Number(filters.limit)
    : null;
  const offset = Number.isInteger(Number(filters.offset)) && Number(filters.offset) >= 0
    ? Number(filters.offset)
    : null;
  const rows = groupRepo.findAllGroups({ city, limit, offset });
  const total = groupRepo.countAllGroups({ city });
  return { groups: rows.map(decorateGroup), total };
}

export function getGroup(groupId, userId = null) {
  const group = groupRepo.findById(groupId);
  if (!group) {
    throw notFound('GROUP_NOT_FOUND', 'Group not found.');
  }
  const members = groupRepo.listMembers(groupId);
  const traveller = userId ? travellerRepo.findByUserId(userId) : null;

  let viewerRole = null; // OWNER | MEMBER | REQUESTER | OTHER
  let requesterStatus = null;
  if (traveller) {
    if (traveller.traveller_id === group.owner_id) {
      viewerRole = 'OWNER';
    } else if (groupRepo.findMember(groupId, traveller.traveller_id)) {
      viewerRole = 'MEMBER';
    } else {
      const request = requestRepo.findByGroupAndTraveller(groupId, traveller.traveller_id);
      if (request) {
        viewerRole = 'REQUESTER';
        requesterStatus = request.status;
      } else {
        viewerRole = 'OTHER';
      }
    }
  }

  return {
    ...decorateGroup(group),
    owner: {
      traveller_id: group.owner_id,
      name: group.owner_name,
      interests: travellerRepo.findInterests(group.owner_id),
    },
    members,
    viewer_role: viewerRole,
    requester_status: requesterStatus,
  };
}

export function searchGroups(userId, searchInput) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Complete your traveller profile before searching.');
  }

  if (!searchInput || typeof searchInput !== 'object') {
    throw badRequest('INVALID_SEARCH', 'Search data is required.');
  }
  const destination = isNonEmptyString(searchInput.destination) ? searchInput.destination.trim() : '';
  if (!isValidDestinationCity(destination)) {
    throw badRequest('INVALID_DESTINATION', 'Destination must be one of the supported cities.');
  }
  const { checkIn, checkOut } = validateDates(searchInput.check_in, searchInput.check_out);
  const budgetInr = searchInput.budget_inr;
  if (!Number.isInteger(budgetInr) || budgetInr <= 0) {
    throw badRequest('INVALID_BUDGET', 'Budget must be a positive whole number in INR.');
  }
  const interests = validateInterestList(searchInput.interests);

  const seeker = {
    destination,
    check_in: checkIn,
    check_out: checkOut,
    budget_inr: budgetInr,
    interests,
    gender: traveller.gender,
    gender_preference: traveller.gender_preference,
    traveller_id: traveller.traveller_id,
  };

  const allGroups = groupRepo.findAllGroups({});
  const candidates = [];

  for (const group of allGroups) {
    // Exclude the seeker's own groups and groups they already joined.
    if (group.owner_id === traveller.traveller_id) continue;
    if (groupRepo.findMember(group.group_id, traveller.traveller_id)) continue;

    const decorated = decorateGroup(group);
    const owner = travellerRepo.findById(group.owner_id);
    if (!owner) continue;

    const ownerWithInterests = {
      ...owner,
      interests: travellerRepo.findInterests(owner.traveller_id),
    };
    const eligibility = matchingService.isEligible(decorated, ownerWithInterests, seeker);
    if (!eligibility.eligible) continue;

    candidates.push({
      group: decorated,
      owner: {
        traveller_id: owner.traveller_id,
        name: owner.name,
        interests: travellerRepo.findInterests(owner.traveller_id),
      },
      seeker,
      eligibility,
    });
  }

  return matchingService.rankMatches(candidates);
}

export function myGroups(userId) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) {
    throw notFound('PROFILE_NOT_FOUND', 'Complete your traveller profile first.');
  }
  const owned = groupRepo.listGroupsOwnedBy(traveller.traveller_id);
  const joined = groupRepo.listGroupsWhereMember(traveller.traveller_id);

  const seen = new Set();
  const result = [];
  for (const group of [...owned, ...joined]) {
    if (seen.has(group.group_id)) continue;
    seen.add(group.group_id);
    const decorated = decorateGroup(group);
    result.push({
      ...decorated,
      role: group.owner_id === traveller.traveller_id ? 'CREATOR' : 'MEMBER',
    });
  }
  return result;
}

export { HttpError };
