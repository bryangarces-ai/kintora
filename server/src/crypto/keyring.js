'use strict';

// Manages the vault's Data Encryption Key (DEK) and its wraps on disk.
//
// One random 32-byte DEK encrypts the database (SQLCipher) and every upload
// (AES-256-GCM). The DEK is never stored in the clear — only "wrapped":
//   keys/dek.dpapi  — DEK sealed by Windows DPAPI (Electron safeStorage).
//                     Written/used by the Electron layer (see electron/keyman.js).
//   keys/dek.pass   — DEK wrapped with a passphrase-derived key (scrypt + AES-GCM).
//                     Optional; this module owns it (no Electron dependency, so it
//                     is unit-testable and also usable from dev/tests).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 32, maxmem: 96 * 1024 * 1024 };

function keysDir(dataDir) {
  return path.join(dataDir, 'keys');
}
function passPath(dataDir) {
  return path.join(keysDir(dataDir), 'dek.pass');
}
function dpapiPath(dataDir) {
  return path.join(keysDir(dataDir), 'dek.dpapi');
}

function generateDEK() {
  return crypto.randomBytes(32); // 256-bit key
}

// Wrap a DEK with a passphrase. Returns a JSON-serializable object.
function wrapWithPassphrase(dek, passphrase) {
  if (!passphrase) throw new Error('keyring: passphrase is required');
  const salt = crypto.randomBytes(16);
  const kek = crypto.scryptSync(Buffer.from(passphrase, 'utf8'), salt, SCRYPT.keylen, SCRYPT);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return {
    v: 1,
    kdf: 'scrypt',
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: c.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  };
}

// Unwrap a passphrase wrap. Throws a friendly error on a wrong passphrase.
function unwrapWithPassphrase(wrap, passphrase) {
  const salt = Buffer.from(wrap.salt, 'base64');
  const kek = crypto.scryptSync(Buffer.from(passphrase, 'utf8'), salt, SCRYPT.keylen, {
    N: wrap.N,
    r: wrap.r,
    p: wrap.p,
    maxmem: SCRYPT.maxmem,
  });
  const d = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(wrap.iv, 'base64'));
  d.setAuthTag(Buffer.from(wrap.tag, 'base64'));
  try {
    return Buffer.concat([d.update(Buffer.from(wrap.ct, 'base64')), d.final()]);
  } catch (_) {
    throw new Error('Incorrect passphrase.');
  }
}

// --- On-disk passphrase wrap helpers ---
function hasPassphrase(dataDir) {
  return fs.existsSync(passPath(dataDir));
}
function readPassWrap(dataDir) {
  return JSON.parse(fs.readFileSync(passPath(dataDir), 'utf8'));
}
function writePassWrap(dataDir, wrap) {
  fs.mkdirSync(keysDir(dataDir), { recursive: true });
  fs.writeFileSync(passPath(dataDir), JSON.stringify(wrap, null, 2));
}
function removePassWrap(dataDir) {
  try {
    fs.unlinkSync(passPath(dataDir));
  } catch (_) {
    /* already gone */
  }
}

module.exports = {
  keysDir,
  passPath,
  dpapiPath,
  generateDEK,
  wrapWithPassphrase,
  unwrapWithPassphrase,
  hasPassphrase,
  readPassWrap,
  writePassWrap,
  removePassWrap,
};
