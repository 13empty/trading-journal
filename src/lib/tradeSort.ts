import type { Trade } from '../types/trade'

function tradeTimeMs(t: Trade): number {
  if (t.closeTime) {
    const ms = Date.parse(t.closeTime)
    if (!Number.isNaN(ms)) return ms
  }
  const d = Date.parse(`${t.date}T12:00:00`)
  return Number.isNaN(d) ? 0 : d
}

function tradeStableId(t: Trade): string {
  return t.positionId ?? t.id ?? ''
}

/** Newest first; stable tie-breakers so MT5 re-sync does not reshuffle rows. */
export function compareTradesRecentFirst(a: Trade, b: Trade): number {
  const byDate = b.date.localeCompare(a.date)
  if (byDate !== 0) return byDate

  const byTime = tradeTimeMs(b) - tradeTimeMs(a)
  if (byTime !== 0) return byTime

  return tradeStableId(b).localeCompare(tradeStableId(a))
}

export function sortTradesRecentFirst(trades: Trade[]): Trade[] {
  return [...trades].sort(compareTradesRecentFirst)
}

export function tradesListKey(trades: Trade[]): string {
  return trades.map((t) => `${t.id}|${t.date}|${t.closeTime ?? ''}|${t.pnl}`).join('\n')
}
