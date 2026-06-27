'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Point the app at a throwaway vault BEFORE requiring it, so tests never touch
// real data. db.js resolves MEMORY_VAULT_DATA_DIR at load time.
const TMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kintora-test-'));
process.env.MEMORY_VAULT_DATA_DIR = TMP_VAULT;
// The DB is encrypted; tests open it with a fixed throwaway key.
process.env.KINTORA_VAULT_KEY = 'a'.repeat(64);
delete process.env.CLIENT_DIST; // keep the SPA/static-serving block disabled

const { app } = require('../src/index');

let server;
let base;

// Tiny JSON helper. POST/PUT bodies go up as JSON; multer skips non-multipart
// requests, so express.json() populates req.body exactly as the routes expect.
async function api(method, pathname, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(base + pathname, opts);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  try {
    fs.rmSync(TMP_VAULT, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
});

test('health check responds ok', async () => {
  const res = await api('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('people: full create / read / update / delete lifecycle', async () => {
  // a fresh vault starts empty
  let res = await api('GET', '/api/people');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);

  // create
  res = await api('POST', '/api/people', { name: 'Alice', relationship: 'friend' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'Alice');
  const id = res.body.id;
  assert.ok(id);

  // read one — includes an (empty) memories array
  res = await api('GET', `/api/people/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.relationship, 'friend');
  assert.deepEqual(res.body.memories, []);

  // update — unspecified fields are preserved
  res = await api('PUT', `/api/people/${id}`, { relationship: 'best friend' });
  assert.equal(res.status, 200);
  assert.equal(res.body.relationship, 'best friend');
  assert.equal(res.body.name, 'Alice');

  // delete, then confirm it's gone
  res = await api('DELETE', `/api/people/${id}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });

  res = await api('GET', `/api/people/${id}`);
  assert.equal(res.status, 404);
});

test('people: creation requires a name', async () => {
  const res = await api('POST', '/api/people', { relationship: 'nobody' });
  assert.equal(res.status, 400);
});

test('facts: create, validate, and delete', async () => {
  let res = await api('POST', '/api/facts', {
    label: 'Blood type',
    value: 'O+',
    category: 'medical',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.value, 'O+');
  const id = res.body.id;

  // value is required
  res = await api('POST', '/api/facts', { label: 'no value' });
  assert.equal(res.status, 400);

  res = await api('DELETE', `/api/facts/${id}`);
  assert.equal(res.status, 200);

  // deleting again is a 404
  res = await api('DELETE', `/api/facts/${id}`);
  assert.equal(res.status, 404);
});

test('vault DB is encrypted on disk (no plaintext leaks)', async () => {
  const canary = 'CANARY-PLAINTEXT-9f8e7d6c';
  const res = await api('POST', '/api/facts', { label: 'canary', value: canary });
  assert.equal(res.status, 201);

  // Flush the WAL into the main DB file, then inspect the raw bytes on disk.
  const { db } = require('../src/db');
  db.pragma('wal_checkpoint(TRUNCATE)');
  const dbBytes = fs.readFileSync(path.join(TMP_VAULT, 'memory-vault.db'));

  // The canary value must not appear in cleartext anywhere in the file.
  assert.ok(
    !dbBytes.includes(Buffer.from(canary)),
    'plaintext canary leaked into the DB file'
  );
  // A plaintext SQLite DB begins with the 16-byte magic "SQLite format 3" + NUL.
  // An encrypted database must not start with that header.
  assert.notEqual(dbBytes.subarray(0, 16).toString('binary'), 'SQLite format 3\x00');
});

test('uploads are encrypted on disk and served decrypted', async () => {
  const original = Buffer.from('FAKE-IMAGE-BYTES-canary-pixels-0123456789');

  const form = new FormData();
  form.set('title', 'Photo memory');
  form.set('photos', new Blob([original], { type: 'image/png' }), 'pic.png');

  const res = await fetch(base + '/api/memories', { method: 'POST', body: form });
  assert.equal(res.status, 201);
  const mem = await res.json();
  assert.equal(mem.media.length, 1);
  const name = mem.media[0].file_path;

  // On disk it lives as "<name>.enc", starts with the MAGIC, and has no plaintext.
  const encBytes = fs.readFileSync(path.join(TMP_VAULT, 'uploads', name + '.enc'));
  assert.equal(encBytes.subarray(0, 4).toString(), 'KVE1');
  assert.ok(
    !encBytes.includes(Buffer.from('canary-pixels')),
    'plaintext leaked into the encrypted upload file'
  );

  // Served back fully decrypted and byte-identical.
  const served = await fetch(base + '/uploads/' + name);
  assert.equal(served.status, 200);
  const got = Buffer.from(await served.arrayBuffer());
  assert.ok(got.equals(original), 'served bytes differ from the original');

  // Range requests work (used by <audio> seeking).
  const ranged = await fetch(base + '/uploads/' + name, {
    headers: { Range: 'bytes=0-3' },
  });
  assert.equal(ranged.status, 206);
  const part = Buffer.from(await ranged.arrayBuffer());
  assert.ok(part.equals(original.subarray(0, 4)));
});

test('memories: create with a tagged person, then cascade on person delete', async () => {
  // person to tag in the memory
  let res = await api('POST', '/api/people', { name: 'Bob' });
  const personId = res.body.id;

  // create a memory tagging that person
  res = await api('POST', '/api/memories', {
    title: 'Trip to the lake',
    memory_date: '2025-07-04',
    description: 'A sunny day',
    personIds: [personId],
  });
  assert.equal(res.status, 201);
  const memId = res.body.id;
  assert.equal(res.body.title, 'Trip to the lake');
  assert.equal(res.body.people.length, 1);
  assert.equal(res.body.people[0].name, 'Bob');
  assert.deepEqual(res.body.media, []);

  // it shows up in the list
  res = await api('GET', '/api/memories');
  assert.ok(res.body.some((m) => m.id === memId));

  // a memory requires a title
  res = await api('POST', '/api/memories', { description: 'no title' });
  assert.equal(res.status, 400);

  // deleting the person cascades the tag away (ON DELETE CASCADE + foreign_keys)
  res = await api('DELETE', `/api/people/${personId}`);
  assert.equal(res.status, 200);

  res = await api('GET', `/api/memories/${memId}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.people, []);
});

test('backup round-trip: portable .kvault restores and rejects a wrong passphrase', async () => {
  // Seed a fact and a photo memory.
  let res = await api('POST', '/api/facts', { label: 'backup', value: 'restore-me-please' });
  const factId = res.body.id;

  const photo = Buffer.from('BACKUP-PHOTO-BYTES-abcdef-0123456789');
  const form = new FormData();
  form.set('title', 'Backup photo memory');
  form.set('photos', new Blob([photo], { type: 'image/png' }), 'b.png');
  res = await fetch(base + '/api/memories', { method: 'POST', body: form });
  const photoName = (await res.json()).media[0].file_path;

  // Download a passphrase-encrypted backup.
  const dl = await fetch(base + '/api/backup/download', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passphrase: 'correct-pw' }),
  });
  assert.equal(dl.status, 200);
  const kvault = Buffer.from(await dl.arrayBuffer());
  assert.equal(kvault.subarray(0, 4).toString(), 'KVB1'); // encrypted, not a raw zip

  // Mutate: delete the fact.
  await api('DELETE', `/api/facts/${factId}`);
  res = await api('GET', '/api/facts');
  assert.ok(!res.body.some((f) => f.id === factId));

  // A wrong passphrase is rejected.
  const badForm = new FormData();
  badForm.set('passphrase', 'wrong');
  badForm.set('backup', new Blob([kvault]), 'b.kvault');
  let rest = await fetch(base + '/api/backup/restore', { method: 'POST', body: badForm });
  assert.equal(rest.status, 400);

  // The correct passphrase restores everything.
  const goodForm = new FormData();
  goodForm.set('passphrase', 'correct-pw');
  goodForm.set('backup', new Blob([kvault]), 'b.kvault');
  rest = await fetch(base + '/api/backup/restore', { method: 'POST', body: goodForm });
  assert.equal(rest.status, 200);

  // The fact is back...
  res = await api('GET', '/api/facts');
  assert.ok(res.body.some((f) => f.value === 'restore-me-please'));

  // ...and the photo decrypts to the original bytes.
  const served = await fetch(base + '/uploads/' + photoName);
  assert.equal(served.status, 200);
  assert.ok(Buffer.from(await served.arrayBuffer()).equals(photo));
});

test('security: status, then enable / change / remove the vault passphrase', async () => {
  let res = await api('GET', '/api/security/status');
  assert.equal(res.status, 200);
  assert.equal(res.body.encrypted, true);
  assert.equal(res.body.hasPassphrase, false);

  // Too short is rejected.
  res = await api('POST', '/api/security/passphrase', { passphrase: 'abc' });
  assert.equal(res.status, 400);

  // Enable.
  res = await api('POST', '/api/security/passphrase', { passphrase: 'first-pass' });
  assert.equal(res.status, 200);
  assert.equal(res.body.hasPassphrase, true);

  res = await api('GET', '/api/security/status');
  assert.equal(res.body.hasPassphrase, true);

  // Change with a wrong current passphrase is rejected.
  res = await api('POST', '/api/security/passphrase', {
    passphrase: 'second-pass',
    current: 'wrong',
  });
  assert.equal(res.status, 400);

  // Change with the correct current passphrase.
  res = await api('POST', '/api/security/passphrase', {
    passphrase: 'second-pass',
    current: 'first-pass',
  });
  assert.equal(res.status, 200);

  // Remove with a wrong current passphrase is rejected.
  res = await api('DELETE', '/api/security/passphrase', { current: 'nope' });
  assert.equal(res.status, 400);

  // Remove with the correct current passphrase.
  res = await api('DELETE', '/api/security/passphrase', { current: 'second-pass' });
  assert.equal(res.status, 200);
  assert.equal(res.body.hasPassphrase, false);
});
