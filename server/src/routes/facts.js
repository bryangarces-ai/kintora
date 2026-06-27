const express = require('express');
const { db } = require('../db');
const { removeEntityLinks } = require('../links-util');

const router = express.Router();

// GET /api/facts — all facts, ordered by category then label
router.get('/', (req, res) => {
  const facts = db
    .prepare(
      `SELECT * FROM facts
       ORDER BY category COLLATE NOCASE, label COLLATE NOCASE`
    )
    .all();
  res.json(facts);
});

// POST /api/facts
router.post('/', (req, res) => {
  const { category, label, value } = req.body;
  if (!label || !value) {
    return res.status(400).json({ error: 'Label and value are required' });
  }
  const info = db
    .prepare('INSERT INTO facts (category, label, value) VALUES (?, ?, ?)')
    .run(category || 'other', label, value);
  const fact = db
    .prepare('SELECT * FROM facts WHERE id = ?')
    .get(info.lastInsertRowid);
  res.status(201).json(fact);
});

// PUT /api/facts/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM facts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Fact not found' });

  const { category, label, value } = req.body;
  db.prepare(
    `UPDATE facts SET category = ?, label = ?, value = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    category ?? existing.category,
    label ?? existing.label,
    value ?? existing.value,
    req.params.id
  );
  const fact = db.prepare('SELECT * FROM facts WHERE id = ?').get(req.params.id);
  res.json(fact);
});

// DELETE /api/facts/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM facts WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Fact not found' });
  removeEntityLinks('fact', parseInt(req.params.id, 10));
  res.json({ ok: true });
});

module.exports = router;
