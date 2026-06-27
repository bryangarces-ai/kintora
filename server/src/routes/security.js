'use strict';

const express = require('express');
const { DATA_DIR, KEY_HEX } = require('../db');
const keyring = require('../crypto/keyring');

const router = express.Router();

// Confirm `current` unwraps the existing passphrase wrap to the live DEK.
function verifyCurrent(current) {
  const dek = keyring.unwrapWithPassphrase(keyring.readPassWrap(DATA_DIR), current || '');
  if (dek.toString('hex') !== KEY_HEX) throw new Error('mismatch');
}

// GET /api/security/status — is the vault encrypted, and is a passphrase set?
router.get('/status', (req, res) => {
  res.json({ encrypted: true, hasPassphrase: keyring.hasPassphrase(DATA_DIR) });
});

// POST /api/security/passphrase — enable a passphrase, or change an existing one.
// Body: { passphrase, current? }. Wraps the live DEK with the new passphrase.
router.post('/passphrase', (req, res) => {
  const { current, passphrase } = req.body || {};
  if (!passphrase || passphrase.length < 6) {
    return res.status(400).json({ error: 'Choose a passphrase of at least 6 characters.' });
  }
  if (keyring.hasPassphrase(DATA_DIR)) {
    try {
      verifyCurrent(current);
    } catch (_) {
      return res.status(400).json({ error: 'The current passphrase is incorrect.' });
    }
  }
  keyring.writePassWrap(DATA_DIR, keyring.wrapWithPassphrase(Buffer.from(KEY_HEX, 'hex'), passphrase));
  res.json({ ok: true, hasPassphrase: true });
});

// DELETE /api/security/passphrase — remove the passphrase. Body: { current }.
router.delete('/passphrase', (req, res) => {
  if (!keyring.hasPassphrase(DATA_DIR)) return res.json({ ok: true, hasPassphrase: false });
  try {
    verifyCurrent((req.body || {}).current);
  } catch (_) {
    return res.status(400).json({ error: 'The current passphrase is incorrect.' });
  }
  keyring.removePassWrap(DATA_DIR);
  res.json({ ok: true, hasPassphrase: false });
});

module.exports = router;
