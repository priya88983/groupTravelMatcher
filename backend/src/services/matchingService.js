// Pure, independently testable matching logic. No database access.

const DAY_MS = 86400000;

// Parse an ISO date (YYYY-MM-DD) into a UTC day number, so day arithmetic is
// timezone-independent.
function toDays(iso) {
  return Math.round(new Date(`${iso}T00:00:00Z`).getTime() / DAY_MS);
}

// Number of shared nights between two stays. A stay from checkIn to checkOut
// covers the nights [checkIn, checkOut). Shared nights = overlap of the two
// half-open intervals.
export function overlapNights(checkInA, checkOutA, checkInB, checkOutB) {
  const start = Math.max(toDays(checkInA), toDays(checkInB));
  const end = Math.min(toDays(checkOutA), toDays(checkOutB));
  return Math.max(0, end - start);
}

// Budget difference is at most 40% of the lower budget.
export function budgetsCompatible(budgetA, budgetB) {
  if (!Number.isFinite(budgetA) || !Number.isFinite(budgetB)) return false;
  if (budgetA < 0 || budgetB < 0) return false;
  const lower = Math.min(budgetA, budgetB);
  return Math.abs(budgetA - budgetB) <= 0.4 * lower;
}

// Does the traveller (myGender, myPreference) accept someone of otherGender?
export function genderAllows(myPreference, myGender, otherGender) {
  switch (myPreference) {
    case 'ANY':
      return true;
    case 'SAME_GENDER':
      return otherGender === myGender;
    case 'OPPOSITE_GENDER':
      return otherGender !== myGender;
    default:
      return false;
  }
}

// Mutual gender compatibility: the seeker's preference must allow the owner's
// gender AND the owner's preference must allow the seeker's gender.
export function gendersCompatible(seekerGender, seekerPreference, ownerGender, ownerPreference) {
  return (
    genderAllows(seekerPreference, seekerGender, ownerGender) &&
    genderAllows(ownerPreference, ownerGender, seekerGender)
  );
}

export function sharedInterests(listA = [], listB = []) {
  const setB = new Set(listB);
  return listA.filter((item) => setB.has(item)).length;
}

function joinFails(codes, code) {
  if (!codes.includes(code)) codes.push(code);
}

// Evaluate the six mandatory rules for a group vs a seeker search.
// `group` must include city, check_in, check_out, budget_inr, max_size,
// member_count. `owner` must include gender, gender_preference, interests.
// `seeker` is the search: destination/city, check_in, check_out, budget_inr,
// interests, gender, gender_preference.
export function isEligible(group, owner, seeker) {
  const failed = [];
  const explanations = [];

  // 1. Same destination.
  if (group.city !== seeker.destination) {
    joinFails(failed, 'DESTINATION_MISMATCH');
  }

  // 2. At least 2 overlapping nights.
  const nights = overlapNights(group.check_in, group.check_out, seeker.check_in, seeker.check_out);
  if (nights < 2) {
    joinFails(failed, 'DATES_DONT_OVERLAP');
  } else {
    explanations.push(`${nights} overlapping nights`);
  }

  // 3. Budget compatible.
  const budgetOk = budgetsCompatible(group.budget_inr, seeker.budget_inr);
  if (!budgetOk) {
    joinFails(failed, 'BUDGET_MISMATCH');
  } else {
    explanations.push('Compatible budget');
  }

  // 4. At least 2 shared interests with the owner.
  const interests = sharedInterests(seeker.interests, owner.interests);
  if (interests < 2) {
    joinFails(failed, 'NOT_ENOUGH_SHARED_INTERESTS');
  } else {
    explanations.push(`${interests} shared interests`);
  }

  // 5. Mutually compatible gender preferences.
  const genderOk = gendersCompatible(
    seeker.gender,
    seeker.gender_preference,
    owner.gender,
    owner.gender_preference,
  );
  if (!genderOk) {
    joinFails(failed, 'GENDER_PREFERENCE_MISMATCH');
  }

  // 6. Capacity.
  const spots = (group.max_size || 0) - (group.member_count || 0);
  if (spots <= 0) {
    joinFails(failed, 'GROUP_FULL');
  } else {
    explanations.push(`${spots} spot${spots === 1 ? '' : 's'} remaining`);
  }

  return { eligible: failed.length === 0, failed, explanations, nights, interests };
}

// Deterministic score. Higher is better. Components:
//   - 3 points per shared interest (up to 3 meaningful interests -> 9)
//   - 1 point per overlapping night (capped at 10 -> 10)
//   - up to 4 points for budget closeness
// Tie-break: earlier check_in first, then group_id ascending.
export function scoreMatch({ group, owner, seeker, eligibility }) {
  const budgetMax = Math.max(group.budget_inr, seeker.budget_inr);
  const budgetScore = budgetMax > 0
    ? 4 * (1 - Math.abs(group.budget_inr - seeker.budget_inr) / budgetMax)
    : 0;
  const score = eligibility.interests * 3 + Math.min(eligibility.nights, 10) + budgetScore;
  return Math.round(score * 10000) / 10000;
}

export function rankMatches(candidates) {
  return candidates
    .map((candidate) => {
      const score = scoreMatch(candidate);
      return { ...candidate, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.group.check_in !== b.group.check_in) {
        return a.group.check_in < b.group.check_in ? -1 : 1;
      }
      return a.group.group_id < b.group.group_id ? -1 : 1;
    });
}
