// Pure, independently testable hotel planning calculations.
// All money is handled as integer INR. Splits are exact: shares always sum to
// the total, with any remainder distributed deterministically (+1 paisa/INR
// to the earliest travellers in a stable order).

const DAY_MS = 86400000;

// Return the list of nights (inclusive start, exclusive end) between two
// YYYY-MM-DD dates. check_in is inclusive; check_out is exclusive.
export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return [];
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  const nights = [];
  for (let t = start; t < end; t += DAY_MS) {
    nights.push(new Date(t).toISOString().slice(0, 10));
  }
  return nights;
}

// Number of approved members present on a given night.
export function activeMembersOnNight(members, night) {
  return members.filter((m) => m.check_in <= night && night < m.check_out);
}

export function roomsNeeded(activeCount, capacity) {
  if (activeCount <= 0 || capacity <= 0) return 0;
  return Math.ceil(activeCount / capacity);
}

// Split `total` (integer minor units) into exactly `shareCount` integer parts
// that sum to `total`. Remainder is distributed deterministically: +1 to the
// first `remainder` slots, in the order members are given.
export function splitEvenly(total, shareCount) {
  if (!Number.isFinite(total) || total < 0) return [];
  if (shareCount <= 0) return [];
  if (total === 0) return Array(shareCount).fill(0);
  const base = Math.floor(total / shareCount);
  const remainder = total % shareCount;
  const shares = Array(shareCount).fill(base);
  for (let i = 0; i < remainder; i += 1) shares[i] += 1;
  return shares;
}

// Build a nightly cost breakdown for one selection.
// - selection: { check_in, check_out, price_per_night, room_capacity }
// - members: array of { traveller_id, name, check_in, check_out }
// Returns { rows, memberTotals, totalCost } where rows are per-night and
// memberTotals is keyed by traveller_id. Shares sum exactly to totalCost.
export function buildSelectionBreakdown(selection, members) {
  const nights = nightsBetween(selection.check_in, selection.check_out);
  const memberTotals = {};
  for (const m of members) memberTotals[m.traveller_id] = 0;

  const rows = nights.map((night) => {
    const active = activeMembersOnNight(members, night)
      .slice()
      .sort((a, b) => a.traveller_id.localeCompare(b.traveller_id));
    const activeCount = active.length;
    const rooms = roomsNeeded(activeCount, selection.room_capacity);
    const totalCost = rooms * Number(selection.price_per_night);
    const shares = splitEvenly(totalCost, activeCount);
    active.forEach((member, index) => {
      memberTotals[member.traveller_id] += shares[index];
    });
    return {
      night,
      active_members: activeCount,
      rooms,
      total_cost: totalCost,
      per_person: activeCount ? Math.round((totalCost / activeCount) * 100) / 100 : 0,
    };
  });

  const totalCost = rows.reduce((sum, row) => sum + row.total_cost, 0);
  return { rows, memberTotals, totalCost };
}
