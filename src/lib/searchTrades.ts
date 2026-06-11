import type { TradeMeta } from '../types/journal'
import type { Trade } from '../types/trade'
import { tradeMetaKey } from './journalStorage'

export interface TradeSearchFilters {
  query: string
  symbol: string
  fromDate: string
  toDate: string
  outcome: 'all' | 'win' | 'loss'
  tag: string
}

export const emptySearchFilters = (): TradeSearchFilters => ({
  query: '',
  symbol: '',
  fromDate: '',
  toDate: '',
  outcome: 'all',
  tag: '',
})

export function searchTrades(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
  filters: TradeSearchFilters,
): Trade[] {
  const q = filters.query.trim().toLowerCase()
  const sym = filters.symbol.trim().toUpperCase()
  const tag = filters.tag.trim().toLowerCase()

  return trades.filter((t) => {
    const net = t.pnl
    if (filters.outcome === 'win' && net < 0) return false
    if (filters.outcome === 'loss' && net >= 0) return false
    if (sym && t.symbol.toUpperCase() !== sym && !t.symbol.toUpperCase().includes(sym)) return false
    if (filters.fromDate && t.date < filters.fromDate) return false
    if (filters.toDate && t.date > filters.toDate) return false

    if (tag) {
      const tags = metaMap[tradeMetaKey(t)]?.tags ?? []
      if (!tags.some((x) => x.toLowerCase().includes(tag))) return false
    }

    if (q) {
      const meta = metaMap[tradeMetaKey(t)]
      const hay = [
        t.symbol,
        t.notes,
        t.positionId ?? '',
        meta?.journalNotes ?? '',
        ...(meta?.tags ?? []),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })
}

export function uniqueSymbols(trades: Trade[]): string[] {
  return [...new Set(trades.map((t) => t.symbol).filter(Boolean))].sort()
}
