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

export interface CloseAllResult {
  ok: boolean
  queued?: boolean
  commandId?: string
  error?: string
  alreadyQueued?: boolean
}

export interface CloseAllCommandResult {
  ok: boolean
  pending?: boolean
  idle?: boolean
  closed?: number
  failed?: number
  commandId?: string
  errors?: string[]
  error?: string
}

/** Ask the local bridge to queue a close-all for the Python MT5 agent. */
export async function requestCloseAllPositions(reason = 'day_rule'): Promise<CloseAllResult> {
  try {
    const res = await fetch(`${BRIDGE_URL}/api/close-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = (await res.json()) as {
      ok?: boolean
      alreadyQueued?: boolean
      command?: { id?: string }
    }
    return {
      ok: Boolean(data.ok),
      queued: true,
      alreadyQueued: Boolean(data.alreadyQueued),
      commandId: data.command?.id,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Poll until Python reports the close-all result (or timeout). */
export async function waitForCloseAllResult(
  commandId: string | undefined,
  timeoutMs = 45_000,
): Promise<CloseAllCommandResult> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BRIDGE_URL}/api/command/result`, {
        signal: AbortSignal.timeout(4000),
      })
      if (res.ok) {
        const data = (await res.json()) as CloseAllCommandResult
        if (data.pending) {
          // still running
        } else if (data.idle && !data.commandId) {
          // no result yet / already cleared without match — keep waiting a bit
        } else if (commandId && data.commandId && data.commandId !== commandId) {
          // different command
        } else if (!data.pending) {
          return data
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return { ok: false, pending: true, error: 'timeout', commandId }
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
