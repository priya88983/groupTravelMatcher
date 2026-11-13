import db from './database.js';

// Idempotent schema creation. Safe to run on every startup.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS travellers (
    traveller_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT NOT NULL,
    home_city TEXT NOT NULL,
    home_airport TEXT NOT NULL,
    gender_preference TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS traveller_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    traveller_id TEXT NOT NULL REFERENCES travellers(traveller_id) ON DELETE CASCADE,
    interest TEXT NOT NULL,
    UNIQUE (traveller_id, interest)
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    family_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    replaced_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS groups (
    group_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL REFERENCES travellers(traveller_id),
    city TEXT NOT NULL,
    check_in TEXT,
    check_out TEXT,
    max_size INTEGER,
    budget_inr INTEGER,
    itinerary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    traveller_id TEXT NOT NULL REFERENCES travellers(traveller_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    UNIQUE (group_id, traveller_id)
  )`,
  `CREATE TABLE IF NOT EXISTS join_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    traveller_id TEXT NOT NULL REFERENCES travellers(traveller_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    destination TEXT,
    check_in TEXT,
    check_out TEXT,
    budget_inr INTEGER,
    interests TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (group_id, traveller_id)
  )`,
];

const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_travellers_user_id ON travellers(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_interests_traveller ON traveller_interests(traveller_id)',
  'CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_sessions(family_id)',
  'CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id)',
  'CREATE INDEX IF NOT EXISTS idx_join_requests_group ON join_requests(group_id)',
  'CREATE INDEX IF NOT EXISTS idx_join_requests_traveller ON join_requests(traveller_id)',
];

export function migrate() {
  const runAll = db.transaction(() => {
    for (const sql of SCHEMA) db.exec(sql);
    for (const sql of INDEXES) db.exec(sql);
  });
  runAll();
}
