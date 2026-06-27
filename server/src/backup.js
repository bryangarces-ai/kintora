const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { db, DATA_DIR, UPLOADS_DIR } = require('./db');

// A backup is a single .zip containing:
//   memory-vault.db    — a consistent snapshot of the database
//   uploads/...        — all photos/audio
//   backup-info.json   — metadata so restore can sanity-check the file
// The Obsidian export is intentionally NOT included — it's regenerable from the
// data and would just bloat the backup.

const BACKUP_MARKER = 'memory-vault.db';

// Build the backup as an in-memory Buffer (the route streams it as a download).
async function createBackupBuffer() {
  // A clean, consistent DB snapshot via SQLite's online backup API. This avoids
  // copying the live -wal/-shm files (which is fragile) and never blocks writes.
  const tmpDb = path.join(os.tmpdir(), `mv-backup-${Date.now()}.db`);
  await db.backup(tmpDb);

  try {
    const zip = new AdmZip();
    zip.addLocalFile(tmpDb, '', BACKUP_MARKER);
    if (fs.existsSync(UPLOADS_DIR)) {
      zip.addLocalFolder(UPLOADS_DIR, 'uploads');
    }
    zip.addFile(
      'backup-info.json',
      Buffer.from(
        JSON.stringify(
          { app: 'memory-vault', format: 1, created_at: new Date().toISOString() },
          null,
          2
        )
      )
    );
    return zip.toBuffer();
  } finally {
    fs.rmSync(tmpDb, { force: true });
  }
}

// Restore from a backup .zip buffer. Strategy: copy the rows OUT of the backup
// database INTO the live one (via ATTACH), rather than replacing the open DB
// file — the running server holds the DB handle, and on Windows you can't swap a
// locked file. This keeps the same connection and runs inside one transaction.
async function restoreFromBuffer(buf) {
  let zip;
  try {
    zip = new AdmZip(buf);
  } catch (_) {
    throw httpError(400, 'That file is not a valid .zip backup.');
  }
  if (!zip.getEntry(BACKUP_MARKER)) {
    throw httpError(400, 'That .zip is not a Memory Vault backup (memory-vault.db missing).');
  }

  // Safety net: snapshot the CURRENT vault before we overwrite it, so a bad
  // restore is recoverable. Saved into the data dir.
  const safety = await createBackupBuffer();
  const safetyName = `pre-restore-backup-${stamp()}.zip`;
  fs.writeFileSync(path.join(DATA_DIR, safetyName), safety);

  // Extract the backup to a temp dir.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-restore-'));
  try {
    zip.extractAllTo(tmpDir, /* overwrite */ true);
    const backupDbPath = path.join(tmpDir, BACKUP_MARKER);

    // Copy all user tables from the backup into the live DB. FK enforcement is
    // toggled off for the bulk wipe+copy (must be set outside a transaction).
    db.pragma('foreign_keys = OFF');
    db.prepare('ATTACH DATABASE ? AS backup').run(backupDbPath);
    try {
      const tables = db
        .prepare(
          `SELECT name FROM backup.sqlite_master
           WHERE type='table' AND name NOT LIKE 'sqlite_%'`
        )
        .all()
        .map((r) => r.name);

      const apply = db.transaction(() => {
        for (const t of tables) db.prepare(`DELETE FROM main."${t}"`).run();
        for (const t of tables) {
          db.prepare(`INSERT INTO main."${t}" SELECT * FROM backup."${t}"`).run();
        }
      });
      apply();
    } finally {
      db.prepare('DETACH DATABASE backup').run();
      db.pragma('foreign_keys = ON');
    }

    // Replace uploaded files with the backup's set.
    const upBackup = path.join(tmpDir, 'uploads');
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (fs.existsSync(upBackup)) {
      fs.cpSync(upBackup, UPLOADS_DIR, { recursive: true });
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
