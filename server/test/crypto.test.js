'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3-multiple-ciphers');

const { encryptBuffer, decryptBuffer } = require('../src/crypto/file-crypto');
const keyring = require('../src/crypto/keyring');
const { needsMigration, migratePlaintextVault } = require('../src/crypto/migrate');

const KEY = 'b'.repeat(64);

function openEncrypted(dbPath, keyHex) {
  const db = new Database(dbPath);
  db.pragma(`cipher='sqlcipher'`);
  db.pragma(`key="x'${keyHex}'"`);
  return db;
}

test('file-crypto: round-trips and rejects tampering', () => {
  const data = Buffer.from('hello vault secret payload 0123456789');
  const enc = encryptBuffer(data, KEY);
  assert.ok(enc.subarray(0, 4).equals(Buffer.from('KVE1')));
  assert.ok(decryptBuffer(enc, KEY).equals(data));

  const tampered = Buffer.from(enc);
  tampered[20] ^= 0xff; // flip a ciphertext byte -> GCM auth must fail
  assert.throws(() => decryptBuffer(tampered, KEY));
});

test('keyring: passphrase wrap/unwrap; wrong passphrase rejected', () => {
  const dek = keyring.generateDEK();
  const wrap = keyring.wrapWithPassphrase(dek, 'correct horse battery');
  assert.ok(keyring.unwrapWithPassphrase(wrap, 'correct horse battery').equals(dek));
  assert.throws(() => keyring.unwrapWithPassphrase(wrap, 'wrong'), /Incorrect passphrase/);
});

test('migrate: plaintext vault -> encrypted, with safety backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kintora-migrate-'));
  const dbPath = path.join(dir, 'memory-vault.db');

  // Build a plaintext DB using the real schema (so columns match the migration).
  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'schema.sql'), 'utf8');
  const plain = new Database(dbPath);
  plain.exec(schema);
  plain.prepare('INSERT INTO facts (category, label, value) VALUES (?, ?, ?)').run(
    'medical',
    'Blood type',
    'O+'
  );
  plain.close();

  // And a plaintext upload.
  const uploads = path.join(dir, 'uploads');
  fs.mkdirSync(uploads);
  const original = Buffer.from('PNGDATA-secret-pixels-123');
  fs.writeFileSync(path.join(uploads, 'pic.png'), original);

  assert.equal(needsMigration(dir), true);
  const { backupDir, rows } = migratePlaintextVault(dir, KEY);
  assert.equal(needsMigration(dir), false);
  assert.ok(rows >= 1);

  // The safety backup keeps the original plaintext DB.
  assert.ok(fs.existsSync(path.join(backupDir, 'memory-vault.db')));

  // The migrated DB opens with the key and still has the row.
  const enc = openEncrypted(dbPath, KEY);
  const row = enc.prepare('SELECT value FROM facts WHERE label = ?').get('Blood type');
  enc.close();
  assert.equal(row.value, 'O+');

  // The upload is now encrypted on disk and decrypts back to the original.
  assert.ok(!fs.existsSync(path.join(uploads, 'pic.png')));
  const encUp = fs.readFileSync(path.join(uploads, 'pic.png.enc'));
  assert.ok(decryptBuffer(encUp, KEY).equals(original));

  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
});
