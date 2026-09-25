const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ganticElectron', {
  chooseDataFolder: () => ipcRenderer.invoke('data:chooseFolder'),
  getDataFolder: () => ipcRenderer.invoke('data:getFolder'),
  readState: () => ipcRenderer.invoke('data:readState'),
  writeState: (content) => ipcRenderer.invoke('data:writeState', content),
  readAttachment: (id) => ipcRenderer.invoke('data:readAttachment', id),
  writeAttachment: (id, base64) => ipcRenderer.invoke('data:writeAttachment', id, base64),
  deleteAttachments: (ids) => ipcRenderer.invoke('data:deleteAttachments', ids),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('update:quitAndInstall'),
  getAppVersion: () => ipcRenderer.invoke('update:getVersion'),
  wsChoose: () => ipcRenderer.invoke('ws:choose'),
  wsOpen: (folder) => ipcRenderer.invoke('ws:open', folder),
  wsClose: () => ipcRenderer.invoke('ws:close'),
  wsReadNew: () => ipcRenderer.invoke('ws:readNew'),
  wsAppend: (clientId, lines) => ipcRenderer.invoke('ws:append', clientId, lines),
  wsAppendSync: (clientId, lines) => ipcRenderer.sendSync('ws:appendSync', clientId, lines),
  wsWritePresence: (clientId, entry) => ipcRenderer.invoke('ws:writePresence', clientId, entry),
  wsReadPresence: () => ipcRenderer.invoke('ws:readPresence'),
  wsImportAttachments: (ids) => ipcRenderer.invoke('ws:importAttachments', ids),
  onUpdateEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('update:event', listener);
    return () => ipcRenderer.removeListener('update:event', listener);
  },
});
