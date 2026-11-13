import db from '../config/database.js';

export function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function findPublicById(id) {
  return db
    .prepare('SELECT id, email, created_at FROM users WHERE id = ?')
    .get(id);
}

export function create({ email, passwordHash }) {
  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);
  return Number(result.lastInsertRowid);
}
