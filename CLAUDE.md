# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Kintora — non-negotiable constraints
- **100% offline.** No cloud, no auth, no telemetry. Any future AI must be a **local** model (e.g. Ollama). Browser `SpeechRecognition` is banned (sends audio to Google); use offline voice notes + local `speechSynthesis`.
- Use **Angular 20** (not latest); Node 22.x.
- **Real personal data.** Never delete/overwrite a vault. Live vault: `%APPDATA%\Kintora\vault\` (db + `uploads/`); dev vault: `server/data/`. Back up before risky ops (Backup page or copy the folder).
- **C: drive runs near-full** (has hit 0 bytes). `electron:build` needs ~1GB; `npm cache clean --force` to recover space before installing.

## Commands (from root)
- `npm run electron:dev` — desktop app vs source (run `npm run build:client` first)
- `npm run electron:build` — package → `dist-desktop/`
- Dev (two terminals): `cd server && npm start` (:3000), `cd client && npm start` (:4200, proxies `/api`+`/uploads`)
- Tests: client only — `npm --prefix client test` (`ng test`). No backend tests; verify via `/api/health` + manual smoke test.

## Architecture
- `server/` Express + better-sqlite3 (WAL). Routes `server/src/routes/*` mount at `/api/*` in `index.js`. Data dir = `MEMORY_VAULT_DATA_DIR` env or `server/data/`.
- `client/` Angular 20 standalone + signals + Tailwind v4; lazy routes in `app.routes.ts`.
- `electron/main.js` sets env, starts Express in-process, serves built Angular at single origin :3000.
- **Native module:** `better-sqlite3` is rebuilt for Electron's ABI in **root** `node_modules`; never recreate `server/node_modules` (wrong-ABI shadow).
