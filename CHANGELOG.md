# Changelog

All notable changes to **Kintora** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-06-27

### Added
- Backend test suite for the Express API using Node's built-in test runner
  (`node --test`) — covers health, people CRUD + validation, facts, and memory
  creation with person tagging and cascade-on-delete. Runs against a temporary
  throwaway vault so real data is never touched.
- CI now builds and tests the server in addition to the client.

### Changed
- No user-facing behavior changes; this release is internal hardening only.

## [1.0.0] — 2026-06-27

First public release.

### Added
- **Recall** — large-text, read-only daily briefing (people, birthdays/anniversaries,
  "on this day" memories, key facts), built for easy reading and read-aloud.
- **People** — profiles with name, relationship, birthday, photo, and notes.
- **Memories** — journal entries with date, description, photos, linked people,
  and offline voice notes; entries can be read aloud.
- **Facts** and **Events/Timeline** views.
- **Connections** — graph view of people and memories.
- **Obsidian export** of the vault.
- **Backup & Restore** of the full local vault.
- **Desktop app** — packaged Windows portable `.exe` and installer (Electron).
- **100% offline** — local SQLite storage, local speech synthesis, no cloud, no
  telemetry, no auth.

[1.0.1]: https://github.com/bryangarces-ai/kintora/releases/tag/v1.0.1
[1.0.0]: https://github.com/bryangarces-ai/kintora/releases/tag/v1.0.0
