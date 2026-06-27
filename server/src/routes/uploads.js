'use strict';

const express = require('express');
const fs = require('fs');
const { diskPathFor } = require('../uploads-util');
const { decryptBuffer } = require('../crypto/file-crypto');
const { KEY_HEX } = require('../db');

const router = express.Router();

// Minimal extension -> MIME map for the media Kintora stores (images + audio).
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.webm': 'audio/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
};

function contentType(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  return MIME[ext] || 'application/octet-stream';
}

// GET /uploads/:name — decrypt the stored file and serve it. Supports HTTP range
// requests so <audio> seeking works (we slice the decrypted buffer).
router.get('/:name', (req, res) => {
  const name = req.params.name;
  // Defense in depth against path traversal (Express already decodes one segment).
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return res.status(400).end();
  }

  const diskPath = diskPathFor(name);
  if (!fs.existsSync(diskPath)) return res.status(404).end();

  let plain;
  try {
    plain = decryptBuffer(fs.readFileSync(diskPath), KEY_HEX);
  } catch (_) {
    return res.status(500).end();
  }

  res.setHeader('Content-Type', contentType(name));
  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : plain.length - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= plain.length) end = plain.length - 1;
    if (start > end) start = 0;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${plain.length}`);
    res.setHeader('Content-Length', end - start + 1);
    return res.end(plain.subarray(start, end + 1));
  }

  res.setHeader('Content-Length', plain.length);
  res.end(plain);
});

module.exports = router;
