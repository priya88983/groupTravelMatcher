import db from '../config/database.js';

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
