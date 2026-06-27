const express = require('express');
const { db } = require('../db');

const router = express.Router();

// GET /api/search?q=term — search across people, memories, facts, events.
// Returns a flat list of typed results for a unified results view.
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;

  const people = db
    .prepare(
      `SELECT id, name AS title, relationship AS subtitle, 'person' AS type
       FROM people
       WHERE name LIKE ? OR relationship LIKE ? OR notes LIKE ?`
    )
    .all(like, like, like);

  const memories = db
    .prepare(
      `SELECT id, title, memory_date AS subtitle, 'memory' AS type
       FROM memories
       WHERE title LIKE ? OR description LIKE ?`
    )
    .all(like, like);

  const facts = db
    .prepare(
      `SELECT id, label AS title, value AS subtitle, 'fact' AS type
       FROM facts
       WHERE label LIKE ? OR value LIKE ? OR category LIKE ?`
    )
    .all(like, like, like);

  const events = db
    .prepare(
      `SELECT id, title, event_date AS subtitle, 'event' AS type
       FROM timeline_events
       WHERE title LIKE ? OR description LIKE ?`
    )
    .all(like, like);

  res.json([...people, ...memories, ...facts, ...events]);
});

module.exports = router;
