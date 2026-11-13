import db from '../config/database.js';

export function create({ userId, tokenHash, familyId, expiresAt }) {
  const result = db
    .prepare('INSERT INTO refresh_sessions (user_id, token_hash, family_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(userId, tokenHash, familyId, expiresAt);
  return Number(result.lastInsertRowid);
}

export function findByTokenHash(tokenHash) {
  return db.prepare('SELECT * FROM refresh_sessions WHERE token_hash = ?').get(tokenHash);
}

export function revoke(id) {
  db.prepare('UPDATE refresh_sessions SET revoked = 1 WHERE id = ?').run(id);
}

export function revokeFamily(familyId) {
  db.prepare('UPDATE refresh_sessions SET revoked = 1 WHERE family_id = ?').run(familyId);
}

export function markReplaced(id, replacementId) {
  db
    .prepare('UPDATE refresh_sessions SET revoked = 1, replaced_by = ? WHERE id = ?')
    .run(replacementId, id);
}
