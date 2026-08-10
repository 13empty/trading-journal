import { format, startOfWeek } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { AdvancedMetrics, DrawdownInfo } from '../types/journal'
import { dayPnlPercent, dayStartBalance } from './calendarPnl'
import { parseLocalDateKey } from './mt5Date'

export interface WeeklyStats {
  avgWeeklyPnl: number
  weeksSampled: number
  greenWeeks: number
  redWeeks: number
  recentAvgWeeklyPnl: number
  lastWeekPnl: number | null
  trailingLossWeeks: number
  weekPnls: number[]
}

export interface DailyPerformanceStats {
  todayPnl: number | null
  todayPct: number | null
  todayTrades: number
  avgDailyPnl: number
  avgDailyPct: number
  avgAbsDailyPct: number
  activeDaysSampled: number
  avgTradesPerDay: number
  weekToDatePnl: number
  weekToDatePct: number | null
}

export type RiskAdviceAction = 'increase' | 'hold' | 'decrease' | 'protect' | 'insufficient'

export type RiskAdviceReasonId =
  | 'insufficient_weeks'
  | 'insufficient_trades'
  | 'positive_expectancy'
  | 'negative_expectancy'
  | 'profit_factor_strong'
  | 'profit_factor_weak'
  | 'drawdown_elevated'
  | 'drawdown_severe'
  | 'weekly_avg_positive'
  | 'weekly_avg_negative'
  | 'recent_weeks_weak'
  | 'recent_weeks_strong'
  | 'loss_streak_weeks'
  | 'stable_edge'
  | 'daily_gain_spike'
  | 'daily_avg_positive'
  | 'daily_swing_elevated'
  | 'account_growing'

export type CurrentRiskSource =
  | 'journal'
  | 'inferred'
  | 'journal_amount'
  | 'implied_wins'
  | 'daily_swing'
  | 'today_session'
  | 'daily_limit'
  | 'none'

export interface CurrentRiskInfo {
  source: CurrentRiskSource
  pct: number | null
  amount: number | null
  journalPct: number | null
  journalTrades: number
  journalAmount: number | null
  journalAmountTrades: number
  inferredPct: number | null
  inferredAmount: number | null
  impliedWinsPct: number | null
  impliedWinsAmount: number | null
  dailySwingPct: number | null
  todaySessionPct: number | null
  dailyLimitPerTradePct: number | null
  dailyLimitPct: number | null
  dailyLimitAmount: number | null
}

export interface RiskAdvice {
  action: RiskAdviceAction
  suggestedRiskPct: number
  suggestedRiskAmount: number
  conservativeRiskPct: number
  conservativeRiskAmount: number
  balanceUsed: number
  currentRiskPct: number | null
  currentRisk: CurrentRiskInfo
  daily: DailyPerformanceStats
  confidence: 'low' | 'medium' | 'high'
  reasons: RiskAdviceReasonId[]
  weekly: WeeklyStats
  score: number
}

const MIN_WEEKS = 4
const MIN_TRADES = 15
const CONSERVATIVE_RISK_PCT = 1
const RECENT_DAILY_DAYS = 10
const BIG_DAY_PCT = 5

function weekStartKey(dateStr: string): string {
  return format(startOfWeek(parseLocalDateKey(dateStr), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4
}

function trailingLossWeeks(weekPnls: number[]): number {
  let count = 0
  for (let i = weekPnls.length - 1; i >= 0; i--) {
    if (weekPnls[i] >= 0) break
    count += 1
  }
  return count
}

export function computeWeeklyStats(activities: DayActivity[], asOfDate: string): WeeklyStats {
  const byWeek = new Map<string, number>()
  for (const a of activities) {
    if (a.date > asOfDate) continue
    if (a.trades === 0 && a.pnl === 0) continue
    const key = weekStartKey(a.date)
    byWeek.set(key, (byWeek.get(key) ?? 0) + a.pnl)
  }

  const weekPnls = [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, pnl]) => pnl)

  if (weekPnls.length === 0) {
    return {
      avgWeeklyPnl: 0,
      weeksSampled: 0,
      greenWeeks: 0,
      redWeeks: 0,
      recentAvgWeeklyPnl: 0,
      lastWeekPnl: null,
      trailingLossWeeks: 0,
      weekPnls: [],
    }
  }

  const sum = weekPnls.reduce((s, p) => s + p, 0)
  const recent = weekPnls.slice(-4)
  const recentAvg = recent.reduce((s, p) => s + p, 0) / recent.length

  return {
    avgWeeklyPnl: sum / weekPnls.length,
    weeksSampled: weekPnls.length,
    greenWeeks: weekPnls.filter((p) => p > 0).length,
    redWeeks: weekPnls.filter((p) => p < 0).length,
    recentAvgWeeklyPnl: recentAvg,
    lastWeekPnl: weekPnls[weekPnls.length - 1] ?? null,
    trailingLossWeeks: trailingLossWeeks(weekPnls),
    weekPnls,
  }
}

export function computeDailyPerformance(
  activities: DayActivity[],
  asOfDate: string,
  todayDate: string = asOfDate,
): DailyPerformanceStats {
  const active = activities
    .filter((a) => a.date <= asOfDate && (a.trades > 0 || a.pnl !== 0))
    .sort((a, b) => a.date.localeCompare(b.date))

  const today = activities.find((a) => a.date === todayDate && a.date <= asOfDate)
  const todayPct = today ? dayPnlPercent(today) : null

  const recent = active.slice(-RECENT_DAILY_DAYS)
  const pcts = recent.map((a) => dayPnlPercent(a)).filter((p): p is number => p != null)
  const avgDailyPct = pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : 0
  const avgAbsDailyPct = pcts.length
    ? pcts.reduce((s, p) => s + Math.abs(p), 0) / pcts.length
    : 0
  const avgDailyPnl = recent.length ? recent.reduce((s, a) => s + a.pnl, 0) / recent.length : 0

  const tradedDays = recent.filter((a) => a.trades > 0)
  const avgTradesPerDay =
    tradedDays.length > 0
      ? tradedDays.reduce((s, a) => s + a.trades, 0) / tradedDays.length
      : 0

  const weekKey = weekStartKey(asOfDate)
  const weekDays = active.filter((a) => weekStartKey(a.date) === weekKey)
  const weekToDatePnl = weekDays.reduce((s, a) => s + a.pnl, 0)
  let weekToDatePct: number | null = null
  if (weekDays.length > 0) {
    const startBal = dayStartBalance(weekDays[0])
    if (startBal > 0) weekToDatePct = (weekToDatePnl / startBal) * 100
  }

  return {
    todayPnl: today?.pnl ?? null,
    todayPct,
    todayTrades: today?.trades ?? 0,
    avgDailyPnl,
    avgDailyPct,
    avgAbsDailyPct,
    activeDaysSampled: recent.length,
    avgTradesPerDay,
    weekToDatePnl,
    weekToDatePct,
  }
}

export function suggestedRiskAmount(balance: number, riskPct: number): number {
  if (balance <= 0 || riskPct <= 0) return 0
  return Math.round(((balance * riskPct) / 100) * 100) / 100
}

function computeSuggestedFromBalance(
  action: RiskAdviceAction,
  balance: number,
  dailyLimitPerTradePct: number | null,
): {
  suggestedRiskPct: number
  suggestedRiskAmount: number
  conservativeRiskPct: number
  conservativeRiskAmount: number
} {
  const conservativeRiskPct = CONSERVATIVE_RISK_PCT
  const conservativeRiskAmount = suggestedRiskAmount(balance, conservativeRiskPct)

  let suggestedRiskPct = conservativeRiskPct
  if (action === 'decrease') {
    suggestedRiskPct = 0.75
  } else if (action === 'increase') {
    suggestedRiskPct = Math.min(2, roundToQuarter(conservativeRiskPct * 1.25))
  }

  // Cap by daily-limit-per-trade without rounding the cap down to 0%
  if (dailyLimitPerTradePct != null && dailyLimitPerTradePct > 0) {
    suggestedRiskPct = Math.min(suggestedRiskPct, dailyLimitPerTradePct)
  }

  suggestedRiskPct = roundToQuarter(suggestedRiskPct)
  // Never show 0% when there is a real balance — floor at 0.25%
  if (balance > 0 && suggestedRiskPct < 0.25) {
    suggestedRiskPct = 0.25
  }
  const amount = suggestedRiskAmount(balance, suggestedRiskPct)

  return {
    suggestedRiskPct,
    suggestedRiskAmount: amount,
    conservativeRiskPct,
    conservativeRiskAmount,
  }
}

function pickEffectiveRisk(input: {
  metrics: AdvancedMetrics
  balance: number
  daily: DailyPerformanceStats
  dailyLossLimit?: number
}): Pick<CurrentRiskInfo, 'source' | 'pct' | 'amount'> {
  const { metrics, balance, daily, dailyLossLimit } = input

  if (metrics.riskPctSampleCount >= 3 && metrics.avgRiskPct > 0) {
    return {
      source: 'journal',
      pct: metrics.avgRiskPct,
      amount: suggestedRiskAmount(balance, metrics.avgRiskPct),
    }
  }

  if (metrics.riskAmountSampleCount >= 3 && metrics.avgRiskAmount > 0 && balance > 0) {
    const pct = (metrics.avgRiskAmount / balance) * 100
    return { source: 'journal_amount', pct, amount: metrics.avgRiskAmount }
  }

  const candidates: { source: CurrentRiskSource; pct: number }[] = []

  if (metrics.avgLoss > 0 && balance > 0) {
    candidates.push({
      source: 'inferred',
      pct: (metrics.avgLoss / balance) * 100,
    })
  }

  if (metrics.avgRR >= 0.5 && metrics.avgWin > 0 && balance > 0) {
    const impliedAmount = metrics.avgWin / metrics.avgRR
    candidates.push({
      source: 'implied_wins',
      pct: (impliedAmount / balance) * 100,
    })
  }

  if (daily.todayPct != null && daily.todayTrades > 0 && Math.abs(daily.todayPct) >= 1) {
    candidates.push({
      source: 'today_session',
      pct: Math.abs(daily.todayPct) / daily.todayTrades,
    })
  }

  if (daily.avgAbsDailyPct > 0 && daily.avgTradesPerDay > 0) {
    candidates.push({
      source: 'daily_swing',
      pct: daily.avgAbsDailyPct / daily.avgTradesPerDay,
    })
  }

  const dailyLimitAmount =
    dailyLossLimit != null && dailyLossLimit > 0 ? Math.abs(dailyLossLimit) : null
  if (dailyLimitAmount != null && balance > 0) {
    const dailyLimitPct = (dailyLimitAmount / balance) * 100
    const tradesPerDay = Math.max(2, daily.avgTradesPerDay || 2)
    candidates.push({
      source: 'daily_limit',
      pct: dailyLimitPct / tradesPerDay,
    })
  }

  if (candidates.length === 0) {
    return { source: 'none', pct: null, amount: null }
  }

  const best = candidates.reduce((a, b) => (b.pct > a.pct ? b : a))
  return {
    source: best.source,
    pct: best.pct,
    amount: suggestedRiskAmount(balance, best.pct),
  }
}

export function computeCurrentRisk(input: {
  metrics: AdvancedMetrics
  balance: number
  daily: DailyPerformanceStats
  dailyLossLimit?: number
}): CurrentRiskInfo {
  const { metrics, balance, daily, dailyLossLimit } = input
  const journalPct = metrics.riskPctSampleCount > 0 ? metrics.avgRiskPct : null
  const journalAmount = metrics.riskAmountSampleCount > 0 ? metrics.avgRiskAmount : null
  const inferredAmount =
    metrics.avgLoss > 0 && balance > 0 ? metrics.avgLoss : null
  const inferredPct =
    inferredAmount != null && balance > 0 ? (inferredAmount / balance) * 100 : null
  const impliedWinsAmount =
    metrics.avgRR >= 0.5 && metrics.avgWin > 0 ? metrics.avgWin / metrics.avgRR : null
  const impliedWinsPct =
    impliedWinsAmount != null && balance > 0 ? (impliedWinsAmount / balance) * 100 : null
  const dailySwingPct =
    daily.avgAbsDailyPct > 0 && daily.avgTradesPerDay > 0
      ? daily.avgAbsDailyPct / daily.avgTradesPerDay
      : null
  const todaySessionPct =
    daily.todayPct != null && daily.todayTrades > 0
      ? Math.abs(daily.todayPct) / daily.todayTrades
      : null
  const dailyLimitAmount =
    dailyLossLimit != null && dailyLossLimit > 0 ? Math.abs(dailyLossLimit) : null
  const dailyLimitPct =
    dailyLimitAmount != null && balance > 0 ? (dailyLimitAmount / balance) * 100 : null
  const dailyLimitPerTradePct =
    dailyLimitPct != null
      ? dailyLimitPct / Math.max(2, daily.avgTradesPerDay || 2)
      : null

  const effective = pickEffectiveRisk({ metrics, balance, daily, dailyLossLimit })

  return {
    source: effective.source,
    pct: effective.pct,
    amount: effective.amount,
    journalPct,
    journalTrades: metrics.riskPctSampleCount,
    journalAmount,
    journalAmountTrades: metrics.riskAmountSampleCount,
    inferredPct,
    inferredAmount,
    impliedWinsPct,
    impliedWinsAmount,
    dailySwingPct,
    todaySessionPct,
    dailyLimitPerTradePct,
    dailyLimitPct,
    dailyLimitAmount,
  }
}

export function analyzeRiskAdvice(input: {
  activities: DayActivity[]
  asOfDate: string
  todayDate?: string
  weekly: WeeklyStats
  metrics: AdvancedMetrics
  drawdown: DrawdownInfo
  tradeCount: number
  balance: number
  dailyLossLimit?: number
}): RiskAdvice {
  const { activities, asOfDate, todayDate = asOfDate, weekly, metrics, drawdown, tradeCount, balance, dailyLossLimit } =
    input
  const daily = computeDailyPerformance(activities, asOfDate, todayDate)
  const currentRisk = computeCurrentRisk({ metrics, balance, daily, dailyLossLimit })
  const currentRiskPct = currentRisk.pct
  const reasons: RiskAdviceReasonId[] = []

  if (weekly.weeksSampled < MIN_WEEKS || tradeCount < MIN_TRADES) {
    const insufficient: RiskAdviceReasonId[] = []
    if (weekly.weeksSampled < MIN_WEEKS) insufficient.push('insufficient_weeks')
    if (tradeCount < MIN_TRADES) insufficient.push('insufficient_trades')
    const suggested = computeSuggestedFromBalance('insufficient', balance, null)
    return {
      action: 'insufficient',
      ...suggested,
      balanceUsed: balance,
      currentRiskPct,
      currentRisk,
      daily,
      confidence: 'low',
      reasons: insufficient,
      weekly,
      score: 0,
    }
  }

  let score = 0

  if (metrics.expectancy > 0) {
    score += 1
    reasons.push('positive_expectancy')
  } else {
    score -= 2
    reasons.push('negative_expectancy')
  }

  if (metrics.profitFactor >= 1.4) {
    score += 1
    reasons.push('profit_factor_strong')
  } else if (metrics.profitFactor < 1.0) {
    score -= 2
    reasons.push('profit_factor_weak')
  }

  if (weekly.avgWeeklyPnl > 0) {
    score += 1
    reasons.push('weekly_avg_positive')
  } else {
    score -= 1
    reasons.push('weekly_avg_negative')
  }

  if (weekly.recentAvgWeeklyPnl > 0 && weekly.recentAvgWeeklyPnl >= weekly.avgWeeklyPnl * 0.5) {
    score += 1
    reasons.push('recent_weeks_strong')
  } else if (weekly.recentAvgWeeklyPnl < 0) {
    score -= 1
    reasons.push('recent_weeks_weak')
  }

  if (drawdown.maxDrawdownPct > 15) {
    score -= 3
    reasons.push('drawdown_severe')
  } else if (drawdown.maxDrawdownPct > 10) {
    score -= 1
    reasons.push('drawdown_elevated')
  }

  if (weekly.trailingLossWeeks >= 2) {
    score -= 2
    reasons.push('loss_streak_weeks')
  }

  if (daily.activeDaysSampled >= 5 && daily.avgDailyPct > 0) {
    score += 1
    reasons.push('daily_avg_positive')
  }

  if (daily.avgAbsDailyPct >= 3) {
    reasons.push('daily_swing_elevated')
  }

  const recovering =
    metrics.expectancy > 0 &&
    daily.avgDailyPct > 0 &&
    (daily.weekToDatePct ?? 0) > 0

  if (
    daily.weekToDatePct != null &&
    daily.weekToDatePct > 0 &&
    weekly.avgWeeklyPnl > 0 &&
    drawdown.maxDrawdownPct <= 10
  ) {
    reasons.push('account_growing')
  }

  const bigDayToday =
    daily.todayPct != null &&
    (daily.todayPct >= BIG_DAY_PCT ||
      (daily.avgAbsDailyPct > 0 && daily.todayPct >= daily.avgAbsDailyPct * 2.5))

  if (bigDayToday) {
    reasons.push('daily_gain_spike')
  }

  let action: RiskAdviceAction = 'hold'

  if (metrics.expectancy <= 0 || metrics.profitFactor < 1.0) {
    action = 'decrease'
  } else if (bigDayToday) {
    action = 'protect'
  } else if (
    score >= 3 &&
    drawdown.maxDrawdownPct <= 12 &&
    weekly.trailingLossWeeks === 0
  ) {
    action = 'increase'
  } else if (
    score <= -2 &&
    !recovering &&
    (weekly.recentAvgWeeklyPnl < 0 || weekly.trailingLossWeeks >= 2)
  ) {
    action = 'decrease'
  } else if (drawdown.maxDrawdownPct > 15 && !recovering) {
    action = 'decrease'
  } else {
    reasons.push('stable_edge')
  }

  if (drawdown.maxDrawdownPct > 12 && action === 'increase') {
    action = 'hold'
  }

  const suggested = computeSuggestedFromBalance(
    action,
    balance,
    currentRisk.dailyLimitPerTradePct,
  )

  const confidence: RiskAdvice['confidence'] =
    weekly.weeksSampled >= 8 && tradeCount >= 30
      ? 'high'
      : weekly.weeksSampled >= 6 && tradeCount >= 20
        ? 'medium'
        : 'low'

  return {
    action,
    ...suggested,
    balanceUsed: balance,
    currentRiskPct,
    currentRisk,
    daily,
    confidence,
    reasons,
    weekly,
    score,
  }
}
