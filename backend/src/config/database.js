import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const configuredPath = process.env.SQLITE_DB_PATH || './database/group-travel.db';
const databasePath = isAbsolute(configuredPath)
  ? configuredPath
  : resolve(backendRoot, configuredPath);

mkdirSync(dirname(databasePath), { recursive: true });

console.log(`[database] Opening SQLite at ${databasePath}`);
const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function checkDatabaseConnection() {
  return db.prepare('SELECT 1 AS ok').get().ok === 1;
}

export { databasePath };
export default db;
