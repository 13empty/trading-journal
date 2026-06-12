import type { TrackingGoals, EquityPoint, ThresholdRuleState } from '../types/journal'
import type { Trade } from '../types/trade'
import { parseTradeDateTime } from './analytics'
import { parseLocalDateKey } from './mt5Date'

const DEFAULT_REVENGE_COOLDOWN_MIN = 30
const DEFAULT_DRAWDOWN_PCT = 10

function tradeCloseMs(t: Trade): number | null {
  const dt = parseTradeDateTime(t.closeTime)
  if (dt) return dt.getTime()
  return parseLocalDateKey(t.date).getTime()
}

function tradesChronological(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => (tradeCloseMs(a) ?? 0) - (tradeCloseMs(b) ?? 0))
}

export function currentDrawdownFromPeak(
  curve: EquityPoint[],
  liveBalance?: number | null,
): { pct: number; amount: number; peak: number; current: number } {
  if (curve.length === 0) {
    return { pct: 0, amount: 0, peak: 0, current: liveBalance ?? 0 }
  }
  const peak = Math.max(...curve.map((p) => p.balance))
  const current = liveBalance ?? curve[curve.length - 1].balance
  const amount = Math.max(0, peak - current)
  const pct = peak > 0 ? (amount / peak) * 100 : 0
  return { pct, amount, peak, current }
}

export function detectRevengeRisk(
  dayTrades: Trade[],
  cooldownMin: number,
  openCount = 0,
): { risky: boolean; minutesAfterLoss?: number; openAfterLoss?: boolean } {
  const sorted = tradesChronological(dayTrades)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].pnl >= 0) continue
    const t0 = tradeCloseMs(sorted[i])
    const t1 = tradeCloseMs(sorted[i + 1])
    if (t0 == null || t1 == null) continue
    const gapMin = (t1 - t0) / 60_000
    if (gapMin < cooldownMin) {
      return { risky: true, minutesAfterLoss: Math.round(gapMin) }
    }
  }
  if (openCount > 0 && sorted.length > 0) {
    const last = sorted[sorted.length - 1]
    if (last.pnl < 0) {
      return { risky: true, openAfterLoss: true }
    }
  }
  return { risky: false }
}

export function isTradingRulesEnabled(settings: TrackingGoals): boolean {
  return settings.tradingRulesEnabled === true
}

export function alertsEnabled(settings: TrackingGoals): boolean {
  return (
    isTradingRulesEnabled(settings) &&
    settings.alertOnThresholds !== false &&
    settings.alertOnLossLimit !== false
  )
}

export function evaluateThresholdRules(input: {
  settings: TrackingGoals
  dayPnl: number
  dayTrades: Trade[]
  equityCurve: EquityPoint[]
  liveBalance?: number | null
  openCount?: number
}): ThresholdRuleState[] {
  if (!isTradingRulesEnabled(input.settings)) {
    return []
  }
  const { settings, dayPnl, dayTrades, equityCurve, liveBalance, openCount = 0 } = input
  const rules: ThresholdRuleState[] = []

  if (settings.dailyLossLimit != null && settings.dailyLossLimit > 0) {
    const limit = Math.abs(settings.dailyLossLimit)
    const hit = dayPnl <= -limit
    rules.push({
      id: 'daily_loss',
      status: hit ? 'warn' : 'ok',
      detail: `${dayPnl.toFixed(2)} / −${limit.toFixed(2)}`,
    })
  } else {
    rules.push({ id: 'daily_loss', status: 'off' })
  }

  if (settings.maxTradesPerDay != null && settings.maxTradesPerDay > 0) {
    const max = settings.maxTradesPerDay
    const count = dayTrades.length
    rules.push({
      id: 'max_trades',
      status: count >= max ? 'warn' : 'ok',
      detail: `${count} / ${max}`,
    })
  } else {
    rules.push({ id: 'max_trades', status: 'off' })
  }

  const cooldown = settings.revengeCooldownMinutes ?? DEFAULT_REVENGE_COOLDOWN_MIN
  if (cooldown > 0 && dayTrades.length > 0) {
    const revenge = detectRevengeRisk(dayTrades, cooldown, openCount)
    rules.push({
      id: 'revenge_risk',
      status: revenge.risky ? 'warn' : 'ok',
      detail: revenge.minutesAfterLoss != null
        ? String(revenge.minutesAfterLoss)
        : revenge.openAfterLoss
          ? 'open'
          : undefined,
    })
  } else {
    rules.push({ id: 'revenge_risk', status: 'off' })
  }

  const ddLimit = settings.maxDrawdownFromPeakPct ?? DEFAULT_DRAWDOWN_PCT
  if (ddLimit > 0 && equityCurve.length > 0) {
    const dd = currentDrawdownFromPeak(equityCurve, liveBalance)
    rules.push({
      id: 'drawdown_peak',
      status: dd.pct >= ddLimit && dd.amount > 0 ? 'warn' : 'ok',
      detail: `${dd.pct.toFixed(1)}% / ${ddLimit}%`,
    })
  } else {
    rules.push({ id: 'drawdown_peak', status: 'off' })
  }

  return rules
}

export function hasThresholdWarning(rules: ThresholdRuleState[]): boolean {
  return rules.some((r) => r.status === 'warn')
}
