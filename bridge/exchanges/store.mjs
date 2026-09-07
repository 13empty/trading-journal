import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const CATALOG = [
  { id: 'binance', name: 'Binance', needsPassphrase: false, market: 'USDT-M Futures' },
  { id: 'bybit', name: 'Bybit', needsPassphrase: false, market: 'USDT Perp' },
  { id: 'okx', name: 'OKX', needsPassphrase: true, market: 'SWAP' },
  { id: 'bitget', name: 'Bitget', needsPassphrase: true, market: 'USDT-M' },
]

export function keysFile(dataDir) {
  return path.join(dataDir, 'exchange-keys.json')
}

function emptyStore() {
  return { connections: [] }
}

export function loadStore(dataDir) {
  try {
    const file = keysFile(dataDir)
    if (!fs.existsSync(file)) return emptyStore()
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(parsed?.connections)) return emptyStore()
    return parsed
  } catch {
    return emptyStore()
  }
}

export function saveStore(dataDir, store) {
  fs.writeFileSync(keysFile(dataDir), JSON.stringify(store, null, 2), 'utf8')
}

export function publicConnection(c) {
  const key = String(c.apiKey || '')
  return {
    id: c.id,
    exchange: c.exchange,
    label: c.label || c.exchange,
    enabled: c.enabled !== false,
    needsPassphrase: Boolean(CATALOG.find((x) => x.id === c.exchange)?.needsPassphrase),
    apiKeyMasked: key.length > 4 ? `••••${key.slice(-4)}` : '••••',
    hasSecret: Boolean(c.apiSecret),
    lastSyncAt: c.lastSyncAt || null,
    lastError: c.lastError || null,
    lastTradeCount: c.lastTradeCount || 0,
    balance: c.lastBalance ?? null,
  }
}

export function upsertConnection(dataDir, payload) {
  const store = loadStore(dataDir)
  const exchange = String(payload.exchange || '').toLowerCase()
  if (!CATALOG.some((x) => x.id === exchange)) {
    throw new Error(`unsupported_exchange:${exchange}`)
  }
  const apiKey = String(payload.apiKey || '').trim()
  const apiSecret = String(payload.apiSecret || '').trim()
  if (!apiKey || !apiSecret) throw new Error('missing_keys')

  const catalog = CATALOG.find((x) => x.id === exchange)
  if (catalog?.needsPassphrase && !String(payload.passphrase || '').trim()) {
    throw new Error('missing_passphrase')
  }

  const id = String(payload.id || crypto.randomUUID())
  const prev = store.connections.find((c) => c.id === id)
  const next = {
    id,
    exchange,
    label: String(payload.label || catalog?.name || exchange).trim(),
    apiKey,
    apiSecret,
    passphrase: String(payload.passphrase || prev?.passphrase || ''),
    enabled: payload.enabled !== false,
    createdAt: prev?.createdAt || Date.now(),
    lastSyncAt: prev?.lastSyncAt || null,
    lastError: null,
    lastTradeCount: prev?.lastTradeCount || 0,
    lastBalance: prev?.lastBalance ?? null,
  }
  store.connections = [...store.connections.filter((c) => c.id !== id), next]
  saveStore(dataDir, store)
  return publicConnection(next)
}

export function removeConnection(dataDir, id) {
  const store = loadStore(dataDir)
  store.connections = store.connections.filter((c) => c.id !== id)
  saveStore(dataDir, store)
}

export function patchConnectionMeta(dataDir, id, patch) {
  const store = loadStore(dataDir)
  const idx = store.connections.findIndex((c) => c.id === id)
  if (idx < 0) return
  store.connections[idx] = { ...store.connections[idx], ...patch }
  saveStore(dataDir, store)
}
