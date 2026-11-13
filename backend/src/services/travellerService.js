import * as travellerRepo from '../repositories/travellerRepository.js';
import { HttpError } from '../utils/httpError.js';
import { isNonEmptyString, isIntegerInRange } from '../middleware/validate.js';
import { isValidInterest } from '../data/interestsCatalog.js';

const GENDERS = new Set(['MALE', 'FEMALE', 'OTHER']);
const GENDER_PREFERENCES = new Set(['SAME_GENDER', 'OPPOSITE_GENDER', 'ANY']);

function pickFields(input) {
  return {
    name: String(input.name).trim(),
    age: input.age,
    gender: input.gender,
    homeCity: String(input.home_city).trim(),
    homeAirport: String(input.home_airport).trim().toUpperCase(),
    genderPreference: input.gender_preference,
  };
}

function validateInterests(interests) {
  if (!Array.isArray(interests) || interests.length === 0) {
    throw new HttpError(400, 'INVALID_INTERESTS', 'Select at least one interest.');
  }
  const seen = new Set();
  for (const interest of interests) {
    if (!isValidInterest(interest)) {
      throw new HttpError(400, 'INVALID_INTERESTS', `Unknown interest: ${interest}`);
    }
    if (seen.has(interest)) {
      throw new HttpError(400, 'INVALID_INTERESTS', 'Duplicate interests are not allowed.');
    }
    seen.add(interest);
  }
  return [...seen];
}

export function validateProfile(input) {
  if (!input || typeof input !== 'object') {
    throw new HttpError(400, 'INVALID_PROFILE', 'Profile data is required.');
  }
  if (!isNonEmptyString(input.name)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Name is required.');
  }
  if (!isIntegerInRange(input.age, 18, 120)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Age must be a whole number between 18 and 120.');
  }
  if (!GENDERS.has(input.gender)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Invalid gender.');
  }
  if (!isNonEmptyString(input.home_city)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Home city is required.');
  }
  if (!isNonEmptyString(input.home_airport)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Home airport is required.');
  }
  if (!GENDER_PREFERENCES.has(input.gender_preference)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Invalid gender preference.');
  }
  const interests = validateInterests(input.interests);
  return { fields: pickFields(input), interests };
}

export function getOwnProfile(userId) {
  const row = travellerRepo.findByUserId(userId);
  if (!row) return null;
  const { user_id: _userId, ...profile } = row;
  return { ...profile, interests: travellerRepo.findInterests(row.traveller_id) };
}

export function upsertProfile(userId, input) {
  const { fields, interests } = validateProfile(input);
  const existing = travellerRepo.findByUserId(userId);

  if (existing) {
    return travellerRepo.updateProfile({ travellerId: existing.traveller_id, fields, interests });
  }

  const travellerId = travellerRepo.nextTravellerId();
  return travellerRepo.createProfile({ travellerId, userId, fields, interests });
}
