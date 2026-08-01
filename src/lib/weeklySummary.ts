import { endOfWeek, format, startOfWeek } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { Trade } from '../types/trade'
import { winRate } from './aggregations'
import { parseLocalDateKey } from './mt5Date'

export interface WeeklySummaryData {
  weekStart: string
  weekEnd: string
  totalPnl: number
  tradingDays: number
  greenDays: number
  redDays: number
  tradeCount: number
  winRatePct: number
  bestDay: { date: string; pnl: number } | null
  worstDay: { date: string; pnl: number } | null
  topSymbols: { symbol: string; pnl: number; trades: number }[]
}

export function weekBoundsForDate(dateKey: string): { start: string; end: string } {
  const d = parseLocalDateKey(dateKey)
  return {
    start: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  }
}

export function buildWeeklySummary(
  dayMap: Map<string, DayActivity>,
  trades: Trade[],
  anchorDate: string,
): WeeklySummaryData {
  const { start, end } = weekBoundsForDate(anchorDate)
  const weekDays: DayActivity[] = []

  for (const [date, activity] of dayMap) {
    if (date >= start && date <= end) weekDays.push(activity)
  }

  weekDays.sort((a, b) => a.date.localeCompare(b.date))

  const weekTrades = trades.filter((t) => t.date >= start && t.date <= end)
  let totalPnl = 0
  let greenDays = 0
  let redDays = 0
  let bestDay: { date: string; pnl: number } | null = null
  let worstDay: { date: string; pnl: number } | null = null

  for (const day of weekDays) {
    totalPnl += day.pnl
    if (day.pnl > 0) greenDays += 1
    else if (day.pnl < 0) redDays += 1

    if (!bestDay || day.pnl > bestDay.pnl) bestDay = { date: day.date, pnl: day.pnl }
    if (!worstDay || day.pnl < worstDay.pnl) worstDay = { date: day.date, pnl: day.pnl }
  }

  const symbolMap = new Map<string, { pnl: number; trades: number }>()
  for (const t of weekTrades) {
    const cur = symbolMap.get(t.symbol) ?? { pnl: 0, trades: 0 }
    cur.pnl += t.pnl
    cur.trades += 1
    symbolMap.set(t.symbol, cur)
  }

  const topSymbols = [...symbolMap.entries()]
    .map(([symbol, v]) => ({ symbol, pnl: v.pnl, trades: v.trades }))
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 5)

  return {
    weekStart: start,
    weekEnd: end,
    totalPnl,
    tradingDays: weekDays.length,
    greenDays,
    redDays,
    tradeCount: weekTrades.length,
    winRatePct: winRate(weekTrades),
    bestDay: weekDays.length > 0 ? bestDay : null,
    worstDay: weekDays.length > 0 ? worstDay : null,
    topSymbols,
  }
}
