'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { UPLOADS_DIR, KEY_HEX } = require('./db');
const { encryptBuffer } = require('./crypto/file-crypto');

// Custom multer storage engine: buffer the incoming file, encrypt it with the
// vault key (AES-256-GCM), and write it to disk as "<random>.<ext>.enc". It sets
// file.filename to the *logical* name ("<random>.<ext>") so route handlers and
// the DB are unchanged — they never see the encryption. Files are <= 50 MB, so
// buffering in memory is fine.
function EncryptedStorage() {}

EncryptedStorage.prototype._handleFile = function (req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = crypto.randomBytes(16).toString('hex') + ext;
  const diskPath = path.join(UPLOADS_DIR, filename + '.enc');

  const chunks = [];
  file.stream.on('data', (c) => chunks.push(c));
  file.stream.on('error', cb);
  file.stream.on('end', () => {
    try {
      const plain = Buffer.concat(chunks);
      fs.writeFileSync(diskPath, encryptBuffer(plain, KEY_HEX));
      cb(null, { filename, size: plain.length });
    } catch (err) {
      cb(err);
    }
  });
};

EncryptedStorage.prototype._removeFile = function (req, file, cb) {
  fs.unlink(path.join(UPLOADS_DIR, file.filename + '.enc'), cb);
};

const upload = multer({
  storage: new EncryptedStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

module.exports = { upload };
