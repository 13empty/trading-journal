const { autoUpdater } = require('electron-updater')

function initAutoUpdater(getMainWindow, options = {}) {
  const feedUrl = options.feedUrl || process.env.TJ_UPDATE_URL || ''
  if (!feedUrl || options.isDev) {
    return { checkNow: async () => ({ state: 'disabled' }) }
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const send = (payload) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) win.webContents.send('update:status', payload)
  }

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => send({ state: 'idle' }))
  autoUpdater.on('update-available', (info) =>
    send({ state: 'available', version: info.version }),
  )
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) }),
  )
  autoUpdater.on('update-downloaded', (info) =>
    send({ state: 'ready', version: info.version }),
  )
  autoUpdater.on('error', (err) => send({ state: 'error', message: String(err.message) }))

  const checkNow = async () => {
    try {
      autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
      await autoUpdater.checkForUpdates()
      return { state: 'checking' }
    } catch (e) {
      send({ state: 'error', message: String(e.message) })
      return { state: 'error' }
    }
  }

  setTimeout(() => {
    checkNow().catch(() => {})
  }, 12_000)

  return {
    checkNow,
    download: () => autoUpdater.downloadUpdate(),
    install: () => autoUpdater.quitAndInstall(false, true),
  }
}

module.exports = { initAutoUpdater }
