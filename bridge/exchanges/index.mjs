import {
  CATALOG,
  loadStore,
  publicConnection,
  upsertConnection,
  removeConnection,
  patchConnectionMeta,
} from './store.mjs'
import { syncConnection, testConnection } from './adapters.mjs'

export { CATALOG }

export async function handleExchanges(req, res, url, { json, readBody, dataDir }) {
  const path = url.pathname

  if (req.method === 'GET' && path === '/api/exchanges/catalog') {
    json(res, 200, { exchanges: CATALOG })
    return true
  }

  if (req.method === 'GET' && path === '/api/exchanges') {
    const store = loadStore(dataDir)
    json(res, 200, { connections: store.connections.map(publicConnection) })
    return true
  }

  if (req.method === 'POST' && path === '/api/exchanges') {
    const body = await readBody(req)
    try {
      const saved = upsertConnection(dataDir, body)
      json(res, 200, { ok: true, connection: saved })
    } catch (err) {
      json(res, 400, { ok: false, error: String(err.message || err) })
    }
    return true
  }

  if (req.method === 'POST' && path === '/api/exchanges/delete') {
    const body = await readBody(req)
    removeConnection(dataDir, String(body.id || ''))
    json(res, 200, { ok: true })
    return true
  }

  if (req.method === 'POST' && path === '/api/exchanges/test') {
    const body = await readBody(req)
    const store = loadStore(dataDir)
    const conn = body.id
      ? store.connections.find((c) => c.id === body.id)
      : {
          exchange: body.exchange,
          apiKey: body.apiKey,
          apiSecret: body.apiSecret,
          passphrase: body.passphrase,
          label: body.label,
        }
    if (!conn?.apiKey) {
      json(res, 400, { ok: false, error: 'missing_keys' })
      return true
    }
    try {
      const result = await testConnection(conn)
      if (conn.id) {
        patchConnectionMeta(dataDir, conn.id, {
          lastError: null,
          lastBalance: result.balance,
          lastTradeCount: result.tradeCount,
          lastSyncAt: Date.now(),
        })
      }
      json(res, 200, result)
    } catch (err) {
      if (conn.id) patchConnectionMeta(dataDir, conn.id, { lastError: String(err.message || err) })
      json(res, 400, { ok: false, error: String(err.message || err) })
    }
    return true
  }

  if (req.method === 'POST' && path === '/api/exchanges/sync') {
    const body = await readBody(req).catch(() => ({}))
    const store = loadStore(dataDir)
    const targets = body.id
      ? store.connections.filter((c) => c.id === body.id)
      : store.connections.filter((c) => c.enabled !== false)
    const results = []
    for (const conn of targets) {
      try {
        const data = await syncConnection(conn)
        patchConnectionMeta(dataDir, conn.id, {
          lastError: null,
          lastBalance: data.balance,
          lastTradeCount: data.trades.length,
          lastSyncAt: Date.now(),
        })
        results.push({
          id: conn.id,
          exchange: conn.exchange,
          ok: true,
          trades: data.trades,
          cash: data.cash,
          balance: data.balance,
          equity: data.equity,
          openPositions: data.openPositions,
          account: data.account,
        })
      } catch (err) {
        const error = String(err.message || err)
        patchConnectionMeta(dataDir, conn.id, { lastError: error })
        results.push({
          id: conn.id,
          exchange: conn.exchange,
          ok: false,
          error,
          trades: [],
          cash: [],
          openPositions: [],
        })
      }
    }
    json(res, 200, { ok: true, results })
    return true
  }

  return false
}
