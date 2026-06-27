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
