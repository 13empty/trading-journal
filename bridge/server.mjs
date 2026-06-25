/**
 * Puente local MT5 <-> Trading Journal
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { processMt5Event, createEmptyState } from './mt5Processor.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function bridgeDir() {
  return process.env.TJ_BRIDGE_DIR || __dirname
}

export function startBridge(options = {}) {
  const PORT = Number(options.port ?? process.env.TJ_BRIDGE_PORT ?? 3847)
  const DATA_FILE = path.join(bridgeDir(), 'bridge-state.json')

  let state = createEmptyState()
  let syncCache = null
  let syncCacheVersion = -1
  let stateVersion = 0

  function invalidateSyncCache() {
    syncCache = null
    stateVersion += 1
  }

  function loadState() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      }
    } catch {
      state = createEmptyState()
    }
    invalidateSyncCache()
  }

  function saveState() {
    invalidateSyncCache()
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8')
  }

  function getSyncBody() {
    if (syncCache && syncCacheVersion === stateVersion) return syncCache
    syncCache = JSON.stringify({
      trades: state.trades,
      cashMovements: state.cashMovements,
      balance: state.balance,
      equity: state.equity,
      openPositions: Object.values(state.openPositions || {}),
      account: state.account,
      lastSeen: state.lastSeen,
      tradeCount: state.trades.length,
    })
    syncCacheVersion = stateVersion
    return syncCache
  }

  function fullSyncPayload(s) {
    return {
      type: 'sync',
      full: true,
      trades: s.trades,
      cashMovements: s.cashMovements,
      balance: s.balance,
      equity: s.equity,
      openPositions: Object.values(s.openPositions || {}),
      account: s.account,
      tradeCount: s.trades.length,
      lastSeen: s.lastSeen,
    }
  }

  function lightSyncPayload(s) {
    return {
      type: 'sync',
      light: true,
      balance: s.balance,
      equity: s.equity,
      openPositions: Object.values(s.openPositions || {}),
      account: s.account,
      tradeCount: s.trades.length,
      lastSeen: s.lastSeen,
    }
  }

  function patchSyncPayload(s, patch) {
    return {
      type: 'sync',
      patch: true,
      trades: patch.trades || [],
      cashMovements: patch.cashMovements || [],
      balance: s.balance,
      equity: s.equity,
      openPositions: Object.values(s.openPositions || {}),
      account: s.account,
      tradeCount: s.trades.length,
      lastSeen: s.lastSeen,
    }
  }

  function broadcastMode(eventType) {
    if (eventType === 'heartbeat') return 'light'
    if (eventType === 'position_closed' || eventType === 'balance') return 'patch'
    if (eventType === 'balance_sync' || eventType === 'history_sync') return 'full'
    return 'full'
  }

  function broadcast(wss, mode = 'full', patch = null) {
    let payload
    if (mode === 'light') payload = lightSyncPayload(state)
    else if (mode === 'patch' && patch) payload = patchSyncPayload(state, patch)
    else payload = fullSyncPayload(state)

    const msg = JSON.stringify(payload)
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(msg)
    }
  }

  function json(res, status, body) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end(JSON.stringify(body))
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8')
          resolve(raw ? JSON.parse(raw) : {})
        } catch (e) {
          reject(e)
        }
      })
      req.on('error', reject)
    })
  }

  loadState()

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    try {
      if (req.method === 'GET' && url.pathname === '/api/status') {
        const connected = Boolean(state.lastSeen && Date.now() - state.lastSeen < 120_000)
        return json(res, 200, {
          connected,
          lastSeen: state.lastSeen,
          account: state.account,
          balance: state.balance,
          equity: state.equity,
          server: state.server,
          tradeCount: state.trades.length,
          pendingEvents: state.events.length,
        })
      }

      if (req.method === 'GET' && url.pathname === '/api/sync') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        })
        res.end(getSyncBody())
        return
      }

      if (req.method === 'POST' && url.pathname === '/api/event') {
        const body = await readBody(req)
        const result = processMt5Event(state, body)
        state = result.state
        saveState()
        const eventType = body.type || 'heartbeat'
        broadcast(wss, broadcastMode(eventType), result.patch)
        return json(res, 200, {
          ok: true,
          tradeCount: state.trades.length,
          ...result.patch,
        })
      }

      if (req.method === 'POST' && url.pathname === '/api/reset') {
        state = createEmptyState()
        saveState()
        broadcast(wss, 'full')
        return json(res, 200, { ok: true })
      }

      /** Recarga bridge-state.json del disco (tras resync offline con la app abierta) */
      if (req.method === 'POST' && url.pathname === '/api/reload') {
        loadState()
        broadcast(wss, 'full')
        return json(res, 200, {
          ok: true,
          tradeCount: state.trades.length,
          cashCount: state.cashMovements.length,
        })
      }

      json(res, 404, { error: 'Not found' })
    } catch (err) {
      console.error(err)
      json(res, 500, { error: String(err) })
    }
  })

  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify(fullSyncPayload(state)))
  })

  return new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Bridge http://127.0.0.1:${PORT}`)
      resolve({
        port: PORT,
        close: () =>
          new Promise((res) => {
            wss.close()
            server.close(() => res())
          }),
      })
    })
    server.on('error', reject)
  })
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
if (isMain) {
  startBridge().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
