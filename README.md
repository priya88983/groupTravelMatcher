# Group Travel Matcher — Foundation

First commit only: React/Vite frontend, Express backend, SQLite connection using `better-sqlite3`, health endpoint, and the original hackathon data pack.

## Requirements
- Node.js 20.19+ or 22+
- npm
- No external database server is required.

## Setup (once)
```bash
npm run setup
```
Optional: copy `frontend/.env.example` to `frontend/.env` and `backend/.env.example` to `backend/.env` to override defaults. Defaults work locally without `.env` files.

## Start (one command)
```bash
npm run dev
```
- Frontend: http://localhost:5173
- Health endpoint: http://localhost:5000/api/health
- SQLite file generated automatically at `backend/database/group-travel.db` (Git-ignored).

## Layout
- `frontend/`: Vite React app, starter page and reserved feature folders.
- `backend/src/config/database.js`: opens SQLite and enables WAL + foreign keys.
- `backend/src/app.js`: Express app and `/api/health` endpoint.
- `backend/src/server.js`: launches API.
- `data/`, `images/`, `DATA_DICTIONARY.md`, `problem-3-group-travel-matcher.md`: original unmodified hackathon assets.
- `README-data-pack.md`: original supplied README.

## Not yet implemented
No tables, models, migrations, seed script, JWT auth, profiles, group posts, matching, requests or hotel booking. These belong to subsequent commits. A successful SQLite connection creates a database file but **does not seed any data**.

## Suggested commit
`chore: initialize React Express SQLite project foundation`

Commit only source code and `.env.example`, never database files, secrets, or `node_modules`.
