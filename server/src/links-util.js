const { db } = require('./db');

// The links table has no foreign keys (it references four different tables
// polymorphically), so when an entity is deleted its link rows must be removed
// explicitly to avoid orphans. Call this from each entity's DELETE handler.
function removeEntityLinks(type, id) {
  db.prepare(
    `DELETE FROM links
     WHERE (source_type = ? AND source_id = ?)
        OR (target_type = ? AND target_id = ?)`
  ).run(type, id, type, id);
}

module.exports = { removeEntityLinks };
