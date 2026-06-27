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

// Parse personIds coming from multipart form-data. It may arrive as a single
// value, an array, or a JSON string — normalize to an array of numbers.
function parsePersonIds(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [raw];
    } catch (_) {
      arr = [raw];
    }
  }
  if (!Array.isArray(arr)) arr = [arr];
  return arr
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isInteger(n));
}

// Attach media rows + tagged people to a memory object.
function hydrate(memory) {
  const media = db
    .prepare('SELECT * FROM memory_media WHERE memory_id = ?')
    .all(memory.id);
  const people = db
    .prepare(
      `SELECT p.* FROM people p
       JOIN memory_people mp ON mp.person_id = p.id
       WHERE mp.memory_id = ?
       ORDER BY p.name COLLATE NOCASE`
    )
    .all(memory.id);
  return { ...memory, media, people };
}

function setPeople(memoryId, personIds) {
  db.prepare('DELETE FROM memory_people WHERE memory_id = ?').run(memoryId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO memory_people (memory_id, person_id) VALUES (?, ?)'
  );
  for (const pid of personIds) insert.run(memoryId, pid);
}

function addMedia(memoryId, files) {
  const insert = db.prepare(
    'INSERT INTO memory_media (memory_id, file_path, media_type) VALUES (?, ?, ?)'
  );
  for (const f of files || []) {
    const type = f.mimetype.startsWith('audio') ? 'audio' : 'image';
    insert.run(memoryId, f.filename, type);
  }
}

// GET /api/memories — list, newest first (by memory_date, falling back to created_at)
router.get('/', (req, res) => {
  const memories = db
    .prepare(
      `SELECT * FROM memories
       ORDER BY COALESCE(memory_date, created_at) DESC, id DESC`
    )
    .all();
  res.json(memories.map(hydrate));
});

// GET /api/memories/:id
router.get('/:id', (req, res) => {
  const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
  if (!memory) return res.status(404).json({ error: 'Memory not found' });
  res.json(hydrate(memory));
});

// POST /api/memories — fields + photos[] + personIds
router.post('/', upload.array('photos', 20), (req, res) => {
  const { title, memory_date, description } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const info = db
    .prepare(
      'INSERT INTO memories (title, memory_date, description) VALUES (?, ?, ?)'
    )
    .run(title.trim(), memory_date || null, description || null);
  const memoryId = info.lastInsertRowid;

  setPeople(memoryId, parsePersonIds(req.body.personIds));
  addMedia(memoryId, req.files);

  const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(memoryId);
  res.status(201).json(hydrate(memory));
});

// PUT /api/memories/:id — update fields, replace people set, append any new photos
router.put('/:id', upload.array('photos', 20), (req, res) => {
  const existing = db
    .prepare('SELECT * FROM memories WHERE id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Memory not found' });

  const { title, memory_date, description } = req.body;
  db.prepare(
    `UPDATE memories
     SET title = ?, memory_date = ?, description = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    (title ?? existing.title).trim(),
    memory_date ?? existing.memory_date,
    description ?? existing.description,
    req.params.id
  );

  if (req.body.personIds !== undefined) {
    setPeople(req.params.id, parsePersonIds(req.body.personIds));
  }
  addMedia(req.params.id, req.files);

  const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id);
  res.json(hydrate(memory));
});

// DELETE /api/memories/:id/media/:mediaId — remove a single attachment
router.delete('/:id/media/:mediaId', (req, res) => {
  const media = db
    .prepare('SELECT * FROM memory_media WHERE id = ? AND memory_id = ?')
    .get(req.params.mediaId, req.params.id);
  if (!media) return res.status(404).json({ error: 'Media not found' });
  db.prepare('DELETE FROM memory_media WHERE id = ?').run(req.params.mediaId);
  removeUpload(media.file_path);
  res.json({ ok: true });
});

// DELETE /api/memories/:id
router.delete('/:id', (req, res) => {
  const media = db
    .prepare('SELECT file_path FROM memory_media WHERE memory_id = ?')
    .all(req.params.id);
  const info = db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Memory not found' });
  removeEntityLinks('memory', parseInt(req.params.id, 10));
  media.forEach((m) => removeUpload(m.file_path));
  res.json({ ok: true });
});

module.exports = router;
