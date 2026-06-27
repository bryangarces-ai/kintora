const fs = require('fs');
const path = require('path');
const { db, UPLOADS_DIR, DATA_DIR } = require('./db');

// Where the generated Obsidian vault is written. It's a one-way snapshot: each
// export wipes and regenerates this folder from the database.
const VAULT_DIR = path.join(DATA_DIR, 'obsidian-vault');
const ATTACH_DIR = path.join(VAULT_DIR, 'attachments');

// Make a string safe to use as a Windows/macOS/Linux filename.
function sanitize(name) {
  const cleaned = (name || 'Untitled')
    .replace(/[\\/:*?"<>|#^[\]]/g, '-') // illegal filename + Obsidian-special chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || 'Untitled';
}

const key = (type, id) => `${type}-${id}`;

function entityLabel(type, row) {
  if (type === 'person') return row.name;
  if (type === 'fact') return row.label;
  return row.title; // memory, event
}

function exportVault() {
  // --- Load everything ---
  const people = db.prepare('SELECT * FROM people').all();
  const memories = db.prepare('SELECT * FROM memories').all();
  const facts = db.prepare('SELECT * FROM facts').all();
  const events = db.prepare('SELECT * FROM timeline_events').all();
  const media = db.prepare('SELECT * FROM memory_media').all();
  const memPeople = db.prepare('SELECT * FROM memory_people').all();
  const links = db.prepare('SELECT * FROM links').all();

  // --- Assign a unique note name to every entity (so [[links]] resolve) ---
  const used = new Set();
  const noteName = new Map();
  const register = (type, rows) => {
    for (const row of rows) {
      const base = sanitize(entityLabel(type, row));
      let name = base;
      if (used.has(name.toLowerCase())) name = `${base} (${row.id})`;
      if (used.has(name.toLowerCase())) name = `${base} (${type} ${row.id})`;
      used.add(name.toLowerCase());
      noteName.set(key(type, row.id), name);
    }
  };
  register('person', people);
  register('memory', memories);
  register('fact', facts);
  register('event', events);

  // --- Build undirected adjacency from memory_people + links ---
  const adj = new Map();
  const addEdge = (a, b) => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  };
  for (const mp of memPeople) {
    addEdge(key('memory', mp.memory_id), key('person', mp.person_id));
  }
  for (const l of links) {
    addEdge(key(l.source_type, l.source_id), key(l.target_type, l.target_id));
  }

  const mediaByMemory = new Map();
  for (const m of media) {
    if (!mediaByMemory.has(m.memory_id)) mediaByMemory.set(m.memory_id, []);
    mediaByMemory.get(m.memory_id).push(m);
  }

  // --- Reset the vault folder ---
  fs.rmSync(VAULT_DIR, { recursive: true, force: true });
  fs.mkdirSync(ATTACH_DIR, { recursive: true });
  for (const sub of ['People', 'Memories', 'Facts', 'Events']) {
    fs.mkdirSync(path.join(VAULT_DIR, sub), { recursive: true });
  }

  const copyAttachment = (filename) => {
    if (!filename) return null;
    const src = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(src)) return null;
    try {
      fs.copyFileSync(src, path.join(ATTACH_DIR, filename));
      return filename;
    } catch {
      return null;
    }
  };

  const connectionsSection = (k) => {
    const set = adj.get(k);
    if (!set || set.size === 0) return '';
    const items = [...set]
      .map((nk) => noteName.get(nk))
      .filter(Boolean)
      .map((n) => `- [[${n}]]`);
    return items.length ? `\n## Connections\n${items.join('\n')}\n` : '';
  };

  const write = (sub, name, content) => {
    fs.writeFileSync(path.join(VAULT_DIR, sub, `${name}.md`), content, 'utf8');
  };

  // --- People ---
  for (const p of people) {
    const name = noteName.get(key('person', p.id));
    const fm = ['---', 'type: person'];
    if (p.relationship) fm.push(`relationship: "${p.relationship}"`);
    if (p.birthday) fm.push(`birthday: ${p.birthday}`);
    fm.push('tags: [person]', '---', '');
    let body = `# ${p.name}\n`;
    if (p.relationship) body += `\n*${p.relationship}*\n`;
    const photo = copyAttachment(p.photo_path);
    if (photo) body += `\n![[attachments/${photo}]]\n`;
    if (p.notes) body += `\n${p.notes}\n`;
    body += connectionsSection(key('person', p.id));
    write('People', name, fm.join('\n') + body);
  }

  // --- Memories ---
  for (const m of memories) {
    const name = noteName.get(key('memory', m.id));
    const fm = ['---', 'type: memory'];
    if (m.memory_date) fm.push(`date: ${m.memory_date}`);
    fm.push('tags: [memory]', '---', '');
    let body = `# ${m.title}\n`;
    if (m.memory_date) body += `\n*${m.memory_date}*\n`;
    if (m.description) body += `\n${m.description}\n`;
    for (const f of mediaByMemory.get(m.id) || []) {
      const copied = copyAttachment(f.file_path);
      // Obsidian embeds both images and audio with the same ![[...]] syntax.
      if (copied) body += `\n![[attachments/${copied}]]\n`;
    }
    body += connectionsSection(key('memory', m.id));
    write('Memories', name, fm.join('\n') + body);
  }

  // --- Facts ---
  for (const f of facts) {
    const name = noteName.get(key('fact', f.id));
    const fm = ['---', 'type: fact'];
    if (f.category) fm.push(`category: ${f.category}`);
    fm.push('tags: [fact]', '---', '');
    let body = `# ${f.label}\n\n${f.value}\n`;
    body += connectionsSection(key('fact', f.id));
    write('Facts', name, fm.join('\n') + body);
  }

  // --- Events ---
  for (const e of events) {
    const name = noteName.get(key('event', e.id));
    const fm = ['---', 'type: event'];
    if (e.event_date) fm.push(`date: ${e.event_date}`);
    fm.push('tags: [event]', '---', '');
    let body = `# ${e.title}\n`;
    if (e.event_date) body += `\n*${e.event_date}*\n`;
    if (e.description) body += `\n${e.description}\n`;
    const photo = copyAttachment(e.photo_path);
    if (photo) body += `\n![[attachments/${photo}]]\n`;
    body += connectionsSection(key('event', e.id));
    write('Events', name, fm.join('\n') + body);
  }

  // --- Home note ---
  const home =
    `# Kintora\n\n` +
    `A generated snapshot of your vault, ready for Obsidian.\n\n` +
    `- People: ${people.length}\n` +
    `- Memories: ${memories.length}\n` +
    `- Important Info: ${facts.length}\n` +
    `- Events: ${events.length}\n\n` +
    `Open the **graph view** (the circle icon in Obsidian's left sidebar) to see ` +
    `how everything connects.\n\n` +
    `> ⚠️ This folder is generated by Kintora. Re-exporting **overwrites** it, ` +
    `so don't hand-edit notes here — make changes in the app and export again.\n`;
  fs.writeFileSync(path.join(VAULT_DIR, 'Kintora.md'), home, 'utf8');

  return {
    path: VAULT_DIR,
    counts: {
      people: people.length,
      memories: memories.length,
      facts: facts.length,
      events: events.length,
    },
  };
}

module.exports = { exportVault, VAULT_DIR };
