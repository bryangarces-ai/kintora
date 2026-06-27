'use strict';

// Electron-side key manager: turns the wrapped DEK on disk into the raw hex key
// the server needs, handling first run, DPAPI auto-unlock, the passphrase
// fallback, and legacy-vault migration. Runs in the main process before the
// server starts (it sets KINTORA_VAULT_KEY).

const fs = require('fs');
const path = require('path');
const { safeStorage, BrowserWindow, ipcMain } = require('electron');

const keyring = require('../server/src/crypto/keyring');
const { needsMigration, migratePlaintextVault } = require('../server/src/crypto/migrate');

function sealDpapi(dataDir, dekHex) {
  fs.mkdirSync(keyring.keysDir(dataDir), { recursive: true });
  fs.writeFileSync(keyring.dpapiPath(dataDir), safeStorage.encryptString(dekHex));
}

function tryUnsealDpapi(dataDir) {
  const p = keyring.dpapiPath(dataDir);
  if (!fs.existsSync(p) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(fs.readFileSync(p));
  } catch (_) {
    return null; // sealed on a different account/machine
  }
}

// Show the modal unlock window and resolve with the DEK hex, or null if the user
// cancels. `validate(passphrase)` returns the hex on success or throws.
function promptForPassphrase(validate) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 460,
      height: 360,
      resizable: false,
      fullscreenable: false,
      title: 'Unlock Kintora',
      backgroundColor: '#0f172a',
      webPreferences: {
        preload: path.join(__dirname, 'unlock-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.setMenuBarVisibility(false);
    win.loadFile(path.join(__dirname, 'unlock.html'));

    let settled = false;
    const cleanup = () => {
      ipcMain.removeListener('unlock:submit', onSubmit);
      ipcMain.removeListener('unlock:cancel', onCancel);
    };
    const onSubmit = async (_e, passphrase) => {
      try {
        const dekHex = await validate(passphrase);
        settled = true;
        cleanup();
        win.close();
        resolve(dekHex);
      } catch (err) {
        if (!win.isDestroyed()) {
          win.webContents.send('unlock:error', err.message || 'Incorrect passphrase.');
        }
      }
    };
    const onCancel = () => {
      settled = true;
      cleanup();
      win.close();
      resolve(null);
    };
    ipcMain.on('unlock:submit', onSubmit);
    ipcMain.on('unlock:cancel', onCancel);
    win.on('closed', () => {
      if (!settled) {
        cleanup();
        resolve(null);
      }
    });
  });
}

// Resolve the vault key for this launch. Returns the 64-hex DEK, or null if the
// user cancelled an unlock prompt (caller should quit).
async function getDekHex({ dataDir }) {
  fs.mkdirSync(keyring.keysDir(dataDir), { recursive: true });

  // Legacy plaintext vault -> generate a key, seal it, and migrate in place.
  if (needsMigration(dataDir)) {
    const dekHex = keyring.generateDEK().toString('hex');
    if (safeStorage.isEncryptionAvailable()) sealDpapi(dataDir, dekHex);
    migratePlaintextVault(dataDir, dekHex);
    return dekHex;
  }

  // Normal case: auto-unlock via DPAPI.
  const auto = tryUnsealDpapi(dataDir);
  if (auto) return auto;

  // DPAPI unavailable/failed but a passphrase wrap exists -> prompt.
  if (keyring.hasPassphrase(dataDir)) {
    const wrap = keyring.readPassWrap(dataDir);
    const dekHex = await promptForPassphrase(async (passphrase) =>
      keyring.unwrapWithPassphrase(wrap, passphrase).toString('hex')
    );
    if (dekHex == null) return null;
    // Re-seal for this machine so subsequent launches are silent.
    if (safeStorage.isEncryptionAvailable()) sealDpapi(dataDir, dekHex);
    return dekHex;
  }

  // First run: no DB and no keys -> generate and seal a fresh DEK.
  const dekHex = keyring.generateDEK().toString('hex');
  if (safeStorage.isEncryptionAvailable()) sealDpapi(dataDir, dekHex);
  return dekHex;
}

module.exports = { getDekHex, sealDpapi };
