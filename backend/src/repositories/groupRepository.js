import crypto from 'node:crypto';
import db from '../config/database.js';

const GROUP_SELECT = `
  SELECT g.group_id, g.name, g.owner_id, g.city, g.check_in, g.check_out,
         g.max_size, g.budget_inr, g.itinerary, g.created_at,
         t.name AS owner_name,
         (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id) AS member_count
  FROM groups g
  JOIN travellers t ON t.traveller_id = g.owner_id
`;

export function createGroup(group) {
  db.prepare(`
    INSERT OR IGNORE INTO groups
      (group_id, name, owner_id, city, check_in, check_out, max_size, budget_inr, itinerary)
    VALUES (@group_id, @name, @owner_id, @city, @check_in, @check_out, @max_size, @budget_inr, @itinerary)
  `).run(group);
}

export function addMember(groupId, travellerId, role) {
  db.prepare(`
    INSERT OR IGNORE INTO group_members (group_id, traveller_id, role)
    VALUES (?, ?, ?)
  `).run(groupId, travellerId, role);
}

export function countGroups() {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM groups').get().n);
}

export function countMembers() {
  return Number(db.prepare('SELECT COUNT(*) AS n FROM group_members').get().n);
}

export function clearSeededData() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM group_members').run();
    db.prepare('DELETE FROM groups').run();
  });
  tx();
}

export function findById(groupId) {
  return db.prepare(`${GROUP_SELECT} WHERE g.group_id = ?`).get(groupId);
}

export function findMember(groupId, travellerId) {
  return db
    .prepare('SELECT * FROM group_members WHERE group_id = ? AND traveller_id = ?')
    .get(groupId, travellerId);
}

export function memberCount(groupId) {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?')
    .get(groupId);
  return Number(row.n);
}

export function listMembers(groupId) {
  return db
    .prepare(`
      SELECT gm.traveller_id, gm.role, t.name, t.age, t.gender, t.home_city,
             t.gender_preference
      FROM group_members gm
      JOIN travellers t ON t.traveller_id = gm.traveller_id
      WHERE gm.group_id = ?
      ORDER BY gm.id
    `)
    .all(groupId);
}

export function findAllGroups({ city, limit, offset } = {}) {
  const where = [];
  const params = [];
  if (city) {
    where.push('g.city = ?');
    params.push(city);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = Number.isInteger(limit) ? 'LIMIT ?' : '';
  const offsetSql = Number.isInteger(offset) ? 'OFFSET ?' : '';
  if (Number.isInteger(limit)) params.push(limit);
  if (Number.isInteger(offset)) params.push(offset);
  const rows = db.prepare(`
    ${GROUP_SELECT}
    ${whereSql}
    ORDER BY g.created_at DESC, g.group_id ASC
    ${limitSql} ${offsetSql}
  `).all(...params);
  return rows;
}

export function countAllGroups(filters = {}) {
  const where = [];
  const params = [];
  if (filters.city) {
    where.push('city = ?');
    params.push(filters.city);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const row = db.prepare(`SELECT COUNT(*) AS n FROM groups ${whereSql}`).get(...params);
  return Number(row.n);
}

// Auto-generated group ids use a random suffix (e.g. G-a1b2c3) so they never
// collide with the seeded ids, which are always of the form G-NNN.
export function nextGroupId() {
  return `G-${crypto.randomBytes(3).toString('hex')}`;
}

// Insert the group and its owner membership in a single transaction.
export function createGroupWithOwner(group, ownerId) {
  const tx = db.transaction(() => {
    createGroup(group);
    addMember(group.group_id, ownerId, 'owner');
  });
  tx();
  return findById(group.group_id);
}

export function listGroupsOwnedBy(travellerId) {
  return db
    .prepare(`${GROUP_SELECT} WHERE g.owner_id = ? ORDER BY g.created_at DESC, g.group_id`)
    .all(travellerId);
}

export function listGroupsWhereMember(travellerId) {
  return db
    .prepare(`
      ${GROUP_SELECT}
      JOIN group_members gm ON gm.group_id = g.group_id AND gm.traveller_id = ?
      ORDER BY g.created_at DESC, g.group_id
    `)
    .all(travellerId);
}
