const express = require('express');
const { db } = require('../db');
const { upload } = require('../upload');
const { removeUpload } = require('../uploads-util');
const { removeEntityLinks } = require('../links-util');

const router = express.Router();

// GET /api/people — list all people, newest first
router.get('/', (req, res) => {
  const people = db
    .prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE')
    .all();
  res.json(people);
});

// GET /api/people/:id — one person + the memories they are tagged in
router.get('/:id', (req, res) => {
  const person = db
    .prepare('SELECT * FROM people WHERE id = ?')
    .get(req.params.id);
  if (!person) return res.status(404).json({ error: 'Person not found' });

  const memories = db
    .prepare(
      `SELECT m.* FROM memories m
       JOIN memory_people mp ON mp.memory_id = m.id
       WHERE mp.person_id = ?
       ORDER BY COALESCE(m.memory_date, m.created_at) DESC`
    )
    .all(req.params.id);

  res.json({ ...person, memories });
});

// POST /api/people — create (multipart: fields + optional photo)
router.post('/', upload.single('photo'), (req, res) => {
  const { name, relationship, birthday, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const photo_path = req.file ? req.file.filename : null;
  const info = db
    .prepare(
      `INSERT INTO people (name, relationship, birthday, photo_path, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(name.trim(), relationship || null, birthday || null, photo_path, notes || null);

  const person = db
    .prepare('SELECT * FROM people WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(person);
});

// PUT /api/people/:id — update (multipart; replaces photo if a new one is sent)
router.put('/:id', upload.single('photo'), (req, res) => {
  const existing = db
    .prepare('SELECT * FROM people WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Person not found' });

  const { name, relationship, birthday, notes } = req.body;
  let photo_path = existing.photo_path;
  if (req.file) {
    removeUpload(existing.photo_path);
    photo_path = req.file.filename;
  }

  db.prepare(
    `UPDATE people
     SET name = ?, relationship = ?, birthday = ?, photo_path = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    (name ?? existing.name).trim(),
    relationship ?? existing.relationship,
    birthday ?? existing.birthday,
    photo_path,
    notes ?? existing.notes,
    req.params.id
  );

  const person = db
    .prepare('SELECT * FROM people WHERE id = ?')
    .get(req.params.id);
  res.json(person);
});

// DELETE /api/people/:id
router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM people WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Person not found' });

  db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  removeEntityLinks('person', parseInt(req.params.id, 10));
  removeUpload(existing.photo_path);
  res.json({ ok: true });
});

module.exports = router;
