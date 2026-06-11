/**
 * Trading Journal — un solo .exe inicia TODO:
 * 1) Puente MT5 (puerto 3847) — dentro de la app
 * 2) Sync MT5 (mt5-sync.exe)
 * 3) Ventana del journal
 */
const { app, BrowserWindow, dialog, shell, ipcMain, Notification, nativeTheme, nativeImage } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')
const { spawn, execFileSync, execSync } = require('child_process')
const { pathToFileURL } = require('url')

const APP_PORT = Number(process.env.TJ_APP_PORT) || 5173
const BRIDGE_PORT = Number(process.env.TJ_BRIDGE_PORT) || 3847
const APP_URL = `http://127.0.0.1:${APP_PORT}`
const isDevMode = process.argv.includes('--dev')

let mainWindow = null
let splashWindow = null
let bridgeClose = null
let staticServer = null
let mt5RestartTimer = null
let mt5RestartPending = false
let mt5SyncProc = null
let mt5StopRestart = false
let appUpdater = null
const children = []

function appRoot() {
  return path.join(__dirname, '..')
}

function runCwd() {
  const dir = app.getPath('userData')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function unpackedPath(...parts) {
  if (!app.isPackaged) return path.join(appRoot(), ...parts)
  const u = path.join(process.resourcesPath, 'app.asar.unpacked', ...parts)
  if (fs.existsSync(u)) return u
  return path.join(appRoot(), ...parts)
}

/** Datos del puente en AppData (no en carpeta temporal del portable) */
function bridgeDataDir() {
  const dir = path.join(app.getPath('userData'), 'bridge-data')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function migrateBridgeState() {
  const dest = path.join(bridgeDataDir(), 'bridge-state.json')
  if (fs.existsSync(dest)) {
    try {
      const j = JSON.parse(fs.readFileSync(dest, 'utf8'))
      if ((j.trades && j.trades.length > 0) || j.balance != null) return
    } catch {
      /* re-migrar */
    }
  }
  const sources = [
    path.join(appRoot(), 'bridge', 'bridge-state.json'),
    path.join(unpackedPath('bridge'), 'bridge-state.json'),
  ]
  for (const src of sources) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      console.log('[bridge] Estado migrado desde', src)
      return
    }
  }
}

function runtimeConfigPath() {
  return path.join(app.getPath('userData'), 'tj-runtime.json')
}

function loadRuntimeConfig() {
  try {
    return JSON.parse(fs.readFileSync(runtimeConfigPath(), 'utf8'))
  } catch {
    return {}
  }
}

function saveRuntimeConfig(data) {
  fs.mkdirSync(path.dirname(runtimeConfigPath()), { recursive: true })
  fs.writeFileSync(runtimeConfigPath(), JSON.stringify({ ...loadRuntimeConfig(), ...data }, null, 2))
}

function getMt5OffsetHours() {
  const cfg = loadRuntimeConfig()
  return String(cfg.mt5ServerOffsetHours ?? process.env.TJ_MT5_SERVER_OFFSET_HOURS ?? '6')
}

function applyRuntimeConfigAtBoot() {
  const cfg = loadRuntimeConfig()
  if (cfg.mt5ServerOffsetHours != null) {
    process.env.TJ_MT5_SERVER_OFFSET_HOURS = String(cfg.mt5ServerOffsetHours)
  }
}

function killMt5SyncOnly() {
  mt5StopRestart = true
  if (mt5SyncProc && !mt5SyncProc.killed) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(mt5SyncProc.pid), '/f', '/t'], { windowsHide: true })
      } else {
        mt5SyncProc.kill('SIGTERM')
      }
    } catch {
      /* ignore */
    }
  }
  const idx = children.indexOf(mt5SyncProc)
  if (idx >= 0) children.splice(idx, 1)
  mt5SyncProc = null
}

function restartMt5Sync() {
  killMt5SyncOnly()
  mt5StopRestart = false
  startMt5Sync()
}

function runPythonScript(scriptPath, timeoutMs = 180_000) {
  return new Promise((resolve) => {
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: 'no_script' })
      return
    }
    const cand = resolvePythonCandidates()[0]
    if (!cand) {
      resolve({ ok: false, error: 'no_python' })
      return
    }
    let output = ''
    const proc = spawn(cand.bin, [...cand.prefix, '-u', '-X', 'utf8', scriptPath], {
      env: {
        ...process.env,
        TJ_BRIDGE_DIR: bridgeDataDir(),
        TJ_MT5_SERVER_OFFSET_HOURS: getMt5OffsetHours(),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        PYTHONUNBUFFERED: '1',
      },
      windowsHide: true,
      cwd: runCwd(),
    })
    proc.stdout?.on('data', (d) => {
      output += d
    })
    proc.stderr?.on('data', (d) => {
      output += d
    })
    const timer = setTimeout(() => {
      try {
        proc.kill()
      } catch {
        /* ignore */
      }
      resolve({ ok: false, error: 'timeout', output })
    }, timeoutMs)
    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, output, code })
    })
    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({ ok: false, error: err.message, output })
    })
  })
}

function mt5LogPath() {
  return path.join(app.getPath('userData'), 'mt5-sync.log')
}

function registerDesktopIpc() {
  ipcMain.handle('desktop:notify', (_e, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })

  ipcMain.handle('desktop:info', () => ({
    isElectron: true,
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    bridgeDataPath: bridgeDataDir(),
    syncLogPath: mt5LogPath(),
    platform: process.platform,
    titleBarInset: process.platform === 'win32' ? 36 : 0,
  }))

  ipcMain.handle('desktop:open-user-data', () => {
    shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('desktop:read-sync-log', (_e, maxLines = 40) => {
    const log = mt5LogPath()
    if (!fs.existsSync(log)) return ''
    const lines = fs.readFileSync(log, 'utf8').split(/\r?\n/)
    return lines.slice(-maxLines).join('\n')
  })

  ipcMain.handle('desktop:apply-broker', (_e, payload) => {
    const offset = Number(payload?.offsetHours ?? 6)
    saveRuntimeConfig({
      brokerPreset: payload?.preset ?? 'other',
      brokerLabel: payload?.label ?? '',
      mt5ServerOffsetHours: offset,
    })
    process.env.TJ_MT5_SERVER_OFFSET_HOURS = String(offset)
    restartMt5Sync()
    return { ok: true }
  })

  ipcMain.handle('desktop:run-full-resync', async () => {
    const script = unpackedPath('bridge-python', 'offline_resync.py')
    return runPythonScript(script, 240_000)
  })

  ipcMain.handle('update:check', async () => {
    if (!appUpdater) return { state: 'disabled' }
    return appUpdater.checkNow()
  })

  ipcMain.handle('update:download', async () => {
    if (!appUpdater?.download) return { ok: false }
    await appUpdater.download()
    return { ok: true }
  })

  ipcMain.handle('update:install', () => {
    appUpdater?.install?.()
    return { ok: true }
  })
}

function preloadPath() {
  return path.join(__dirname, 'preload.cjs')
}

function setSplashStatus(text) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `document.getElementById('s').textContent = ${JSON.stringify(text)}`,
    )
  }
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 200,
    frame: false,
    center: true,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#0f1419',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#0f1419;color:#e7ecf3;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px">
<h2 style="margin:0;font-size:18px">Trading Journal</h2>
<p id="s" style="margin:0;opacity:.8;font-size:14px">Iniciando...</p>
</body></html>`
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

async function startBridge() {
  process.env.TJ_BRIDGE_DIR = bridgeDataDir()
  process.env.TJ_BRIDGE_PORT = String(BRIDGE_PORT)

  const serverPath = path.join(unpackedPath('bridge'), 'server.mjs')
  if (!fs.existsSync(serverPath)) {
    throw new Error(`No se encuentra el puente: ${serverPath}`)
  }

  const mod = await import(pathToFileURL(serverPath).href)
  const handle = await mod.startBridge({ port: BRIDGE_PORT })
  bridgeClose = handle.close
  return handle
}

function spawnLogged(name, command, args, options = {}) {
  const proc = spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    ...options,
  })
  proc.stdout?.on('data', (d) => process.stdout.write(`[${name}] ${d}`))
  proc.stderr?.on('data', (d) => process.stderr.write(`[${name}] ${d}`))
  proc.on('error', (err) => console.error(`[${name}]`, err.message))
  children.push(proc)
  return proc
}

/** Copia mt5-sync.exe a AppData (evita errores con rutas temporales del portable) */
function ensureMt5SyncExe() {
  const dest = path.join(app.getPath('userData'), 'mt5-sync.exe')
  const sources = [
    path.join(process.resourcesPath, 'mt5-sync.exe'),
    path.join(appRoot(), 'build', 'mt5-sync.exe'),
  ]
  for (const src of sources) {
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, dest)
      } catch (e) {
        console.error('[mt5] No se pudo copiar mt5-sync:', e.message)
      }
      return dest
    }
  }
  return fs.existsSync(dest) ? dest : null
}

function scheduleMt5Restart(reason) {
  if (mt5RestartPending) return
  mt5RestartPending = true
  if (mt5RestartTimer) clearTimeout(mt5RestartTimer)
  const log = mt5LogPath()
  fs.appendFileSync(log, `\n[app] Reintento sync MT5 (${reason})\n`)
  mt5RestartTimer = setTimeout(() => {
    mt5RestartTimer = null
    mt5RestartPending = false
    startMt5Sync()
  }, 5000)
}

function resolvePythonCandidates() {
  const list = []
  if (process.env.TJ_PYTHON && fs.existsSync(process.env.TJ_PYTHON)) {
    list.push({ bin: process.env.TJ_PYTHON, prefix: [] })
  }
  if (process.platform === 'win32') {
    list.push({ bin: 'py', prefix: ['-3'] })
    try {
      const out = execSync('where.exe python', { encoding: 'utf8', windowsHide: true, timeout: 5000 })
      for (const line of out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
        if (fs.existsSync(line)) list.push({ bin: line, prefix: [] })
      }
    } catch {
      /* ignore */
    }
    try {
      const pyRoot = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python')
      if (fs.existsSync(pyRoot)) {
        for (const name of fs.readdirSync(pyRoot)) {
          const exe = path.join(pyRoot, name, 'python.exe')
          if (fs.existsSync(exe)) list.push({ bin: exe, prefix: [] })
        }
      }
    } catch {
      /* ignore */
    }
  } else {
    list.push({ bin: 'python3', prefix: [] })
  }
  const seen = new Set()
  return list.filter((c) => {
    const key = `${c.bin}|${c.prefix.join(',')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function canUsePythonScript() {
  const script = unpackedPath('bridge-python', 'mt5_sync.py')
  return fs.existsSync(script)
}

function startMt5Sync() {
  const log = mt5LogPath()
  try {
    if (fs.existsSync(log) && fs.statSync(log).size > 2_000_000) {
      fs.writeFileSync(log, `[${new Date().toISOString()}] log reiniciado\n`)
    }
  } catch {
    /* ignore */
  }
  fs.appendFileSync(log, `\n--- ${new Date().toISOString()} inicio sync ---\n`)

  const logFd = fs.openSync(log, 'a')
  const logStream = { fd: logFd }

  const script = unpackedPath('bridge-python', 'mt5_sync.py')
  const spawnOpts = {
    cwd: runCwd(),
    windowsHide: true,
    stdio: ['ignore', logStream, logStream],
    shell: false,
    env: {
      ...process.env,
      TJ_MT5_SERVER_OFFSET_HOURS: getMt5OffsetHours(),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      PYTHONUNBUFFERED: '1',
    },
  }

  let proc = null
  if (canUsePythonScript()) {
    const cand = resolvePythonCandidates()[0]
    if (cand) {
      const args = [...cand.prefix, '-u', '-X', 'utf8', script]
      fs.appendFileSync(log, `[app] Usando: ${cand.bin} ${args.join(' ')}\n`)
      proc = spawn(cand.bin, args, spawnOpts)
    }
  }

  if (!proc) {
    const exe = ensureMt5SyncExe()
    if (!exe) {
      fs.appendFileSync(log, '[app] ERROR: sin Python ni mt5-sync.exe\n')
      fs.closeSync(logFd)
      scheduleMt5Restart('sin binario')
      return null
    }
    fs.appendFileSync(log, `[app] Usando ${exe}\n`)
    proc = spawn(exe, [], { ...spawnOpts, cwd: runCwd() })
  }

  proc.on('error', (err) => {
    fs.appendFileSync(log, `[app] spawn error: ${err.message}\n`)
    scheduleMt5Restart('spawn error')
  })
  proc.on('exit', (code) => {
    fs.closeSync(logFd)
    fs.appendFileSync(log, `[app] mt5-sync termino con codigo ${code}\n`)
    if (mt5StopRestart) {
      mt5StopRestart = false
      return
    }
    scheduleMt5Restart(`exit ${code}`)
  })

  mt5SyncProc = proc
  children.push(proc)
  return proc
}

function watchMt5Connection() {
  setInterval(() => {
    const mt5Running = children.some((p) => p && !p.killed && p.exitCode == null)
    const req = http.get(`http://127.0.0.1:${BRIDGE_PORT}/api/status`, (res) => {
      let body = ''
      res.on('data', (c) => {
        body += c
      })
      res.on('end', () => {
        try {
          const s = JSON.parse(body)
          if (!s.connected && !mt5Running) scheduleMt5Restart('sin heartbeat MT5')
        } catch {
          /* ignore */
        }
      })
    })
    req.on('error', () => {})
    req.setTimeout(2000, () => req.destroy())
  }, 20000)
}

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript'
  if (filePath.endsWith('.css')) return 'text/css'
  if (filePath.endsWith('.html')) return 'text/html'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.json')) return 'application/json'
  return 'application/octet-stream'
}

function startStaticServer(distDir) {
  const base = path.resolve(distDir)
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(new URL(req.url || '/', APP_URL).pathname)
      if (urlPath === '/') urlPath = '/index.html'
      const filePath = path.normalize(path.join(base, urlPath))
      if (!filePath.startsWith(base)) {
        res.writeHead(403)
        res.end()
        return
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          fs.readFile(path.join(base, 'index.html'), (e2, indexHtml) => {
            if (e2) {
              res.writeHead(404)
              res.end()
              return
            }
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(indexHtml)
          })
          return
        }
        res.writeHead(200, { 'Content-Type': contentType(filePath) })
        res.end(data)
      })
    })
    server.listen(APP_PORT, '127.0.0.1', () => {
      staticServer = server
      resolve()
    })
    server.on('error', reject)
  })
}

function waitForHttp(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tryOnce = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) resolve()
        else retry()
      })
      req.on('error', retry)
      req.setTimeout(3000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error(`No responde: ${url}`))
      else setTimeout(tryOnce, 400)
    }
    tryOnce()
  })
}

function killChildren() {
  for (const proc of children) {
    if (!proc || proc.killed) continue
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { windowsHide: true })
      } else {
        proc.kill('SIGTERM')
      }
    } catch {
      /* ignore */
    }
  }
}

async function bootServices() {
  migrateBridgeState()
  applyRuntimeConfigAtBoot()
  setSplashStatus('Puente MT5 (puerto 3847)...')
  await startBridge()
  await waitForHttp(`http://127.0.0.1:${BRIDGE_PORT}/api/status`, 15000)

  setSplashStatus('Conexion con MetaTrader 5...')
  startMt5Sync()
  watchMt5Connection()

  if (isDevMode) {
    setSplashStatus('Esperando interfaz (dev)...')
    await waitForHttp('http://127.0.0.1:5173/')
  } else {
    setSplashStatus('Cargando interfaz...')
    const distDir = path.join(appRoot(), 'dist')
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      throw new Error('Falta compilar la app (dist/index.html)')
    }
    await startStaticServer(distDir)
    await waitForHttp(`${APP_URL}/`)
  }
}

function windowIcon() {
  const candidates = [
    path.join(appRoot(), 'build', 'icon.png'),
    path.join(appRoot(), 'public', 'favicon.svg'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img
    }
  }
  return undefined
}

function createMainWindow() {
  const isWin = process.platform === 'win32'
  const winOptions = {
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'Trading Journal',
    autoHideMenuBar: true,
    backgroundColor: '#0d1117',
    icon: windowIcon(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath(),
    },
  }

  if (isWin) {
    winOptions.titleBarStyle = 'hidden'
    winOptions.titleBarOverlay = {
      color: '#161b22',
      symbolColor: '#e6edf3',
      height: 36,
    }
  } else if (process.platform === 'darwin') {
    winOptions.titleBarStyle = 'hiddenInset'
  }

  mainWindow = new BrowserWindow(winOptions)

  mainWindow.loadURL(isDevMode ? 'http://127.0.0.1:5173' : APP_URL)

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
    mainWindow.show()
    try {
      const { initAutoUpdater } = require('./updater.cjs')
      appUpdater = initAutoUpdater(() => mainWindow, {
        feedUrl: process.env.TJ_UPDATE_URL || loadRuntimeConfig().updateFeedUrl || '',
        isDev: isDevMode,
      })
    } catch (err) {
      console.error('[updater]', err.message)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark'
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.tradingjournal.desktop')
    }
    registerDesktopIpc()
    createSplash()
    try {
      await bootServices()
      createMainWindow()
    } catch (err) {
      console.error(err)
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
      dialog.showErrorBox(
        'Trading Journal',
        `${err.message}\n\nComprueba:\n- MetaTrader 5 abierto con sesion\n- Si acabas de crear el .exe, ejecuta Crear-Ejecutable.bat de nuevo`,
      )
      killChildren()
      if (bridgeClose) await bridgeClose().catch(() => {})
      app.quit()
    }
  })

  async function shutdown() {
    if (staticServer) staticServer.close()
    if (bridgeClose) await bridgeClose().catch(() => {})
    killChildren()
  }

  app.on('window-all-closed', async () => {
    await shutdown()
    app.quit()
  })

  app.on('before-quit', shutdown)
}
