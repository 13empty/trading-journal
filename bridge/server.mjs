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
  /** Pending command for Python sync agent (e.g. close_all) */
  let pendingCommand = null
  let lastCommandResult = null
  const COMMAND_FILE = path.join(bridgeDir(), 'bridge-command.json')
  const CLAIM_STALE_MS = 90_000

  function invalidateSyncCache() {
    syncCache = null
    stateVersion += 1
  }

  function persistCommand(cmd) {
    try {
      if (cmd) fs.writeFileSync(COMMAND_FILE, JSON.stringify(cmd, null, 2), 'utf8')
      else if (fs.existsSync(COMMAND_FILE)) fs.unlinkSync(COMMAND_FILE)
    } catch {
      /* ignore disk errors */
    }
  }

  function loadPendingCommand() {
    try {
      if (!fs.existsSync(COMMAND_FILE)) return
      const cmd = JSON.parse(fs.readFileSync(COMMAND_FILE, 'utf8'))
      if (cmd?.action) {
        pendingCommand = { ...cmd, status: cmd.status === 'claimed' ? 'pending' : cmd.status || 'pending' }
        console.log(`[bridge] restored pending command ${pendingCommand.id}`)
      }
    } catch {
      /* ignore */
    }
  }

  function clearPendingCommand() {
    pendingCommand = null
    persistCommand(null)
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
    loadPendingCommand()
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

      /** Queue close-all for the Python MT5 agent */
      if (req.method === 'POST' && url.pathname === '/api/close-all') {
        const body = await readBody(req).catch(() => ({}))
        // Replace only if nothing pending/claimed, or previous claim went stale
        if (
          pendingCommand &&
          pendingCommand.status === 'claimed' &&
          Date.now() - (pendingCommand.claimedAt || pendingCommand.at || 0) < CLAIM_STALE_MS
        ) {
          return json(res, 200, { ok: true, command: pendingCommand, alreadyQueued: true })
        }
        pendingCommand = {
          action: 'close_all',
          id: `close_${Date.now()}`,
          reason: body.reason || 'day_rule',
          at: Date.now(),
          status: 'pending',
        }
        lastCommandResult = null
        persistCommand(pendingCommand)
        console.log(`[bridge] queued close_all (${pendingCommand.id})`)
        return json(res, 200, { ok: true, command: pendingCommand })
      }

      /**
       * Python polls this each loop.
       * Claims the command without clearing — cleared only after /api/command/result.
       */
      if (req.method === 'GET' && url.pathname === '/api/command') {
        if (!pendingCommand?.action) {
          return json(res, 200, { action: null })
        }
        const claimedAt = pendingCommand.claimedAt || 0
        if (
          pendingCommand.status === 'claimed' &&
          Date.now() - claimedAt < CLAIM_STALE_MS
        ) {
          // Still being processed — do not re-issue
          return json(res, 200, { action: null, inProgress: true, id: pendingCommand.id })
        }
        pendingCommand = {
          ...pendingCommand,
          status: 'claimed',
          claimedAt: Date.now(),
        }
        persistCommand(pendingCommand)
        return json(res, 200, {
          action: pendingCommand.action,
          id: pendingCommand.id,
          reason: pendingCommand.reason,
          at: pendingCommand.at,
        })
      }

      /** Python reports close-all result — then clear the queue */
      if (req.method === 'POST' && url.pathname === '/api/command/result') {
        lastCommandResult = await readBody(req)
        console.log(`[bridge] command result:`, lastCommandResult)
        clearPendingCommand()
        return json(res, 200, { ok: true })
      }

      if (req.method === 'GET' && url.pathname === '/api/command/result') {
        if (lastCommandResult) return json(res, 200, { ...lastCommandResult, pending: false })
        if (pendingCommand?.action) {
          return json(res, 200, {
            ok: false,
            pending: true,
            commandId: pendingCommand.id,
            status: pendingCommand.status,
          })
        }
        return json(res, 200, { ok: false, pending: false, idle: true })
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
