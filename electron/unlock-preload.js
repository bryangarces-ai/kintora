'use strict';

// Minimal, isolated bridge for the unlock window. The passphrase is sent to the
// main process over IPC and never touches the main app window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('unlock', {
  submit: (passphrase) => ipcRenderer.send('unlock:submit', passphrase),
  cancel: () => ipcRenderer.send('unlock:cancel'),
  onError: (cb) => ipcRenderer.on('unlock:error', (_e, message) => cb(message)),
});
