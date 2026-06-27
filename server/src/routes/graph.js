const express = require('express');
const { db } = require('../db');

const router = express.Router();

// Build a node id namespaced by type, e.g. "person-1", so ids are unique across
// the four entity tables.
function nodeId(type, id) {
  return `${type}-${id}`;
}

// GET /api/graph — the whole vault as { nodes, edges } for the Connections view.
// Edges come from two sources: the existing memory_people join (people tagged in
// memories) plus the generic links table (everything else).
router.get('/', (req, res) => {
  const nodes = [];

  const people = db.prepare('SELECT id, name FROM people').all();
  for (const p of people) {
    nodes.push({ id: nodeId('person', p.id), type: 'person', entityId: p.id, label: p.name });
  }

  const memories = db.prepare('SELECT id, title FROM memories').all();
  for (const m of memories) {
    nodes.push({ id: nodeId('memory', m.id), type: 'memory', entityId: m.id, label: m.title });
  }

  const facts = db.prepare('SELECT id, label FROM facts').all();
  for (const f of facts) {
    nodes.push({ id: nodeId('fact', f.id), type: 'fact', entityId: f.id, label: f.label });
  }

  const events = db.prepare('SELECT id, title FROM timeline_events').all();
  for (const e of events) {
    nodes.push({ id: nodeId('event', e.id), type: 'event', entityId: e.id, label: e.title });
  }

  // Set of valid node ids so we can prune any dangling edges defensively.
  const valid = new Set(nodes.map((n) => n.id));
  const edges = [];

  // Edges from people tagged in memories.
  const mp = db.prepare('SELECT memory_id, person_id FROM memory_people').all();
  for (const row of mp) {
    const from = nodeId('memory', row.memory_id);
    const to = nodeId('person', row.person_id);
    if (valid.has(from) && valid.has(to)) edges.push({ from, to });
  }

  // Edges from the generic links table.
  const links = db
    .prepare('SELECT source_type, source_id, target_type, target_id FROM links')
    .all();
  for (const row of links) {
    const from = nodeId(row.source_type, row.source_id);
    const to = nodeId(row.target_type, row.target_id);
    if (valid.has(from) && valid.has(to)) edges.push({ from, to });
  }

  res.json({ nodes, edges });
});

module.exports = router;
