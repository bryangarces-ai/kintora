const path = require('path');
const express = require('express');
const cors = require('cors');

const { UPLOADS_DIR } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve uploaded photos/audio statically at /uploads/<filename>.
app.use('/uploads', express.static(UPLOADS_DIR));

// API routes
app.use('/api/people', require('./routes/people'));
app.use('/api/facts', require('./routes/facts'));
app.use('/api/memories', require('./routes/memories'));
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/search', require('./routes/search'));
app.use('/api/links', require('./routes/links'));
app.use('/api/graph', require('./routes/graph'));
app.use('/api/obsidian', require('./routes/obsidian'));
app.use('/api/backup', require('./routes/backup'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// In the packaged desktop app, Electron sets CLIENT_DIST to the built Angular
// app and we serve it from this same Express server (single origin → relative
// /api and /uploads calls just work, no CORS/proxy needed). In dev CLIENT_DIST
// is unset, so this block is skipped and Angular runs on :4200 with its proxy.
if (process.env.CLIENT_DIST) {
  app.use(express.static(process.env.CLIENT_DIST));
  // SPA fallback: any non-API, non-uploads GET returns index.html so Angular's
  // client-side router can handle the route.
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(process.env.CLIENT_DIST, 'index.html'));
  });
}

// Centralized error handler (e.g. multer file-size errors).
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Start the HTTP server. Returns the http.Server so callers (Electron) can
// await/inspect it; logs the URL on listen.
function start(port = PORT) {
  return app.listen(port, () => {
    console.log(`Kintora API running at http://localhost:${port}`);
  });
}

// Auto-start only when run directly (node src/index.js). When required by the
// Electron main process, it calls start() explicitly instead.
if (require.main === module) {
  start();
}

module.exports = { app, start };
