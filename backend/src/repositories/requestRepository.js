import db from '../config/database.js';

const REQUEST_SELECT = `
  SELECT r.id, r.group_id, r.traveller_id, r.status, r.destination,
         r.check_in, r.check_out, r.budget_inr, r.interests,
         r.created_at, r.updated_at,
         t.name, t.age, t.gender, t.home_city, t.gender_preference
  FROM join_requests r
  JOIN travellers t ON t.traveller_id = r.traveller_id
`;

export function createRequest({
  groupId,
  travellerId,
  status = 'PENDING',
  destination = null,
  checkIn = null,
  checkOut = null,
  budgetInr = null,
  interests = null,
}) {
  const result = db.prepare(`
    INSERT INTO join_requests
      (group_id, traveller_id, status, destination, check_in, check_out, budget_inr, interests)
    VALUES (@groupId, @travellerId, @status, @destination, @checkIn, @checkOut, @budgetInr, @interests)
  `).run({
    groupId,
    travellerId,
    status,
    destination,
    checkIn,
    checkOut,
    budgetInr,
    interests: interests ? JSON.stringify(interests) : null,
  });
  return Number(result.lastInsertRowid);
}

export function findById(id) {
  return db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id);
}

export function findByGroupAndTraveller(groupId, travellerId) {
  return db
    .prepare(`${REQUEST_SELECT} WHERE r.group_id = ? AND r.traveller_id = ?`)
    .get(groupId, travellerId);
}

export function listByGroup(groupId) {
  return db
    .prepare(`${REQUEST_SELECT} WHERE r.group_id = ? ORDER BY r.id ASC`)
    .all(groupId);
}

const PROFILE_GROUP_SELECT = `
  SELECT r.id, r.group_id, r.traveller_id, r.status, r.destination,
         r.check_in, r.check_out, r.budget_inr, r.interests,
         r.created_at, r.updated_at,
         t.name, t.age, t.gender, t.home_city, t.gender_preference,
         g.name AS group_name, g.city AS group_city,
         g.max_size, g.budget_inr AS group_budget_inr,
         (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id) AS member_count
  FROM join_requests r
  JOIN travellers t ON t.traveller_id = r.traveller_id
  JOIN groups g ON g.group_id = r.group_id
`;

export function listSentByTraveller(travellerId) {
  return db
    .prepare(`
      ${PROFILE_GROUP_SELECT}
      WHERE r.traveller_id = ?
      ORDER BY r.created_at DESC
    `)
    .all(travellerId);
}

export function listReceivedByOwner(travellerId) {
  return db
    .prepare(`
      ${PROFILE_GROUP_SELECT}
      WHERE g.owner_id = ?
      ORDER BY r.created_at DESC
    `)
    .all(travellerId);
}

export function updateStatus(id, status) {
  db.prepare(`
    UPDATE join_requests
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, id);
}
