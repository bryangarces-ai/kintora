const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// All persistent data lives in the "vault" data dir. In dev this is
// server/data/; when packaged as a desktop app, Electron overrides this via
// MEMORY_VAULT_DATA_DIR so data lands in a writable userData folder (the app
// bundle itself is read-only).
const DATA_DIR =
  process.env.MEMORY_VAULT_DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'memory-vault.db');

// Ensure the data + uploads folders exist before opening the DB.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema on every boot — all statements use IF NOT EXISTS, so this is safe.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = { db, DATA_DIR, UPLOADS_DIR, DB_PATH };
