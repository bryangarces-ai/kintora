const path = require('path');
const { app, BrowserWindow, shell, Menu, session } = require('electron');

// Force a stable app name so the data folder is the same in dev and when
// packaged (otherwise dev uses the package.json "name" and packaged uses
// productName, splitting the vault across two folders). Must run before any
// app.getPath('userData') call.
app.setName('Kintora');

// Single instance — a memory vault should never run twice against the same DB.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const PORT = 3000;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'Kintora',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      // The window only ever loads our own local server. Keep Node out of the
      // renderer and isolate context for safety; no preload bridge is needed.
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Open external links (e.g. obsidian.md) in the real browser, not the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Store the vault in a writable, persistent per-user location. The packaged
  // app bundle is read-only, so data must NOT live inside it.
  // Rooted at .../vault/ so a future multi-user phase can become .../vaults/<id>/.
  // An explicit MEMORY_VAULT_DATA_DIR (e.g. for testing) is respected if set.
  process.env.MEMORY_VAULT_DATA_DIR =
    process.env.MEMORY_VAULT_DATA_DIR || path.join(app.getPath('userData'), 'vault');

  // Unlock the encrypted vault BEFORE the server loads (db.js needs the key at
  // require time). Handles first run, DPAPI auto-unlock, the passphrase prompt,
  // and legacy plaintext-vault migration. A null result means the user cancelled.
  const { getDekHex } = require('./keyman');
  let dekHex;
  try {
    dekHex = await getDekHex({ dataDir: process.env.MEMORY_VAULT_DATA_DIR });
  } catch (err) {
    console.error('Failed to unlock the Kintora vault:', err);
    app.quit();
    return;
  }
  if (!dekHex) {
    app.quit(); // user cancelled the unlock prompt
    return;
  }
  process.env.KINTORA_VAULT_KEY = dekHex;

  // Point the embedded Express server at the built Angular app so it serves the
  // UI and the API from one origin. Path mirrors the repo layout inside the asar.
  process.env.CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist', 'client', 'browser');

  // Allow microphone access for voice notes — the window only loads our own
  // local server, and recorded audio is saved locally (never uploaded anywhere).
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(permission === 'media' || permission === 'microphone');
  });

  // Start the existing Express server in this process, then load it once it's up.
  const { start } = require('../server/src/index');
  const server = start(PORT);
  server.on('listening', createWindow);
  server.on('error', (err) => {
    console.error('Failed to start Kintora server:', err);
  });

  // Minimal menu (keep DevTools available for troubleshooting).
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // On Windows, quit fully when the window closes.
  if (process.platform !== 'darwin') app.quit();
});
