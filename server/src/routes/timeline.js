const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, UPLOADS_DIR } = require('../db');
const { upload } = require('../upload');
const { removeEntityLinks } = require('../links-util');

const router = express.Router();

function removeUpload(relPath) {
  if (!relPath) return;
  try {
    fs.unlinkSync(path.join(UPLOADS_DIR, relPath));
  } catch (_) {
    /* ignore */
  }
}

// GET /api/timeline — events sorted chronologically
router.get('/', (req, res) => {
  const events = db
    .prepare('SELECT * FROM timeline_events ORDER BY event_date ASC, id ASC')
    .all();
  res.json(events);
});

// POST /api/timeline
router.post('/', upload.single('photo'), (req, res) => {
  const { event_date, title, description } = req.body;
  if (!event_date || !title || !title.trim()) {
    return res.status(400).json({ error: 'Date and title are required' });
  }
  const photo_path = req.file ? req.file.filename : null;
  const info = db
    .prepare(
      'INSERT INTO timeline_events (event_date, title, description, photo_path) VALUES (?, ?, ?, ?)'
    )
    .run(event_date, title.trim(), description || null, photo_path);
  const event = db
    .prepare('SELECT * FROM timeline_events WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(event);
});

// PUT /api/timeline/:id
router.put('/:id', upload.single('photo'), (req, res) => {
  const existing = db
    .prepare('SELECT * FROM timeline_events WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });

  const { event_date, title, description } = req.body;
  let photo_path = existing.photo_path;
  if (req.file) {
    removeUpload(existing.photo_path);
    photo_path = req.file.filename;
  }

  db.prepare(
    `UPDATE timeline_events
     SET event_date = ?, title = ?, description = ?, photo_path = ?
     WHERE id = ?`
  ).run(
    event_date ?? existing.event_date,
    (title ?? existing.title).trim(),
    description ?? existing.description,
    photo_path,
    req.params.id
  );
  const event = db
    .prepare('SELECT * FROM timeline_events WHERE id = ?')
    .get(req.params.id);
  res.json(event);
});

// DELETE /api/timeline/:id
router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM timeline_events WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  db.prepare('DELETE FROM timeline_events WHERE id = ?').run(req.params.id);
  removeEntityLinks('event', parseInt(req.params.id, 10));
  removeUpload(existing.photo_path);
  res.json({ ok: true });
});

module.exports = router;
