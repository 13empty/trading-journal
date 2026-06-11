import type { Trade } from '../types/trade'
import { sortTradesRecentFirst } from './tradeSort'

export function tradePositionKey(t: Trade): string | null {
  if (t.positionId) return t.positionId
  const m = t.notes.match(/(?:Posici[oó]n|MT5)\s*#(\d+)/i)
  return m ? m[1] : null
}

/** Fusiona import: misma posición del Excel reemplaza la anterior */
export function mergeTrades(existing: Trade[], incoming: Trade[]): Trade[] {
  const map = new Map<string, Trade>()
  const noKey: Trade[] = []

  for (const t of existing) {
    const key = tradePositionKey(t)
    if (key) map.set(key, t)
    else noKey.push(t)
  }

  for (const t of incoming) {
    const key = tradePositionKey(t)
    if (key) map.set(key, t)
    else noKey.push(t)
  }

  return sortTradesRecentFirst([...map.values(), ...noKey])
}

/** En vivo (parches): fusiona cierres nuevos sin borrar el resto del calendario */
export function mergeMt5Live(local: Trade[], bridge: Trade[]): Trade[] {
  const bridgeKeys = new Set<string>()
  for (const t of bridge) {
    const k = tradePositionKey(t)
    if (k) bridgeKeys.add(k)
  }
  const manualOnly = local.filter((t) => {
    const k = tradePositionKey(t)
    return !k || !bridgeKeys.has(k)
  })
  return mergeTrades(manualOnly, bridge)
}

/** Sync completo: el puente reemplaza TODOS los trades MT5; solo quedan manuales sin positionId */
export function replaceMt5FromBridge(local: Trade[], bridge: Trade[]): Trade[] {
  const manualOnly = local.filter((t) => !tradePositionKey(t))
  return mergeTrades(manualOnly, bridge)
}

export function cashMovementKey(c: {
  date: string
  type: string
  category?: string
  amount: number
  notes: string
}): string {
  const mt5 = c.notes.match(/MT5\s*#(\d+)/i)
  if (mt5) return `ticket:${mt5[1]}`
  const autotrf = c.notes.match(/AutoTrf\s+(\d+)/i)
  if (autotrf) return `autotrf:${autotrf[1]}`
  return `sig:${c.date}|${c.category ?? c.type}|${c.amount}|${c.notes}`
}

export function dedupeCashMovements<
  T extends { date: string; type: string; category?: string; amount: number; notes: string },
>(items: T[]): T[] {
  const map = new Map<string, T>()
  for (const c of items) map.set(cashMovementKey(c), c)
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function mergeCashBySignature<
  T extends { date: string; type: string; category?: string; amount: number; notes: string },
>(
  existing: T[],
  incoming: T[],
): T[] {
  return dedupeCashMovements([...existing, ...incoming])
}
