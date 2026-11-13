import * as groupRepo from '../repositories/groupRepository.js';
import * as travellerRepo from '../repositories/travellerRepository.js';
import * as hotelRepo from '../repositories/hotelRepository.js';
import * as catalog from '../data/hotelCatalog.js';
import * as pricing from './hotelPricingService.js';
import { notFound, forbidden, badRequest, conflict } from '../utils/httpError.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function listMembersWithDates(groupId) {
  const members = groupRepo.listMembers(groupId);
  const group = groupRepo.findById(groupId);
  return members.map((m) => ({
    ...m,
    // Members whose committed dates were not recorded default to the group's
    // trip window (e.g. seeded groups and the creator).
    check_in: m.check_in || group.check_in,
    check_out: m.check_out || group.check_out,
  }));
}

function requireMemberOrOwner(group, traveller) {
  if (!group) throw notFound('GROUP_NOT_FOUND', 'Group not found.');
  if (group.owner_id === traveller.traveller_id) return;
  if (groupRepo.findMember(group.group_id, traveller.traveller_id)) return;
  throw forbidden('FORBIDDEN', 'Only approved members and the group creator can access hotel planning.');
}

function requireOwner(group, traveller) {
  if (!group) throw notFound('GROUP_NOT_FOUND', 'Group not found.');
  if (group.owner_id !== traveller.traveller_id) {
    throw forbidden('FORBIDDEN', 'Only the group creator can manage hotel selections.');
  }
}

function validateRange(checkIn, checkOut, group) {
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    throw badRequest('INVALID_DATES', 'Check-in and check-out must be valid dates (YYYY-MM-DD).');
  }
  if (checkOut <= checkIn) {
    throw badRequest('INVALID_DATES', 'Check-out must be after check-in.');
  }
  if (checkIn < group.check_in || checkOut > group.check_out) {
    throw badRequest('OUTSIDE_TRIP', 'Hotel dates must be within the group trip window.');
  }
  return { checkIn, checkOut };
}

function ensureNoOverlap(groupId, checkIn, checkOut, excludeId = null) {
  const existing = hotelRepo.listByGroup(groupId);
  const overlapping = existing.some((s) => {
    if (excludeId && s.id === excludeId) return false;
    // Half-open intervals [a,b) and [c,d) overlap iff a < d && c < b.
    return s.check_in < checkOut && checkIn < s.check_out;
  });
  if (overlapping) {
    throw conflict('OVERLAPPING_SELECTION', 'This date range overlaps an existing hotel selection.');
  }
}

function validateCandidate(room, checkIn, checkOut, members, group) {
  const roomPrice = catalog.roomPriceInr(room);
  const capacity = catalog.roomCapacity(room);
  if (!roomPrice) {
    throw badRequest('INVALID_ROOM', 'Selected room has no price in the catalog.');
  }
  const nights = pricing.nightsBetween(checkIn, checkOut);
  if (nights.length === 0) {
    throw badRequest('INVALID_DATES', 'Selection covers no nights.');
  }

  // Every night: enough rooms for active members AND enough inventory.
  for (const night of nights) {
    const activeCount = pricing.activeMembersOnNight(members, night).length;
    const rooms = pricing.roomsNeeded(activeCount, capacity);
    const available = catalog.getAvailability(room.room_id, night);
    if (rooms > available) {
      throw conflict('UNAVAILABLE', `Not enough availability on ${night}.`);
    }
    if (activeCount > capacity * rooms) {
      throw conflict('CAPACITY', 'Selected room cannot accommodate the active members.');
    }
  }
  return { roomPrice, capacity };
}

export function listHotelOptions(groupId, userId, query = {}) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  const group = groupRepo.findById(groupId);
  requireMemberOrOwner(group, traveller);

  const checkIn = query.check_in || group.check_in;
  const checkOut = query.check_out || group.check_out;
  validateRange(checkIn, checkOut, group);

  const members = listMembersWithDates(groupId);
  const hotels = catalog.getHotelsByCity(group.city);
  const options = [];

  for (const hotel of hotels) {
    const rooms = catalog.getRoomsForHotel(hotel.hotel_id);
    for (const room of rooms) {
      const roomPrice = catalog.roomPriceInr(room);
      if (!roomPrice) continue;
      const capacity = catalog.roomCapacity(room);
      const nights = pricing.nightsBetween(checkIn, checkOut);
      let skip = false;
      let maxRooms = 0;
      let minPerPerson = Infinity;
      let maxPerPerson = 0;
      for (const night of nights) {
        const activeCount = pricing.activeMembersOnNight(members, night).length;
        const rooms = pricing.roomsNeeded(activeCount, capacity);
        maxRooms = Math.max(maxRooms, rooms);
        const available = catalog.getAvailability(room.room_id, night);
        if (rooms > available) {
          skip = true;
          break;
        }
        if (rooms > 0) {
          const perPerson = roomPrice * rooms / activeCount;
          minPerPerson = Math.min(minPerPerson, perPerson);
          maxPerPerson = Math.max(maxPerPerson, perPerson);
        }
      }
      if (skip) continue;
      const total = maxRooms * roomPrice * nights.length;
      options.push({
        hotel_id: hotel.hotel_id,
        hotel_name: hotel.name,
        city: hotel.city,
        image: hotel.image || null,
        rating: hotel.rating,
        room_id: room.room_id,
        room_type: room.room_type,
        room_name: room.name,
        capacity,
        price_per_night: roomPrice,
        currency: 'INR',
        rooms_needed: maxRooms,
        total_estimated: total,
        per_person_min: minPerPerson === Infinity ? 0 : Math.round(minPerPerson * 100) / 100,
        per_person_max: Math.round(maxPerPerson * 100) / 100,
        available: true,
      });
    }
  }

  return { group_id: groupId, check_in: checkIn, check_out: checkOut, options };
}

export function getHotelPlan(groupId, userId) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  const group = groupRepo.findById(groupId);
  requireMemberOrOwner(group, traveller);

  const members = listMembersWithDates(groupId);
  const selections = hotelRepo.listByGroup(groupId).map((s) => {
    const hotel = catalog.getHotelById(s.hotel_id);
    const room = catalog.getRoomById(s.room_id);
    const breakdown = pricing.buildSelectionBreakdown(s, members);
    return {
      ...s,
      hotel_name: hotel ? hotel.name : null,
      hotel_image: hotel ? hotel.image : null,
      hotel_city: hotel ? hotel.city : null,
      room_name: room ? room.name : null,
      room_type: room ? room.room_type : null,
      breakdown,
    };
  });

  const totalAccommodation = selections.reduce((sum, s) => sum + s.breakdown.totalCost, 0);

  // Per-member totals across all selections.
  const memberTotals = {};
  for (const member of members) memberTotals[member.traveller_id] = 0;
  for (const s of selections) {
    for (const [id, amount] of Object.entries(s.breakdown.memberTotals)) {
      memberTotals[id] = (memberTotals[id] || 0) + amount;
    }
  }

  return {
    group_id: groupId,
    total_accommodation: totalAccommodation,
    selections,
    member_totals: memberTotals,
    members,
  };
}

export function saveSelection(groupId, userId, body = {}) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  const group = groupRepo.findById(groupId);
  requireOwner(group, traveller);

  const { checkIn, checkOut } = validateRange(body.check_in, body.check_out, group);

  const room = catalog.getRoomById(body.room_id);
  if (!room) throw badRequest('INVALID_ROOM', 'Selected room does not exist in the catalog.');
  if (catalog.getHotelById(room.hotel_id)?.city !== group.city) {
    throw badRequest('INVALID_ROOM', 'Selected hotel is not in the group destination.');
  }

  ensureNoOverlap(groupId, checkIn, checkOut);
  const members = listMembersWithDates(groupId);
  const { roomPrice, capacity } = validateCandidate(room, checkIn, checkOut, members, group);

  const selection = hotelRepo.createSelection({
    groupId,
    hotelId: room.hotel_id,
    roomId: room.room_id,
    checkIn,
    checkOut,
    roomsCount: 0,
    pricePerNight: roomPrice,
    roomCapacity: capacity,
    createdBy: traveller.traveller_id,
  });

  return getHotelPlan(groupId, userId);
}

export function updateSelection(groupId, userId, selectionId, body = {}) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  const group = groupRepo.findById(groupId);
  requireOwner(group, traveller);

  const existing = hotelRepo.findById(Number(selectionId));
  if (!existing || existing.group_id !== groupId) {
    throw notFound('SELECTION_NOT_FOUND', 'Hotel selection not found.');
  }

  const checkIn = body.check_in || existing.check_in;
  const checkOut = body.check_out || existing.check_out;
  validateRange(checkIn, checkOut, group);

  const roomId = body.room_id || existing.room_id;
  const room = catalog.getRoomById(roomId);
  if (!room) throw badRequest('INVALID_ROOM', 'Selected room does not exist in the catalog.');
  if (catalog.getHotelById(room.hotel_id)?.city !== group.city) {
    throw badRequest('INVALID_ROOM', 'Selected hotel is not in the group destination.');
  }

  ensureNoOverlap(groupId, checkIn, checkOut, existing.id);
  const members = listMembersWithDates(groupId);
  const { roomPrice, capacity } = validateCandidate(room, checkIn, checkOut, members, group);

  hotelRepo.updateSelection(existing.id, {
    hotelId: room.hotel_id,
    roomId: room.room_id,
    checkIn,
    checkOut,
    roomsCount: 0,
    pricePerNight: roomPrice,
    roomCapacity: capacity,
  });

  return getHotelPlan(groupId, userId);
}

export function deleteSelection(groupId, userId, selectionId) {
  const traveller = travellerRepo.findByUserId(userId);
  if (!traveller) throw notFound('PROFILE_NOT_FOUND', 'Profile not found.');
  const group = groupRepo.findById(groupId);
  requireOwner(group, traveller);

  const existing = hotelRepo.findById(Number(selectionId));
  if (!existing || existing.group_id !== groupId) {
    throw notFound('SELECTION_NOT_FOUND', 'Hotel selection not found.');
  }
  hotelRepo.deleteSelection(existing.id);
  return getHotelPlan(groupId, userId);
}
