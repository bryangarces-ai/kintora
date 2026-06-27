const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3-multiple-ciphers');

// All persistent data lives in the "vault" data dir. In dev this is
// server/data/; when packaged as a desktop app, Electron overrides this via
// MEMORY_VAULT_DATA_DIR so data lands in a writable userData folder (the app
// bundle itself is read-only).
const DATA_DIR =
  process.env.MEMORY_VAULT_DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'memory-vault.db');

// The vault is encrypted at rest (SQLCipher via better-sqlite3-multiple-ciphers).
// The 32-byte Data Encryption Key arrives as 64 hex chars in KINTORA_VAULT_KEY:
// the Electron main process unseals it (DPAPI / passphrase) before starting the
// server; dev mode and tests set it directly. No key => refuse to open.
const KEY_HEX = process.env.KINTORA_VAULT_KEY;
if (!KEY_HEX || !/^[0-9a-fA-F]{64}$/.test(KEY_HEX)) {
  throw new Error(
    'Vault is locked: KINTORA_VAULT_KEY (64 hex chars / 32 bytes) is required ' +
      'to open the encrypted database.'
  );
}

// Ensure the data + uploads folders exist before opening the DB.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new Database(DB_PATH);
// Apply the cipher + raw key BEFORE touching the database. A raw key ("x'...'")
// is used directly (no KDF); SQLCipher stores the random salt in the file header.
db.pragma(`cipher='sqlcipher'`);
db.pragma(`key="x'${KEY_HEX}'"`);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema on every boot — all statements use IF NOT EXISTS, so this is safe.
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = { db, DATA_DIR, UPLOADS_DIR, DB_PATH, KEY_HEX };
