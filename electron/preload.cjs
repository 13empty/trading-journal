const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  openUserData: () => ipcRenderer.invoke('desktop:open-user-data'),
  readSyncLog: (maxLines) => ipcRenderer.invoke('desktop:read-sync-log', maxLines ?? 40),
  applyBroker: (payload) => ipcRenderer.invoke('desktop:apply-broker', payload),
  runFullResync: () => ipcRenderer.invoke('desktop:run-full-resync'),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },
})
