import { format, startOfWeek } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { AdvancedMetrics, DrawdownInfo } from '../types/journal'
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

export type RiskAdviceAction = 'increase' | 'hold' | 'decrease' | 'insufficient'

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

export interface RiskAdvice {
  action: RiskAdviceAction
  suggestedRiskPct: number
  currentRiskPct: number | null
  confidence: 'low' | 'medium' | 'high'
  reasons: RiskAdviceReasonId[]
  weekly: WeeklyStats
  score: number
}

const MIN_WEEKS = 4
const MIN_TRADES = 15
const DEFAULT_RISK_PCT = 1

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

export function analyzeRiskAdvice(input: {
  weekly: WeeklyStats
  metrics: AdvancedMetrics
  drawdown: DrawdownInfo
  tradeCount: number
}): RiskAdvice {
  const { weekly, metrics, drawdown, tradeCount } = input
  const currentRiskPct = metrics.avgRiskPct > 0 ? metrics.avgRiskPct : null
  const reasons: RiskAdviceReasonId[] = []

  if (weekly.weeksSampled < MIN_WEEKS || tradeCount < MIN_TRADES) {
    const insufficient: RiskAdviceReasonId[] = []
    if (weekly.weeksSampled < MIN_WEEKS) insufficient.push('insufficient_weeks')
    if (tradeCount < MIN_TRADES) insufficient.push('insufficient_trades')
    return {
      action: 'insufficient',
      suggestedRiskPct: currentRiskPct ?? DEFAULT_RISK_PCT,
      currentRiskPct,
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

  let action: RiskAdviceAction = 'hold'
  if (score >= 3) action = 'increase'
  else if (score <= -1) action = 'decrease'
  else reasons.push('stable_edge')

  if (drawdown.maxDrawdownPct > 12 && action === 'increase') {
    action = 'hold'
  }

  const base = currentRiskPct ?? DEFAULT_RISK_PCT
  let suggestedRiskPct = base

  if (action === 'increase') {
    suggestedRiskPct = Math.min(2, roundToQuarter(Math.max(base + 0.25, base * 1.2)))
  } else if (action === 'decrease') {
    suggestedRiskPct = Math.max(0.25, roundToQuarter(Math.min(base - 0.25, base * 0.75)))
  }

  if (drawdown.maxDrawdownPct > 10) {
    suggestedRiskPct = Math.min(suggestedRiskPct, roundToQuarter(Math.max(0.5, base * 0.85)))
  }

  const confidence: RiskAdvice['confidence'] =
    weekly.weeksSampled >= 8 && tradeCount >= 30
      ? 'high'
      : weekly.weeksSampled >= 6 && tradeCount >= 20
        ? 'medium'
        : 'low'

  return {
    action,
    suggestedRiskPct,
    currentRiskPct,
    confidence,
    reasons,
    weekly,
    score,
  }
}

export function suggestedRiskAmount(balance: number, riskPct: number): number {
  if (balance <= 0 || riskPct <= 0) return 0
  return (balance * riskPct) / 100
}
