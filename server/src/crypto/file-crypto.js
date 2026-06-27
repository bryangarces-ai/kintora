'use strict';

// AES-256-GCM encryption for upload files (photos, voice notes). The vault DEK
// (the same 32-byte key that unlocks the database) is used directly. On-disk
// layout of an encrypted file:
//
//   [ MAGIC (4) | iv (12) | ciphertext (n) | auth tag (16) ]
//
// Files are <= 50 MB (multer limit), so we encrypt/decrypt in one buffer rather
// than streaming — far simpler, and it lets the serve route satisfy HTTP range
// requests (audio seeking) by slicing the decrypted buffer.

const crypto = require('crypto');

const MAGIC = Buffer.from('KVE1'); // Kintora Vault Encrypted, format 1
const IV_LEN = 12;
const TAG_LEN = 16;

function keyBuffer(keyHex) {
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('file-crypto: a 64-hex-char key is required');
  }
  return Buffer.from(keyHex, 'hex');
}

function encryptBuffer(plain, keyHex) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(keyHex), iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, ct, cipher.getAuthTag()]);
}

function decryptBuffer(buf, keyHex) {
  if (buf.length < MAGIC.length + IV_LEN + TAG_LEN || !buf.subarray(0, 4).equals(MAGIC)) {
    throw new Error('file-crypto: not a valid encrypted file');
  }
  const iv = buf.subarray(4, 4 + IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(4 + IV_LEN, buf.length - TAG_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer(keyHex), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

module.exports = { encryptBuffer, decryptBuffer, MAGIC };
