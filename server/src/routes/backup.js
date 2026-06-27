const express = require('express');
const multer = require('multer');
const { createBackupBuffer, restoreFromBuffer } = require('../backup');

const router = express.Router();

// Hold the uploaded backup in memory (it's a one-shot restore); cap at 1 GB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 },
});

// GET /api/backup/download — stream the whole vault as a .zip attachment.
router.get('/download', async (req, res, next) => {
  try {
    const buf = await createBackupBuffer();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kintora-backup-${date}.zip"`
    );
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

// POST /api/backup/restore — replace the vault from an uploaded .zip backup.
router.post('/restore', upload.single('backup'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded.' });
    const result = await restoreFromBuffer(req.file.buffer);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
