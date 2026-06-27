# Kintora

[![CI](https://github.com/bryangarces-ai/kintora/actions/workflows/ci.yml/badge.svg)](https://github.com/bryangarces-ai/kintora/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Kintora** — *your people, your moments, kept close.*

A **local, offline** app to capture and preserve your important memories, the
people in your life, critical facts, and key life events — so they're never lost.

Everything is stored on **your own computer**, **encrypted at rest**. Nothing is
sent to the internet.

## What it does

- **Recall** — a calm, large-text, read-only "Today" screen: a daily briefing of
  who's in your life, birthdays/anniversaries, "on this day" memories, and key
  facts. Built for easy reading by a future self or a caregiver.
- **People** — profiles with name, relationship, birthday, photo, and notes
- **Memories** — journal entries with date, description, photos, the people in
  them, and **voice notes** you record in your own voice (offline); entries can
  be **read aloud** with one tap
- **Read aloud** — the Recall briefing and individual memories can be spoken
  using your computer's built-in voice (runs locally, nothing is sent online)
- **Facts** — critical info: medical, contacts, address, preferences
- **Timeline** — your life events in chronological order
- **Connections** — an interactive 3D graph that links people, memories, facts, and
  events into one web; tag entries to each other and click any node to open it
- **Obsidian Map** — export the whole vault as an Obsidian-ready folder (Markdown
  notes + `[[links]]` + photos) to explore it in Obsidian's graph, with room to
  add an AI assistant later
- **Backup & Restore** — save your whole vault (database + photos) to a single
  `.zip` file, and restore it later (with an automatic safety copy taken first)
- **Dashboard** — recent activity and quick-add shortcuts
- **Search** — find anything across all of the above

## Architecture

```
Angular 20 app (http://localhost:4200)   — standalone components, signals, Tailwind CSS
        |  HTTP REST  (dev-server proxy forwards /api and /uploads → :3000)
        v
Express API  (http://localhost:3000)
        |
        +-- SQLite      ->  server/data/memory-vault.db
        +-- filesystem  ->  server/data/uploads/   (photos, audio)
```

The frontend talks to the backend through Angular's dev-server proxy
(`client/proxy.conf.json`), so both run side by side with no CORS fuss in
development.

## Requirements

- [Node.js](https://nodejs.org/) **20.19+ or 22.12+** (required by Angular 20; includes npm)

## Running the app

### Option A — Desktop app (recommended, no terminals)

Build it once into a double-clickable Windows app:

```bash
npm install          # at the project root, first time only
npm run electron:build
```

This produces, in **`dist-desktop/`**:
- **`MemoryVault-portable.exe`** — a single file you can double-click or copy to a
  USB drive; no installation needed.
- **`MemoryVault-Setup.exe`** — an installer that adds Start Menu / desktop
  shortcuts (installs per-user, no admin required).

Your data is stored at **`%APPDATA%\Memory Vault\vault\`** (the database, your
photos/audio, and the Obsidian export). To back it up, copy that folder.

To run the desktop app in development (against your source, no packaging):

```bash
npm install              # root, first time only
npm run build:client     # build the Angular UI
npm run electron:dev     # opens the app in a window
```

### Option B — Two terminals (web/dev mode)

**Terminal 1 — backend:**
```bash
cd server
npm install        # first time only
npm start          # API on http://localhost:3000
```

**Terminal 2 — frontend:**
```bash
cd client
npm install        # first time only
npm start          # app on http://localhost:4200
```

Then open <http://localhost:4200> in your browser.

## Your data

Where your data lives depends on how you run the app:
- **Desktop app:** `%APPDATA%\Memory Vault\vault\`
- **Two-terminal dev mode:** `server/data/`

Either folder contains everything:
- `memory-vault.db` — the database
- `uploads/` — your photos and audio
- `obsidian-vault/` — the latest Obsidian export (if you've exported)

To **back up**, copy that whole folder somewhere safe (an external drive, etc.).
To **restore**, put it back. That folder is everything.

> Your data folders are excluded from git on purpose — your private memories
> should never be committed to a repository.

## Roadmap (future phases)

- ✅ **Recall mode** — done (see the Recall page): a large-text daily briefing.
- **AI assistant** — ask questions about your own memories. (Note: this would
  involve an AI service, which conflicts with the current offline-only design —
  it will be revisited, possibly with a fully local model.)
- ✅ **Desktop packaging** — done. A double-click Windows app (portable `.exe`
  and an installer), no terminals needed. See "Running the app" above.
- ✅ **Backup & Restore** — done (see the Backup page). Encrypting the backup
  file is a possible future add-on.
- **Multiple profiles** — separate vaults for different people in one install
  (kept local; no cloud).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The one rule:
Kintora stays **100% offline**, and personal data is never committed. Security or
privacy issues? See [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE) — © 2026 Bryan Garces
([@bryangarces-ai](https://github.com/bryangarces-ai)).
