import { BRIDGE_URL } from './mt5Bridge'
import type { CashMovement, Mt5OpenPosition } from '../types/account'
import type { Trade } from '../types/trade'

export interface ExchangeCatalogItem {
  id: string
  name: string
  needsPassphrase: boolean
  market: string
}

export interface ExchangeConnectionPublic {
  id: string
  exchange: string
  label: string
  enabled: boolean
  needsPassphrase: boolean
  apiKeyMasked: string
  hasSecret: boolean
  lastSyncAt: number | null
  lastError: string | null
  lastTradeCount: number
  balance: number | null
}

export interface ExchangeSyncResult {
  id: string
  exchange: string
  ok: boolean
  error?: string
  trades: Trade[]
  cash: CashMovement[]
  balance?: number | null
  equity?: number | null
  openPositions: Mt5OpenPosition[]
  account?: string
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  return data
}

export async function fetchExchangeCatalog(): Promise<ExchangeCatalogItem[]> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/exchanges/catalog`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const data = await parseJson(res)
    return Array.isArray(data.exchanges) ? data.exchanges : []
  } catch {
    return []
  }
}

export async function fetchExchangeConnections(): Promise<ExchangeConnectionPublic[]> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/exchanges`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const data = await parseJson(res)
    return Array.isArray(data.connections) ? data.connections : []
  } catch {
    return []
  }
}

export async function saveExchangeConnection(payload: {
  id?: string
  exchange: string
  apiKey: string
  apiSecret: string
  passphrase?: string
  label?: string
}): Promise<{ ok: boolean; error?: string; connection?: ExchangeConnectionPublic }> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/exchanges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    const data = await parseJson(res)
    if (!res.ok || data.ok === false) return { ok: false, error: data.error || 'save_failed' }
    return { ok: true, connection: data.connection }
  } catch {
    return { ok: false, error: 'bridge_offline' }
  }
}

export async function deleteExchangeConnection(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/exchanges/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function testExchangeConnection(payload: {
  id?: string
  exchange?: string
  apiKey?: string
  apiSecret?: string
  passphrase?: string
  label?: string
}): Promise<{ ok: boolean; error?: string; balance?: number | null; tradeCount?: number }> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/exchanges/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    })
    const data = await parseJson(res)
    if (!res.ok || data.ok === false) return { ok: false, error: data.error || 'test_failed' }
    return { ok: true, balance: data.balance, tradeCount: data.tradeCount }
  } catch {
    return { ok: false, error: 'bridge_offline' }
  }
}

export async function syncExchanges(id?: string): Promise<ExchangeSyncResult[]> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/exchanges/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
      signal: AbortSignal.timeout(120000),
    })
    const data = await parseJson(res)
    return Array.isArray(data.results) ? data.results : []
  } catch {
    return []
  }
}
