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
# The vault is encrypted, so the server needs a key (64 hex chars) in dev.
# The desktop app sets this automatically; in two-terminal mode, set it yourself:
#   bash:        export KINTORA_VAULT_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
#   PowerShell:  $env:KINTORA_VAULT_KEY = (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# Use the SAME key every run to reopen the same dev vault (server/data/).
cd server && npm start     # API on :3000
cd client && npm start     # Angular on :4200 (proxies /api + /uploads)

# desktop app vs source
npm run build:client
npm run electron:dev

# package the desktop app
npm run electron:build     # -> dist-desktop/
```

## Tests

Run both suites before opening a PR — CI runs the same two jobs and they must
pass before a PR can merge:

- **Client:** `npm --prefix client test -- --watch=false --browsers=ChromeHeadless`
- **Server:** `npm --prefix server test` (Node's built-in test runner). The tests
  set their own throwaway `KINTORA_VAULT_KEY` and run against a temporary vault,
  so they never touch real data.

It's also good practice to smoke-test the desktop app (`npm run build:client`
then `npm run electron:dev`) for anything touching uploads, encryption, or the
Electron layer.

## Pull requests

`main` is protected — **nobody pushes to it directly, including the maintainer.**
All changes land through pull requests. The flow:

1. **Fork** the repo to your own account, then clone your fork.
2. Create a focused **feature branch** (e.g. `fix/voice-note-seeking`).
3. Make your change; match the surrounding code style and keep the diff tight.
4. Confirm the **offline** and **no-personal-data** rules above still hold.
5. Run both test suites locally (see above).
6. Push to your fork and **open a PR** against `main`.
7. CI (client + server) must go green, and any review conversations must be
   resolved, before the PR can be merged. The maintainer reviews and merges —
   you don't need (and won't have) direct write access to `main`.

Small, well-described PRs get reviewed fastest. Tell us **what** changed and
**how you tested it**.

## Reporting bugs

Open an issue with steps to reproduce, what you expected, and what happened.
Please **do not** include real personal data in bug reports.
