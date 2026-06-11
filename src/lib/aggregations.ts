import {
  format,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfWeek,
} from 'date-fns'
import { parseLocalDateKey } from './mt5Date'
import type { Locale } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Trade, PeriodView, PeriodSummary, DaySummary } from '../types/trade'

export function groupByPeriod(
  trades: Trade[],
  view: PeriodView,
  dateLocale: Locale = es,
): PeriodSummary[] {
  const map = new Map<string, { pnl: number; trades: number; wins: number; losses: number; label: string }>()

  for (const t of trades) {
    const d = parseLocalDateKey(t.date)
    let key: string
    let label: string

    switch (view) {
      case 'day':
        key = t.date
        label = format(d, 'EEE d MMM yyyy', { locale: dateLocale })
        break
      case 'week': {
        const start = startOfWeek(d, { weekStartsOn: 1 })
        const end = endOfWeek(d, { weekStartsOn: 1 })
        key = format(start, 'yyyy-MM-dd')
        label = `${format(start, 'd MMM', { locale: dateLocale })} – ${format(end, 'd MMM yyyy', { locale: dateLocale })}`
        break
      }
      case 'month':
        key = format(startOfMonth(d), 'yyyy-MM')
        label = format(d, 'MMMM yyyy', { locale: dateLocale })
        break
      case 'year':
        key = format(startOfYear(d), 'yyyy')
        label = format(d, 'yyyy', { locale: es })
        break
    }

    const cur = map.get(key) ?? { pnl: 0, trades: 0, wins: 0, losses: 0, label }
    cur.pnl += t.pnl
    cur.trades += 1
    if (t.pnl >= 0) cur.wins += 1
    else cur.losses += 1
    map.set(key, cur)
  }

  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, pnl: v.pnl, trades: v.trades, wins: v.wins, losses: v.losses }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

export function dailyTotals(trades: Trade[]): DaySummary[] {
  const map = new Map<string, { pnl: number; trades: number }>()
  for (const t of trades) {
    const cur = map.get(t.date) ?? { pnl: 0, trades: 0 }
    cur.pnl += t.pnl
    cur.trades += 1
    map.set(t.date, cur)
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, pnl: v.pnl, trades: v.trades }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function totalPnl(trades: Trade[]): number {
  return trades.reduce((s, t) => s + t.pnl, 0)
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  return (trades.filter((t) => t.pnl >= 0).length / trades.length) * 100
}

export function formatMoney(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${n.toFixed(2)}`
}

export function pnlClass(n: number): string {
  if (n > 0) return 'positive'
  if (n < 0) return 'negative'
  return 'neutral'
}
