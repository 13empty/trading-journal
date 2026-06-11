import type { CalendarPnlDisplay, DayActivity } from '../types/account'
import { formatMoney } from './aggregations'

export function dayStartBalance(day: DayActivity): number {
  return day.endBalance - day.netCash - day.grossPnl + day.fees
}

export function dayPnlPercent(day: DayActivity): number | null {
  const start = dayStartBalance(day)
  if (start <= 0) return null
  return (day.pnl / start) * 100
}

export function pnlPercentFromTotal(total: number, startBalance: number): number | null {
  if (startBalance <= 0) return null
  return (total / startBalance) * 100
}

export function balanceBeforeDate(
  dayMap: Map<string, DayActivity>,
  dateKey: string,
  initialBalance: number,
): number {
  const sorted = [...dayMap.keys()].sort()
  const prior = sorted.filter((d) => d < dateKey).pop()
  if (prior) return dayMap.get(prior)!.endBalance
  const current = dayMap.get(dateKey)
  if (current) return dayStartBalance(current)
  return initialBalance
}

export function monthReferenceBalance(
  dayMap: Map<string, DayActivity>,
  monthKey: string,
  initialBalance: number,
): number {
  const monthStart = `${monthKey}-01`
  return balanceBeforeDate(dayMap, monthStart, initialBalance)
}

export function weekReferenceBalance(
  weekDays: (Date | null)[],
  dayMap: Map<string, DayActivity>,
  initialBalance: number,
): number {
  const dates = weekDays
    .filter((d): d is Date => d != null)
    .map((d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })
    .sort()

  if (dates.length === 0) return initialBalance
  return balanceBeforeDate(dayMap, dates[0], initialBalance)
}

export function formatCompactPnl(n: number): string {
  if (n === 0) return '0'
  return formatMoney(n).replace('$', '')
}

export function formatCompactPercent(pct: number): string {
  const abs = Math.abs(pct)
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : ''
  if (abs >= 100) return `${sign}${Math.abs(pct).toFixed(1)}%`
  return `${sign}${Math.abs(pct).toFixed(2)}%`
}

export function formatCalendarPnl(
  mode: CalendarPnlDisplay,
  pnl: number,
  pct: number | null,
  isLive = false,
): string {
  const star = isLive ? '*' : ''
  const dollar = pnl === 0 ? '0' : formatCompactPnl(pnl)
  const percent = pct == null ? '—' : formatCompactPercent(pct)

  if (mode === 'dollar') return `${dollar}${star}`
  if (mode === 'percent') return `${percent}${star}`
  return `${dollar} · ${percent}${star}`
}
