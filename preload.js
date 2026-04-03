const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  registerShortcut: (data) => ipcRenderer.invoke('shortcut:register', data),
  unregisterShortcut: (data) => ipcRenderer.invoke('shortcut:unregister', data),
  onPlaySound: (callback) => ipcRenderer.on('play-sound', (_event, id) => callback(id)),
  onStopAll: (callback) => ipcRenderer.on('stop-all', () => callback()),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  getQR: () => ipcRenderer.invoke('server:getQR')
});
