const express = require('express');
const fs = require('fs');
const { exportVault, VAULT_DIR } = require('../obsidian');

const router = express.Router();

// POST /api/obsidian/export — regenerate the Obsidian vault from the database.
router.post('/export', (req, res) => {
  try {
    const result = exportVault();
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Export failed' });
  }
});

// GET /api/obsidian/status — whether a vault has been exported, where, and when.
router.get('/status', (req, res) => {
  const exists = fs.existsSync(VAULT_DIR);
  let lastExport = null;
  if (exists) {
    try {
      lastExport = fs.statSync(VAULT_DIR).mtime.toISOString();
    } catch {
      /* ignore */
    }
  }
  res.json({ exists, path: VAULT_DIR, lastExport });
});

module.exports = router;
