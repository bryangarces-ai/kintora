'use strict';

// One-time migration of a legacy 1.0.x *plaintext* vault to the encrypted
// format. Safety first: the whole vault folder is copied to a sibling
// "<vault>-preencryption-backup-<ts>" before anything is changed, and the
// original is only replaced after the encrypted copy is built and verified.
// On any error the original vault is left untouched.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3-multiple-ciphers');
const { encryptBuffer } = require('./file-crypto');

const SQLITE_MAGIC = 'SQLite format 3\x00';

function dbPathOf(dataDir) {
  return path.join(dataDir, 'memory-vault.db');
}

// True if the vault DB exists and is still a plaintext SQLite file.
function needsMigration(dataDir) {
  const dbPath = dbPathOf(dataDir);
  if (!fs.existsSync(dbPath)) return false;
  const fd = fs.openSync(dbPath, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    return head.toString('binary') === SQLITE_MAGIC;
  } finally {
    fs.closeSync(fd);
  }
}

function countRows(db) {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name);
  let total = 0;
  for (const t of tables) total += db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
  return total;
}

// Migrate the plaintext vault at dataDir to encryption under dekHex (64 hex).
// Returns { backupDir, rows }.
function migratePlaintextVault(dataDir, dekHex) {
  if (!/^[0-9a-fA-F]{64}$/.test(dekHex || '')) {
    throw new Error('migrate: a 64-hex-char key is required');
  }
  const dbPath = dbPathOf(dataDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${dataDir}-preencryption-backup-${ts}`;

  // 1. Full safety copy of the vault (never deleted automatically).
  fs.cpSync(dataDir, backupDir, { recursive: true });

  // 2. Flush any plaintext WAL into the main DB file.
  {
    const plain = new Database(dbPath);
    plain.pragma('wal_checkpoint(TRUNCATE)');
    plain.close();
  }

  // 3. Build an encrypted copy via sqlcipher_export (plaintext -> encrypted).
  const encPath = dbPath + '.migrating';
  fs.rmSync(encPath, { force: true });
  {
    const enc = new Database(encPath);
    enc.pragma(`cipher='sqlcipher'`);
    enc.pragma(`key="x'${dekHex}'"`);
    enc.exec(`ATTACH DATABASE '${dbPath.replace(/'/g, "''")}' AS plain KEY ''`);
    enc.exec(`SELECT sqlcipher_export('main', 'plain')`);
    enc.exec('DETACH DATABASE plain');
    enc.close();
  }

  // 4. Verify the encrypted copy opens with the key and is readable.
  let rows;
  {
    const check = new Database(encPath);
    check.pragma(`cipher='sqlcipher'`);
    check.pragma(`key="x'${dekHex}'"`);
    const ok = check.pragma('integrity_check', { simple: true });
    rows = countRows(check);
    check.close();
    if (ok !== 'ok') {
      fs.rmSync(encPath, { force: true });
      throw new Error('migrate: encrypted DB failed integrity_check; original left intact');
    }
  }

  // 5. Swap the encrypted DB in (remove plaintext DB + its WAL/SHM sidecars).
  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
  fs.renameSync(encPath, dbPath);

  // 6. Encrypt any existing upload files in place.
  const uploadsDir = path.join(dataDir, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    for (const name of fs.readdirSync(uploadsDir)) {
      if (name.endsWith('.enc')) continue;
      const full = path.join(uploadsDir, name);
      if (!fs.statSync(full).isFile()) continue;
      fs.writeFileSync(full + '.enc', encryptBuffer(fs.readFileSync(full), dekHex));
      fs.rmSync(full, { force: true });
    }
  }

  return { backupDir, rows };
}

module.exports = { needsMigration, migratePlaintextVault };
