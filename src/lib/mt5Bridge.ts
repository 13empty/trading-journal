import type { CashMovement, Mt5OpenPosition } from '../types/account'
import type { Trade } from '../types/trade'

export const BRIDGE_URL = 'http://127.0.0.1:3847'

export interface Mt5Status {
  connected: boolean
  lastSeen: number | null
  account: string | null
  balance: number | null
  equity: number | null
  tradeCount?: number
}

export interface Mt5SyncPayload {
  trades?: Trade[]
  cashMovements?: CashMovement[]
  balance?: number | null
  equity?: number | null
  openPositions?: Mt5OpenPosition[]
  account?: string | null
  lastSeen?: number | null
  full?: boolean
  light?: boolean
  patch?: boolean
  tradeCount?: number
}

export async function fetchMt5Status(): Promise<Mt5Status | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/status`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = await res.json()
    return {
      connected: Boolean(data.connected),
      lastSeen: data.lastSeen ?? null,
      account: data.account ?? null,
      balance: data.balance ?? null,
      equity: data.equity ?? null,
      tradeCount: data.tradeCount ?? null,
    }
  } catch {
    return null
  }
}

export async function reloadBridgeFromDisk(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/reload`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchMt5Sync(): Promise<Mt5SyncPayload | null> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/sync`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    return (await res.json()) as Mt5SyncPayload
  } catch {
    return null
  }
}

export function connectMt5WebSocket(
  onSync: (payload: Mt5SyncPayload) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  let ws: WebSocket | null = null
  let closed = false

  const connect = () => {
    if (closed) return
    try {
      ws = new WebSocket(`ws://127.0.0.1:3847`)
      ws.onopen = () => onStatus?.(true)
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg.type === 'sync') {
            onSync({
              trades: msg.trades,
              cashMovements: msg.cashMovements,
              balance: msg.balance ?? null,
              equity: msg.equity ?? null,
              openPositions: msg.openPositions ?? [],
              account: msg.account ?? null,
              lastSeen: msg.lastSeen ?? Date.now(),
              full: Boolean(msg.full),
              light: Boolean(msg.light),
              patch: Boolean(msg.patch),
              tradeCount: msg.tradeCount ?? msg.trades?.length,
            })
          }
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        onStatus?.(false)
        if (!closed) setTimeout(connect, 3000)
      }
      ws.onerror = () => ws?.close()
    } catch {
      onStatus?.(false)
      if (!closed) setTimeout(connect, 3000)
    }
  }

  connect()

  return () => {
    closed = true
    ws?.close()
  }
}
