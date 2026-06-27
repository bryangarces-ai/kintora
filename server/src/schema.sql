PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS people (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  relationship  TEXT,                 -- e.g. "wife", "son", "friend"
  birthday      TEXT,                 -- ISO date string
  photo_path    TEXT,                 -- relative path under uploads/
  notes         TEXT,                 -- free-text memories about this person
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memories (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  memory_date   TEXT,                 -- when it happened (ISO date)
  description   TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- Photos/audio attached to a memory (many per memory)
CREATE TABLE IF NOT EXISTS memory_media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id     INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,        -- relative path under uploads/
  media_type    TEXT                  -- 'image' | 'audio'
);

-- Which people appear in a memory (many-to-many)
CREATE TABLE IF NOT EXISTS memory_people (
  memory_id     INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  person_id     INTEGER NOT NULL REFERENCES people(id)  ON DELETE CASCADE,
  PRIMARY KEY (memory_id, person_id)
);

-- Critical info: medical, address, preferences, etc.
CREATE TABLE IF NOT EXISTS facts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT,                 -- 'medical' | 'contact' | 'preference' | 'other'
  label         TEXT NOT NULL,        -- e.g. "Home address", "Blood type"
  value         TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_date    TEXT NOT NULL,        -- ISO date
  title         TEXT NOT NULL,
  description   TEXT,
  photo_path    TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Generic, undirected connections between any two entities (people, memories,
-- facts, events). Powers the Connections graph. Pairs are stored in a canonical
-- order (see routes/links.js) so the UNIQUE constraint blocks reversed dupes.
CREATE TABLE IF NOT EXISTS links (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type   TEXT NOT NULL,        -- 'person' | 'memory' | 'fact' | 'event'
  source_id     INTEGER NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     INTEGER NOT NULL,
  created_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(source_type, source_id, target_type, target_id)
);
