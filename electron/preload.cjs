const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ganticElectron', {
  chooseDataFolder: () => ipcRenderer.invoke('data:chooseFolder'),
  getDataFolder: () => ipcRenderer.invoke('data:getFolder'),
  readState: () => ipcRenderer.invoke('data:readState'),
  writeState: (content) => ipcRenderer.invoke('data:writeState', content),
  readAttachment: (id) => ipcRenderer.invoke('data:readAttachment', id),
  writeAttachment: (id, base64) => ipcRenderer.invoke('data:writeAttachment', id, base64),
  deleteAttachments: (ids) => ipcRenderer.invoke('data:deleteAttachments', ids),
});
