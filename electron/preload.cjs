const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  notify: (title, body) => ipcRenderer.invoke('desktop:notify', { title, body }),
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  openUserData: () => ipcRenderer.invoke('desktop:open-user-data'),
  readSyncLog: (maxLines) => ipcRenderer.invoke('desktop:read-sync-log', maxLines ?? 40),
  applyBroker: (payload) => ipcRenderer.invoke('desktop:apply-broker', payload),
  runFullResync: () => ipcRenderer.invoke('desktop:run-full-resync'),
  setTitleBarTheme: (payload) => ipcRenderer.invoke('desktop:set-titlebar-theme', payload),
  captureScreen: () => ipcRenderer.invoke('media:capture-screen'),
  saveTradeScreenshot: (payload) => ipcRenderer.invoke('media:save-trade-screenshot', payload),
  pickTradeScreenshot: (payload) => ipcRenderer.invoke('media:pick-trade-screenshot', payload),
  readTradeScreenshot: (relativePath) =>
    ipcRenderer.invoke('media:read-trade-screenshot', relativePath),
  deleteTradeScreenshot: (relativePath) =>
    ipcRenderer.invoke('media:delete-trade-screenshot', relativePath),
  openScreenshotsFolder: (tradeKey) =>
    ipcRenderer.invoke('media:open-screenshots-folder', tradeKey),
  checkUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },
})
