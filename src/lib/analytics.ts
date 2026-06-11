import { differenceInMinutes, format, parse, startOfMonth, subMonths } from 'date-fns'
import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type {
  AdvancedMetrics,
  DrawdownInfo,
  EquityPoint,
  PeriodCompare,
  SessionStats,
  StreakInfo,
  SymbolStats,
  TradeMeta,
  TradingSession,
} from '../types/journal'
import type { Trade } from '../types/trade'
import { tradePositionKey } from './mergeTrades'
import { parseLocalDateKey } from './mt5Date'

/** Profit de MT5 por operación (columna Profit del historial). */
export function netPnl(t: Trade): number {
  return t.pnl
}

export function parseTradeDateTime(value?: string): Date | null {
  if (!value) return null
  const s = value.trim()
  const mt5 = parse(s, 'yyyy-MM-dd HH:mm:ss', new Date())
  if (!Number.isNaN(mt5.getTime())) return mt5
  const iso = new Date(s)
  return Number.isNaN(iso.getTime()) ? null : iso
}

export function tradeSession(closeTime?: string): TradingSession | null {
  const dt = parseTradeDateTime(closeTime)
  if (!dt) return null
  const h = dt.getUTCHours()
  if (h >= 0 && h < 8) return 'asia'
  if (h >= 8 && h < 13) return 'london'
  if (h >= 13 && h < 21) return 'ny'
  return 'other'
}

export function tradeHoldMinutes(trade: Trade): number | null {
  const open = parseTradeDateTime(trade.openTime)
  const close = parseTradeDateTime(trade.closeTime)
  if (!open || !close) return null
  const mins = differenceInMinutes(close, open)
  return mins >= 0 ? mins : null
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function computeExpectancy(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter((t) => netPnl(t) > 0)
  const losses = trades.filter((t) => netPnl(t) < 0)
  const winPct = wins.length / trades.length
  const lossPct = losses.length / trades.length
  const avgWin = wins.length ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length)
    : 0
  return winPct * avgWin - lossPct * avgLoss
}

export function computeProfitFactor(trades: Trade[]): number {
  const grossProfit = trades.filter((t) => netPnl(t) > 0).reduce((s, t) => s + netPnl(t), 0)
  const grossLoss = Math.abs(trades.filter((t) => netPnl(t) < 0).reduce((s, t) => s + netPnl(t), 0))
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0
  return grossProfit / grossLoss
}

export function computeSymbolStats(trades: Trade[]): SymbolStats[] {
  const map = new Map<string, SymbolStats>()
  for (const t of trades) {
    const cur = map.get(t.symbol) ?? {
      symbol: t.symbol,
      trades: 0,
      wins: 0,
      losses: 0,
      pnl: 0,
      fees: 0,
      swap: 0,
      winRate: 0,
      avgPnl: 0,
    }
    const net = netPnl(t)
    cur.trades += 1
    cur.pnl += net
    cur.fees += t.fees
    cur.swap += t.swap ?? 0
    if (net >= 0) cur.wins += 1
    else cur.losses += 1
    map.set(t.symbol, cur)
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      winRate: s.trades ? (s.wins / s.trades) * 100 : 0,
      avgPnl: s.trades ? s.pnl / s.trades : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl)
}

export function computeSessionStats(trades: Trade[]): SessionStats[] {
  const map = new Map<TradingSession, SessionStats>()
  for (const t of trades) {
    const session = tradeSession(t.closeTime)
    if (!session) continue
    const cur = map.get(session) ?? { session, trades: 0, pnl: 0, winRate: 0 }
    cur.trades += 1
    cur.pnl += netPnl(t)
    map.set(session, cur)
  }
  return [...map.values()]
    .map((s) => {
      const wins = trades.filter(
        (t) => tradeSession(t.closeTime) === s.session && netPnl(t) >= 0,
      ).length
      return { ...s, winRate: s.trades ? (wins / s.trades) * 100 : 0 }
    })
    .sort((a, b) => b.pnl - a.pnl)
}

function tradeStreaks(trades: Trade[]): Pick<StreakInfo, 'currentWin' | 'currentLoss' | 'maxWin' | 'maxLoss'> {
  const sorted = [...trades].sort((a, b) => {
    const ta = parseTradeDateTime(a.closeTime)?.getTime() ?? parseLocalDateKey(a.date).getTime()
    const tb = parseTradeDateTime(b.closeTime)?.getTime() ?? parseLocalDateKey(b.date).getTime()
    return ta - tb
  })
  let currentWin = 0
  let currentLoss = 0
  let maxWin = 0
  let maxLoss = 0
  for (const t of sorted) {
    if (netPnl(t) >= 0) {
      currentWin += 1
      currentLoss = 0
      maxWin = Math.max(maxWin, currentWin)
    } else {
      currentLoss += 1
      currentWin = 0
      maxLoss = Math.max(maxLoss, currentLoss)
    }
  }
  return { currentWin, currentLoss, maxWin, maxLoss }
}

function dayStreaks(activities: DayActivity[]): Pick<
  StreakInfo,
  'currentGreenDays' | 'currentRedDays' | 'maxGreenDays' | 'maxRedDays'
> {
  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date))
  let currentGreenDays = 0
  let currentRedDays = 0
  let maxGreenDays = 0
  let maxRedDays = 0
  for (const d of sorted) {
    if (d.pnl > 0) {
      currentGreenDays += 1
      currentRedDays = 0
      maxGreenDays = Math.max(maxGreenDays, currentGreenDays)
    } else if (d.pnl < 0) {
      currentRedDays += 1
      currentGreenDays = 0
      maxRedDays = Math.max(maxRedDays, currentRedDays)
    } else {
      currentGreenDays = 0
      currentRedDays = 0
    }
  }
  return { currentGreenDays, currentRedDays, maxGreenDays, maxRedDays }
}

export function computeStreaks(trades: Trade[], activities: DayActivity[]): StreakInfo {
  return { ...tradeStreaks(trades), ...dayStreaks(activities) }
}

export function buildEquityCurve(activities: DayActivity[]): EquityPoint[] {
  let cumulative = 0
  return [...activities]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      cumulative += d.pnl
      return { date: d.date, balance: cumulative, pnl: d.pnl }
    })
}

export function computeDrawdown(curve: EquityPoint[]): DrawdownInfo {
  if (curve.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      peakBalance: 0,
      troughBalance: 0,
      peakDate: '',
      troughDate: '',
    }
  }
  let peak = curve[0].balance
  let peakDate = curve[0].date
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  let troughBalance = peak
  let troughDate = peakDate
  let bestPeak = peak
  let bestPeakDate = peakDate

  for (const pt of curve) {
    if (pt.balance >= peak) {
      peak = pt.balance
      peakDate = pt.date
    }
    const dd = peak - pt.balance
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownPct = ddPct
      troughBalance = pt.balance
      troughDate = pt.date
      bestPeak = peak
      bestPeakDate = peakDate
    }
  }

  return {
    maxDrawdown,
    maxDrawdownPct,
    peakBalance: bestPeak,
    troughBalance,
    peakDate: bestPeakDate,
    troughDate,
  }
}

export function tradeMetaKey(trade: Trade): string {
  return tradePositionKey(trade) ?? trade.id
}

export function effectiveRR(trade: Trade, meta?: TradeMeta): number | null {
  if (meta?.rrRatio != null && meta.rrRatio > 0) return meta.rrRatio
  if (meta?.riskAmount && meta?.rewardAmount && meta.riskAmount > 0) {
    return meta.rewardAmount / meta.riskAmount
  }
  const risk = meta?.riskAmount
  if (risk && risk > 0) return Math.abs(netPnl(trade)) / risk
  return null
}

export function effectiveRiskPct(
  _trade: Trade,
  meta: TradeMeta | undefined,
  balanceAtTrade: number,
): number | null {
  if (meta?.riskPercent != null && meta.riskPercent > 0) return meta.riskPercent
  if (meta?.riskAmount && balanceAtTrade > 0) return (meta.riskAmount / balanceAtTrade) * 100
  return null
}

export function computeAdvancedMetrics(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
  balanceByDate: Map<string, number>,
): AdvancedMetrics {
  const wins = trades.filter((t) => netPnl(t) > 0)
  const losses = trades.filter((t) => netPnl(t) < 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + netPnl(t), 0) / wins.length : 0
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + netPnl(t), 0) / losses.length)
    : 0

  const rrValues: number[] = []
  const riskPctValues: number[] = []
  const holdValues: number[] = []

  for (const t of trades) {
    const key = tradeMetaKey(t)
    const meta = metaMap[key]
    const rr = effectiveRR(t, meta)
    if (rr != null) rrValues.push(rr)
    const bal = balanceByDate.get(t.date) ?? 0
    const rp = effectiveRiskPct(t, meta, bal)
    if (rp != null) riskPctValues.push(rp)
    const hold = tradeHoldMinutes(t)
    if (hold != null) holdValues.push(hold)
  }

  return {
    expectancy: computeExpectancy(trades),
    profitFactor: computeProfitFactor(trades),
    avgWin,
    avgLoss,
    avgRR: rrValues.length ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0,
    avgRiskPct: riskPctValues.length
      ? riskPctValues.reduce((a, b) => a + b, 0) / riskPctValues.length
      : 0,
    avgHoldMinutes: holdValues.length
      ? holdValues.reduce((a, b) => a + b, 0) / holdValues.length
      : 0,
  }
}

export function compareMonths(
  trades: Trade[],
  refDate: Date,
  dateLocale: Locale,
): PeriodCompare {
  const curStart = startOfMonth(refDate)
  const prevStart = startOfMonth(subMonths(refDate, 1))
  const curKey = format(curStart, 'yyyy-MM')
  const prevKey = format(prevStart, 'yyyy-MM')

  const bucket = (key: string) => {
    const subset = trades.filter((t) => t.date.startsWith(key))
    const wins = subset.filter((t) => netPnl(t) >= 0).length
    return {
      pnl: subset.reduce((s, t) => s + netPnl(t), 0),
      trades: subset.length,
      winRate: subset.length ? (wins / subset.length) * 100 : 0,
    }
  }

  return {
    label: `${format(prevStart, 'MMM yyyy', { locale: dateLocale })} vs ${format(curStart, 'MMM yyyy', { locale: dateLocale })}`,
    current: bucket(curKey),
    previous: bucket(prevKey),
  }
}

export function filterByAccount(trades: Trade[], accountId: string | null): Trade[] {
  if (!accountId) return trades
  return trades.filter((t) => (t.accountId ? t.accountId === accountId : accountId === 'default'))
}

export function uniqueAccounts(trades: Trade[], known: string[] = []): string[] {
  const set = new Set(known)
  for (const t of trades) {
    if (t.accountId) set.add(t.accountId)
  }
  return [...set].sort()
}

export function swapBySymbol(trades: Trade[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of trades) {
    const swap = t.swap ?? 0
    if (swap === 0) continue
    map.set(t.symbol, (map.get(t.symbol) ?? 0) + swap)
  }
  return map
}

export function feesByDay(trades: Trade[]): Map<string, { fees: number; swap: number }> {
  const map = new Map<string, { fees: number; swap: number }>()
  for (const t of trades) {
    const cur = map.get(t.date) ?? { fees: 0, swap: 0 }
    cur.fees += t.commission ?? t.fees
    cur.swap += t.swap ?? 0
    map.set(t.date, cur)
  }
  return map
}

export function goalAlert(
  dayPnl: number,
  goals: { dailyLossLimit?: number; alertOnLossLimit?: boolean },
): string | null {
  if (!goals.alertOnLossLimit || !goals.dailyLossLimit) return null
  if (dayPnl <= -Math.abs(goals.dailyLossLimit)) {
    return 'loss_limit'
  }
  return null
}

export function weeklyPnl(activities: DayActivity[], weekStart: Date): number {
  const startKey = format(weekStart, 'yyyy-MM-dd')
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const endKey = format(end, 'yyyy-MM-dd')
  return activities
    .filter((a) => a.date >= startKey && a.date <= endKey)
    .reduce((s, a) => s + a.pnl, 0)
}
