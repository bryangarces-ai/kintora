const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { db, DATA_DIR, UPLOADS_DIR, DB_PATH, KEY_HEX } = require('./db');
const { diskPathFor } = require('./uploads-util');
const { encryptBuffer, decryptBuffer } = require('./crypto/file-crypto');
const { encryptWithPassphrase, decryptWithPassphrase } = require('./crypto/keyring');

// A portable backup is a single passphrase-encrypted ".kvault" file. Inside (once
// decrypted) is a zip containing:
//   memory-vault.db    — a PLAINTEXT snapshot of the database
//   uploads/...        — the DECRYPTED photos/audio
//   backup-info.json   — metadata
// Because the contents are plaintext but the whole file is encrypted with the
// user's passphrase, a backup carries no machine-bound key and restores on any
// computer. The Obsidian export is intentionally excluded (it's regenerable).

const BACKUP_MARKER = 'memory-vault.db';
const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function userTables(database, schema) {
  return database
    .prepare(
      `SELECT name FROM ${schema}.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    )
    .all()
    .map((r) => r.name);
}

// Build a portable, passphrase-encrypted backup as a Buffer.
async function createBackupBuffer(passphrase) {
  if (!passphrase) throw httpError(400, 'A backup passphrase is required.');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kintora-backup-'));
  try {
    // 1. Plaintext snapshot of the DB: create the schema in a temp file, then
    //    copy every row out of the live (encrypted) DB via ATTACH.
    const plainDbPath = path.join(tmpDir, BACKUP_MARKER);
    const snap = new (require('better-sqlite3-multiple-ciphers'))(plainDbPath);
    snap.exec(SCHEMA);
    snap.close();

    db.pragma('foreign_keys = OFF');
    db.exec(`ATTACH DATABASE '${plainDbPath.replace(/'/g, "''")}' AS exp KEY ''`);
    try {
      const copy = db.transaction(() => {
        for (const t of userTables(db, 'main')) {
          db.prepare(`INSERT INTO exp."${t}" SELECT * FROM main."${t}"`).run();
        }
      });
      copy();
    } finally {
      db.exec('DETACH DATABASE exp');
      db.pragma('foreign_keys = ON');
    }

    // 2. Zip the plaintext DB + decrypted uploads + metadata.
    const zip = new AdmZip();
    zip.addLocalFile(plainDbPath, '', BACKUP_MARKER);
    if (fs.existsSync(UPLOADS_DIR)) {
      for (const name of fs.readdirSync(UPLOADS_DIR)) {
        if (!name.endsWith('.enc')) continue;
        const logical = name.slice(0, -'.enc'.length);
        const plain = decryptBuffer(fs.readFileSync(path.join(UPLOADS_DIR, name)), KEY_HEX);
        zip.addFile('uploads/' + logical, plain);
      }
    }
    zip.addFile(
      'backup-info.json',
      Buffer.from(
        JSON.stringify({ app: 'kintora', format: 2, created_at: new Date().toISOString() }, null, 2)
      )
    );

    // 3. Encrypt the whole zip with the passphrase -> portable .kvault.
    return encryptWithPassphrase(zip.toBuffer(), passphrase);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Restore from a passphrase-encrypted .kvault buffer.
async function restoreFromBuffer(buf, passphrase) {
  if (!passphrase) throw httpError(400, 'The backup passphrase is required to restore.');

  let zipBuf;
  try {
    zipBuf = decryptWithPassphrase(buf, passphrase);
  } catch (err) {
    if (/passphrase/i.test(err.message)) throw httpError(400, 'Incorrect backup passphrase.');
    throw httpError(400, 'That file is not a valid Kintora backup.');
  }

  let zip;
  try {
    zip = new AdmZip(zipBuf);
  } catch (_) {
    throw httpError(400, 'The backup is corrupted.');
  }
  if (!zip.getEntry(BACKUP_MARKER)) {
    throw httpError(400, 'That backup is missing its database.');
  }

  // Safety net: a consistent, still-encrypted snapshot of the CURRENT vault,
  // saved into the data dir so a bad restore is recoverable.
  db.pragma('wal_checkpoint(TRUNCATE)');
  const safetyName = `pre-restore-${stamp()}`;
  const safetyDir = path.join(DATA_DIR, safetyName);
  fs.mkdirSync(safetyDir, { recursive: true });
  fs.copyFileSync(DB_PATH, path.join(safetyDir, BACKUP_MARKER));
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.cpSync(UPLOADS_DIR, path.join(safetyDir, 'uploads'), { recursive: true });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kintora-restore-'));
  try {
    zip.extractAllTo(tmpDir, /* overwrite */ true);
    const backupDbPath = path.join(tmpDir, BACKUP_MARKER); // plaintext

    // Copy all rows from the plaintext backup DB into the live encrypted DB.
    db.pragma('foreign_keys = OFF');
    db.exec(`ATTACH DATABASE '${backupDbPath.replace(/'/g, "''")}' AS backup KEY ''`);
    try {
      const tables = userTables(db, 'backup');
      const apply = db.transaction(() => {
        for (const t of tables) db.prepare(`DELETE FROM main."${t}"`).run();
        for (const t of tables) {
          db.prepare(`INSERT INTO main."${t}" SELECT * FROM backup."${t}"`).run();
        }
      });
      apply();
    } finally {
      db.exec('DETACH DATABASE backup');
      db.pragma('foreign_keys = ON');
    }

    // Replace uploads, re-encrypting each with the LOCAL vault key.
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const upDir = path.join(tmpDir, 'uploads');
    if (fs.existsSync(upDir)) {
      for (const name of fs.readdirSync(upDir)) {
        const plain = fs.readFileSync(path.join(upDir, name));
        fs.writeFileSync(diskPathFor(name), encryptBuffer(plain, KEY_HEX));
      }
    }

    return { ok: true, safetyBackup: safetyName };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = { createBackupBuffer, restoreFromBuffer };
