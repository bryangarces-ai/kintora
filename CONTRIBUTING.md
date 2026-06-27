# Contributing to Kintora

Thanks for your interest in Kintora! Contributions are welcome.

## The one non-negotiable rule: stay 100% offline

Kintora is a **local, offline** app. Any contribution **must not** add cloud
services, accounts, telemetry, analytics, or anything that sends user data over
the network. Any future AI must run **locally** (e.g. Ollama). Browser
`SpeechRecognition` is banned (it sends audio to Google) — use offline voice
notes and local `speechSynthesis`.

## Never commit personal data

The vault (`server/data/`, `*.db`, `uploads/`, `obsidian-vault/`) is git-ignored
on purpose. Never commit a database, photos, audio, or anyone's memories.

## Development setup

Requirements: **Node 22.x**, **Angular 20**.

```bash
# install deps (from repo root)
npm install
npm --prefix client install
npm --prefix server install

# dev — two terminals
cd server && npm start     # API on :3000
cd client && npm start     # Angular on :4200 (proxies /api + /uploads)

# desktop app vs source
npm run build:client
npm run electron:dev

# package the desktop app
npm run electron:build     # -> dist-desktop/
```

## Tests

- Client: `npm --prefix client test` (`ng test`).
- Server: no automated tests yet — verify via `/api/health` and a manual smoke test.

## Pull requests

1. Fork and create a feature branch.
2. Keep changes focused; match the surrounding code style.
3. Confirm the offline + no-personal-data rules above.
4. Describe what you changed and how you tested it.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what happened.
Please **do not** include real personal data in bug reports.
