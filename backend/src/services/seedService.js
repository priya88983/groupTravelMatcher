import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import * as travellerRepo from '../repositories/travellerRepository.js';
import * as groupRepo from '../repositories/groupRepository.js';

const here = dirname(fileURLToPath(import.meta.url));
const BCRYPT_ROUNDS = 10;

function loadJson(relativePath) {
  return JSON.parse(readFileSync(resolve(here, relativePath), 'utf8'));
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
}

export function demoEmailFor(name) {
  return `${slugify(name)}@example.com`;
}

function mapFields(fields) {
  return {
    name: fields.name,
    age: fields.age,
    gender: fields.gender,
    homeCity: fields.home_city,
    homeAirport: fields.home_airport,
    genderPreference: fields.gender_preference,
  };
}

// Idempotent: skips accounts/profiles that already exist, never overwrites
// existing passwords or profile edits. Inserts use their original traveller_id.
export async function seedTravellers(password) {
  const travellers = loadJson('../../../data/problem-3/travellers.json');
  let createdUsers = 0;
  let existingUsers = 0;

  for (const traveller of travellers) {
    const email = demoEmailFor(traveller.name);
    if (userRepo.findByEmail(email)) {
      existingUsers += 1;
      continue;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = userRepo.create({ email, passwordHash });
    travellerRepo.createProfile({
      travellerId: traveller.traveller_id,
      userId,
      fields: mapFields(traveller),
      interests: traveller.interests,
    });
    createdUsers += 1;
  }

  return { createdUsers, existingUsers };
}

export function seedGroups() {
  const groups = loadJson('../../../data/problem-3/groups.json');

  for (const group of groups) {
    groupRepo.createGroup({
      group_id: group.group_id,
      name: group.name,
      owner_id: group.owner_id,
      city: group.city,
      check_in: group.check_in,
      check_out: group.check_out,
      max_size: group.max_size,
      budget_inr: group.budget_inr,
      itinerary: group.itinerary,
    });

    groupRepo.addMember(group.group_id, group.owner_id, 'owner');
    for (const memberId of group.member_ids) {
      groupRepo.addMember(group.group_id, memberId, 'member');
    }
  }

  return { groups: groupRepo.countGroups(), members: groupRepo.countMembers() };
}

export async function seedAll(password) {
  const travellers = await seedTravellers(password);
  const groups = seedGroups();
  return { travellers, groups };
}
