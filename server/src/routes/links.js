const express = require('express');
const { db } = require('../db');

const router = express.Router();

// Map an entity "type" to its table and the column used as a human label.
const ENTITY = {
  person: { table: 'people', label: 'name' },
  memory: { table: 'memories', label: 'title' },
  fact: { table: 'facts', label: 'label' },
  event: { table: 'timeline_events', label: 'title' },
};

function isValidType(t) {
  return Object.prototype.hasOwnProperty.call(ENTITY, t);
}

// Resolve an entity's label, or null if it doesn't exist.
function labelOf(type, id) {
  const meta = ENTITY[type];
  if (!meta) return null;
  const row = db
    .prepare(`SELECT ${meta.label} AS label FROM ${meta.table} WHERE id = ?`)
    .get(id);
  return row ? row.label : null;
}

// Order a pair canonically (by type, then id) so a↔b and b↔a are stored once.
function canonical(aType, aId, bType, bId) {
  const a = [aType, aId];
  const b = [bType, bId];
  const first = a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? a : b;
  const second = first === a ? b : a;
  return {
    source_type: first[0],
    source_id: first[1],
    target_type: second[0],
    target_id: second[1],
  };
}

// GET /api/links?type=person&id=1 — all links touching this entity, with the
// label of the *other* end resolved for display.
router.get('/', (req, res) => {
  const { type, id } = req.query;
  if (!isValidType(type) || !id) {
    return res.status(400).json({ error: 'Valid type and id are required' });
  }
  const entityId = parseInt(id, 10);

  const rows = db
    .prepare(
      `SELECT * FROM links
       WHERE (source_type = ? AND source_id = ?)
          OR (target_type = ? AND target_id = ?)`
    )
    .all(type, entityId, type, entityId);

  const results = rows.map((row) => {
    // Determine which end is "the other" relative to the queried entity.
    const isSource = row.source_type === type && row.source_id === entityId;
    const otherType = isSource ? row.target_type : row.source_type;
    const otherId = isSource ? row.target_id : row.source_id;
    return {
      id: row.id,
      other_type: otherType,
      other_id: otherId,
      other_label: labelOf(otherType, otherId),
    };
  });

  res.json(results);
});

// POST /api/links — body { source_type, source_id, target_type, target_id }
router.post('/', (req, res) => {
  const { source_type, source_id, target_type, target_id } = req.body;

  if (!isValidType(source_type) || !isValidType(target_type)) {
    return res.status(400).json({ error: 'Invalid entity type' });
  }
  const sId = parseInt(source_id, 10);
  const tId = parseInt(target_id, 10);
  if (!Number.isInteger(sId) || !Number.isInteger(tId)) {
    return res.status(400).json({ error: 'Invalid entity id' });
  }
  if (source_type === target_type && sId === tId) {
    return res.status(400).json({ error: 'Cannot link an entity to itself' });
  }
  if (labelOf(source_type, sId) === null || labelOf(target_type, tId) === null) {
    return res.status(404).json({ error: 'One or both entities do not exist' });
  }

  const link = canonical(source_type, sId, target_type, tId);

  // Idempotent: UNIQUE constraint means re-linking the same pair is a no-op.
  db.prepare(
    `INSERT OR IGNORE INTO links (source_type, source_id, target_type, target_id)
     VALUES (?, ?, ?, ?)`
  ).run(link.source_type, link.source_id, link.target_type, link.target_id);

  const row = db
    .prepare(
      `SELECT * FROM links
       WHERE source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?`
    )
    .get(link.source_type, link.source_id, link.target_type, link.target_id);

  res.status(201).json(row);
});

// DELETE /api/links/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Link not found' });
  res.json({ ok: true });
});

module.exports = router;
