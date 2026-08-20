import { differenceInMinutes, format, parse, startOfMonth, subMonths } from 'date-fns'
import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type {
  AdvancedMetrics,
  DrawdownInfo,
  EquityPoint,
  MistakeStats,
  PeriodCompare,
  SessionStats,
  SetupComboStats,
  StreakInfo,
  SymbolStats,
  TradeMeta,
  TradingSession,
} from '../types/journal'
import type { Trade } from '../types/trade'
import { tradePositionKey } from './mergeTrades'
import { parseLocalDateKey } from './mt5Date'
import { formatDisplayDate } from './dateDisplay'

/** Profit de MT5 por operación (columna Profit del historial). */
export function netPnl(t: Trade): number {
  return t.pnl
}

/**
 * Balance at the start of each day (before that day's PnL / cash).
 * Prefer this over endBalance for result %.
 */
export function balanceBeforeByDate(
  activities: DayActivity[],
  initialBalance: number,
): Map<string, number> {
  const map = new Map<string, number>()
  let running = initialBalance
  for (const d of activities) {
    map.set(d.date, running)
    running += d.netCash + (d.grossPnl - d.fees)
  }
  return map
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

/** Prefer open time for session (when the trade was taken). */
export function tradeSessionFromTrade(trade: Trade): TradingSession | null {
  return tradeSession(trade.openTime) ?? tradeSession(trade.closeTime)
}

export function effectiveRiskAmount(trade: Trade, meta?: TradeMeta): number | null {
  if (meta?.riskAmount != null && meta.riskAmount > 0) return meta.riskAmount
  if (trade.riskAmount != null && trade.riskAmount > 0) return trade.riskAmount
  return null
}

export function effectiveStopLoss(trade: Trade, meta?: TradeMeta): number | null {
  if (meta?.stopLoss != null && meta.stopLoss > 0) return meta.stopLoss
  if (trade.stopLoss != null && trade.stopLoss > 0) return trade.stopLoss
  return null
}

export function effectiveTakeProfit(trade: Trade, meta?: TradeMeta): number | null {
  if (meta?.takeProfit != null && meta.takeProfit > 0) return meta.takeProfit
  if (trade.takeProfit != null && trade.takeProfit > 0) return trade.takeProfit
  return null
}

export function effectiveMfeR(trade: Trade, meta?: TradeMeta): number | null {
  if (meta?.mfeR != null && Number.isFinite(meta.mfeR)) return meta.mfeR
  if (trade.mfeR != null && Number.isFinite(trade.mfeR)) return trade.mfeR
  return null
}

export function effectiveMaeR(trade: Trade, meta?: TradeMeta): number | null {
  if (meta?.maeR != null && Number.isFinite(meta.maeR)) return meta.maeR
  if (trade.maeR != null && Number.isFinite(trade.maeR)) return trade.maeR
  return null
}

export function tradeHoldMinutes(trade: Trade): number | null {
  const open = parseTradeDateTime(trade.openTime)
  const close = parseTradeDateTime(trade.closeTime)
  if (!open || !close) return null
  const mins = differenceInMinutes(close, open)
  return mins >= 0 ? mins : null
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—'
  const total = Math.round(minutes)
  if (total < 60) return `${total}m`
  const h = Math.floor(total / 60)
  const m = total % 60
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

export function computeSessionStats(
  trades: Trade[],
  metaMap: Record<string, TradeMeta> = {},
): SessionStats[] {
  const map = new Map<TradingSession, SessionStats>()
  for (const t of trades) {
    const meta = metaMap[tradeMetaKey(t)]
    const session = resolveTradeSession(t, meta)
    if (!session) continue
    const cur = map.get(session) ?? { session, trades: 0, pnl: 0, winRate: 0 }
    cur.trades += 1
    cur.pnl += netPnl(t)
    map.set(session, cur)
  }
  return [...map.values()]
    .map((s) => {
      const wins = trades.filter((t) => {
        const meta = metaMap[tradeMetaKey(t)]
        return resolveTradeSession(t, meta) === s.session && netPnl(t) >= 0
      }).length
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

export interface RecentEquitySummary {
  dayCount: number
  totalPnl: number
  periodPct: number | null
  avgDailyPnl: number
  greenDays: number
  redDays: number
  bestDayPnl: number
  bestDayDate: string
}

export function summarizeRecentEquity(points: EquityPoint[]): RecentEquitySummary | null {
  if (points.length === 0) return null

  const totalPnl = points.reduce((sum, p) => sum + p.pnl, 0)
  const startEquity = points[0].balance - points[0].pnl
  const periodPct = startEquity !== 0 ? (totalPnl / Math.abs(startEquity)) * 100 : null
  const best = points.reduce((a, b) => (b.pnl > a.pnl ? b : a), points[0])

  return {
    dayCount: points.length,
    totalPnl,
    periodPct,
    avgDailyPnl: totalPnl / points.length,
    greenDays: points.filter((p) => p.pnl > 0).length,
    redDays: points.filter((p) => p.pnl < 0).length,
    bestDayPnl: best.pnl,
    bestDayDate: best.date,
  }
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
  const risk = effectiveRiskAmount(trade, meta)
  if (meta?.rewardAmount && risk && risk > 0) {
    return meta.rewardAmount / risk
  }
  if (risk && risk > 0) return Math.abs(netPnl(trade)) / risk
  return null
}

/**
 * Signed realized R for the trade.
 * Prefer pnl / riskAmount (meta override or MT5 auto); else planned rrRatio.
 */
export function realizedR(trade: Trade, meta?: TradeMeta): number | null {
  const pnl = netPnl(trade)
  const risk = effectiveRiskAmount(trade, meta)
  if (risk && risk > 0) return pnl / risk
  if (meta?.rrRatio != null && meta.rrRatio > 0) {
    if (pnl > 0) return meta.rrRatio
    if (pnl < 0) return -1
    return 0
  }
  return null
}

/** PnL as % of balance at the trade date (or provided balance). */
export function resultPct(trade: Trade, balance: number): number | null {
  if (!(balance > 0)) return null
  return (netPnl(trade) / balance) * 100
}

/** Session from journal override, else auto from open time (fallback close). */
export function resolveTradeSession(trade: Trade, meta?: TradeMeta): TradingSession | null {
  if (meta?.session) return meta.session
  return tradeSessionFromTrade(trade)
}

export const SETUP_PRESETS = [
  'fvg',
  'order_block',
  'breakout',
  'liquidity_sweep',
  'bos',
  'choch',
  'supply_demand',
  'trend_continuation',
  'reversal',
  'other',
] as const

export const TIMEFRAME_PRESETS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const

export const MISTAKE_PRESETS = [
  'entered_late',
  'no_confirmation',
  'moved_sl',
  'early_tp',
  'revenge',
  'overtrading',
  'outside_hours',
  'risk_too_high',
  'broke_rule',
  'wrong_setup',
] as const

/** Aggregate P&L by mistake tag (worst first). */
export function computeMistakeStats(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
  topN = 5,
): MistakeStats[] {
  const map = new Map<string, { trades: number; pnl: number }>()
  for (const t of trades) {
    const mistakes = metaMap[tradeMetaKey(t)]?.mistakes
    if (!mistakes?.length) continue
    const pnl = netPnl(t)
    const unique = [...new Set(mistakes)]
    for (const m of unique) {
      if (!m) continue
      const cur = map.get(m) ?? { trades: 0, pnl: 0 }
      cur.trades += 1
      cur.pnl += pnl
      map.set(m, cur)
    }
  }
  return [...map.entries()]
    .map(([mistake, s]) => ({
      mistake,
      trades: s.trades,
      pnl: s.pnl,
      avgPnl: s.trades ? s.pnl / s.trades : 0,
    }))
    .sort((a, b) => a.pnl - b.pnl)
    .slice(0, topN)
}

export function computeSetupComboStats(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
  balanceByDate: Map<string, number>,
): SetupComboStats[] {
  type Acc = {
    setup: string
    session: TradingSession
    side: 'long' | 'short'
    trades: number
    wins: number
    losses: number
    pnl: number
    rSum: number
    rCount: number
    pctSum: number
    pctCount: number
  }
  const map = new Map<string, Acc>()

  for (const t of trades) {
    const meta = metaMap[tradeMetaKey(t)]
    const setup = meta?.setup?.trim()
    if (!setup) continue
    const session = resolveTradeSession(t, meta)
    if (!session) continue
    const key = `${setup}|${session}|${t.side}`
    const cur = map.get(key) ?? {
      setup,
      session,
      side: t.side,
      trades: 0,
      wins: 0,
      losses: 0,
      pnl: 0,
      rSum: 0,
      rCount: 0,
      pctSum: 0,
      pctCount: 0,
    }
    const pnl = netPnl(t)
    cur.trades += 1
    cur.pnl += pnl
    if (pnl >= 0) cur.wins += 1
    else cur.losses += 1

    const r = realizedR(t, meta)
    if (r != null) {
      cur.rSum += r
      cur.rCount += 1
    }
    const bal = balanceByDate.get(t.date) ?? 0
    const pct = resultPct(t, bal)
    if (pct != null) {
      cur.pctSum += pct
      cur.pctCount += 1
    }
    map.set(key, cur)
  }

  return [...map.values()]
    .map((s) => ({
      setup: s.setup,
      session: s.session,
      side: s.side,
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      winRate: s.trades ? (s.wins / s.trades) * 100 : 0,
      expectancyR: s.rCount ? s.rSum / s.rCount : null,
      rSampleCount: s.rCount,
      pnl: s.pnl,
      avgPnl: s.trades ? s.pnl / s.trades : 0,
      avgPct: s.pctCount ? s.pctSum / s.pctCount : null,
      pctSampleCount: s.pctCount,
    }))
    .sort((a, b) => {
      const ar = a.expectancyR ?? -Infinity
      const br = b.expectancyR ?? -Infinity
      if (br !== ar) return br - ar
      return b.trades - a.trades
    })
}

export function effectiveRiskPct(
  trade: Trade,
  meta: TradeMeta | undefined,
  balanceAtTrade: number,
): number | null {
  if (meta?.riskPercent != null && meta.riskPercent > 0) return meta.riskPercent
  const risk = effectiveRiskAmount(trade, meta)
  if (risk && balanceAtTrade > 0) return (risk / balanceAtTrade) * 100
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
  const riskAmountValues: number[] = []
  const holdValues: number[] = []

  for (const t of trades) {
    const key = tradeMetaKey(t)
    const meta = metaMap[key]
    const rr = effectiveRR(t, meta)
    if (rr != null) rrValues.push(rr)
    const bal = balanceByDate.get(t.date) ?? 0
    const rp = effectiveRiskPct(t, meta, bal)
    if (rp != null) riskPctValues.push(rp)
    const risk = effectiveRiskAmount(t, meta)
    if (risk != null && risk > 0) riskAmountValues.push(risk)
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
    avgRiskAmount: riskAmountValues.length
      ? riskAmountValues.reduce((a, b) => a + b, 0) / riskAmountValues.length
      : 0,
    riskPctSampleCount: riskPctValues.length,
    riskAmountSampleCount: riskAmountValues.length,
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
    label: `${formatDisplayDate(prevStart, 'MMM yyyy', dateLocale)} vs ${formatDisplayDate(curStart, 'MMM yyyy', dateLocale)}`,
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
  goals: {
    dailyLossLimit?: number
    alertOnLossLimit?: boolean
    tradingRulesEnabled?: boolean
  },
): string | null {
  // Match day-tab rules: master switch must be on
  if (goals.tradingRulesEnabled !== true) return null
  if (!goals.alertOnLossLimit || !goals.dailyLossLimit) return null
  if (dayPnl <= -Math.abs(goals.dailyLossLimit)) {
    return 'loss_limit'
  }
  return null
}

export function monthlyPnl(activities: DayActivity[], refDate: Date): number {
  const monthKey = format(refDate, 'yyyy-MM')
  return activities
    .filter((a) => a.date.startsWith(monthKey))
    .reduce((s, a) => s + a.pnl, 0)
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
