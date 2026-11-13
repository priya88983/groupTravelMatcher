// Single frontend implementation of the six mandatory matching rules.
// Used for UI preview only — the backend remains authoritative and always
// re-validates on join-request submission.
import { toUtcTime } from '../context/TravelPreferencesContext.jsx';

// Whether a person's preference allows the other person's gender.
export function genderAllows(preference, myGender, otherGender) {
  if (!myGender || !otherGender) return false;
  if (preference === 'ANY') return true;
  if (preference === 'SAME_GENDER') return myGender === otherGender;
  if (preference === 'OPPOSITE_GENDER') return myGender !== otherGender;
  return false;
}

export function calculateOverlapNights(
  groupCheckIn,
  groupCheckOut,
  seekerCheckIn,
  seekerCheckOut,
) {
  const start = Math.max(toUtcTime(groupCheckIn), toUtcTime(seekerCheckIn));
  const end = Math.min(toUtcTime(groupCheckOut), toUtcTime(seekerCheckOut));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / 86400000);
}

export function evaluateEligibility(group, traveller, tripPreferences) {
  const failed = [];
  const explanations = [];

  const owner = group.owner || {};
  const spots =
    group.available_spots ?? Number(group.max_size) - Number(group.member_count);

  // 1. Capacity
  if (spots <= 0) {
    failed.push('GROUP_FULL');
    explanations.push('Group is full');
  } else {
    explanations.push(`${spots} spot${spots === 1 ? '' : 's'} remaining`);
  }

  // 2. Shared interests
  const seekerInterests = traveller?.interests || [];
  const ownerInterests = owner.interests || [];
  const sharedCount = new Set(
    seekerInterests.filter((i) => ownerInterests.includes(i)),
  ).size;
  if (sharedCount < 2) {
    failed.push('NOT_ENOUGH_SHARED_INTERESTS');
    explanations.push(`Only ${sharedCount} shared interests (minimum 2 required)`);
  } else {
    explanations.push(`${sharedCount} shared interests`);
  }

  // 3. Mutual gender compatibility
  const seekerAllowsOwner = genderAllows(
    traveller?.gender_preference,
    traveller?.gender,
    owner.gender,
  );
  const ownerAllowsSeeker = genderAllows(
    owner.gender_preference,
    owner.gender,
    traveller?.gender,
  );
  if (!seekerAllowsOwner || !ownerAllowsSeeker) {
    failed.push('GENDER_PREFERENCE_MISMATCH');
    explanations.push('Gender preferences are not compatible');
  } else {
    explanations.push('Gender preferences are compatible');
  }

  // 4. Destination
  if (group.city !== tripPreferences.destination) {
    failed.push('DESTINATION_MISMATCH');
    explanations.push(`Destination mismatch: group is visiting ${group.city}`);
  } else {
    explanations.push('Destination matches');
  }

  // 5. Date overlap
  const overlappingNights = calculateOverlapNights(
    group.check_in,
    group.check_out,
    tripPreferences.check_in,
    tripPreferences.check_out,
  );
  if (overlappingNights < 2) {
    failed.push('INSUFFICIENT_DATE_OVERLAP');
    explanations.push(`Only ${overlappingNights} overlapping nights (minimum 2 required)`);
  } else {
    explanations.push(`${overlappingNights} overlapping nights`);
  }

  // 6. Budget compatibility
  const groupBudget = Number(group.budget_inr);
  const seekerBudget = Number(tripPreferences.budget_inr);
  const lowerBudget = Math.min(groupBudget, seekerBudget);
  const difference = Math.abs(groupBudget - seekerBudget);
  if (!Number.isFinite(lowerBudget) || lowerBudget <= 0 || difference > 0.4 * lowerBudget) {
    failed.push('BUDGET_MISMATCH');
    explanations.push('Budget difference exceeds 40%');
  } else {
    explanations.push('Budgets are compatible');
  }

  return { eligible: failed.length === 0, failed, explanations };
}
