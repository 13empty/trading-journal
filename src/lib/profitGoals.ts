import { endOfWeek, format, startOfWeek } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { TrackingGoals } from '../types/journal'
import { parseLocalDateKey } from './mt5Date'

export type ProfitGoalId = 'daily' | 'weekly' | 'monthly'

export const PROFIT_GOAL_LABEL_KEYS: Record<
  ProfitGoalId,
  'daily' | 'weekly' | 'monthly'
> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
}

export interface ProfitGoalState {
  id: ProfitGoalId
  status: 'off' | 'progress' | 'reached'
  current: number
  goal: number
  pct: number
}

/** Closed PnL only — excludes floating so goals don't flicker with open trades. */
export function closedDayPnl(activity: DayActivity | undefined): number {
  if (!activity) return 0
  return activity.pnl - (activity.livePnl ?? 0)
}

export function periodPnl(
  dayMap: Map<string, DayActivity>,
  selectedDate: string,
  period: 'day' | 'week' | 'month',
): number {
  if (period === 'day') return closedDayPnl(dayMap.get(selectedDate))

  const d = parseLocalDateKey(selectedDate)
  if (period === 'week') {
    const startKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const endKey = format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    let total = 0
    for (const [date, activity] of dayMap) {
      if (date >= startKey && date <= endKey) total += closedDayPnl(activity)
    }
    return total
  }

  const monthKey = format(d, 'yyyy-MM')
  let total = 0
  for (const [date, activity] of dayMap) {
    if (date.startsWith(monthKey)) total += closedDayPnl(activity)
  }
  return total
}

export function evaluateProfitGoals(
  settings: TrackingGoals,
  dayMap: Map<string, DayActivity>,
  selectedDate: string,
): ProfitGoalState[] {
  const rows: { id: ProfitGoalId; goal?: number; period: 'day' | 'week' | 'month' }[] = [
    { id: 'daily', goal: settings.dailyProfitGoal, period: 'day' },
    { id: 'weekly', goal: settings.weeklyProfitGoal, period: 'week' },
    { id: 'monthly', goal: settings.monthlyProfitGoal, period: 'month' },
  ]

  return rows.map(({ id, goal, period }) => {
    if (goal == null || goal <= 0) {
      return { id, status: 'off', current: 0, goal: 0, pct: 0 }
    }
    const g = Math.abs(Number(goal))
    const current = periodPnl(dayMap, selectedDate, period)
    const reached = current >= g
    return {
      id,
      status: reached ? 'reached' : 'progress',
      current,
      goal: g,
      pct: Math.min(100, Math.max(0, (current / g) * 100)),
    }
  })
}

export function hasAnyProfitGoal(settings: TrackingGoals): boolean {
  return (
    (settings.dailyProfitGoal != null && settings.dailyProfitGoal > 0) ||
    (settings.weeklyProfitGoal != null && settings.weeklyProfitGoal > 0) ||
    (settings.monthlyProfitGoal != null && settings.monthlyProfitGoal > 0)
  )
}

export function hasReachedProfitGoal(goals: ProfitGoalState[]): boolean {
  return goals.some((g) => g.status === 'reached')
}

/** Trading-day assumptions for goal auto-calc (weekdays). */
export const TRADING_DAYS_PER_WEEK = 5
export const TRADING_DAYS_PER_MONTH = 20
export const TRADING_WEEKS_PER_MONTH = TRADING_DAYS_PER_MONTH / TRADING_DAYS_PER_WEEK

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export type ProfitGoalField = 'daily' | 'weekly' | 'monthly'

/**
 * Derive the other two goals from the one the user just edited.
 * Empty / invalid input clears all three when auto-calc is on.
 */
export function deriveProfitGoals(
  source: ProfitGoalField,
  rawValue: string,
): Pick<TrackingGoals, 'dailyProfitGoal' | 'weeklyProfitGoal' | 'monthlyProfitGoal'> {
  const parsed = parseFloat(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      dailyProfitGoal: undefined,
      weeklyProfitGoal: undefined,
      monthlyProfitGoal: undefined,
    }
  }

  let daily: number
  let weekly: number
  let monthly: number

  if (source === 'monthly') {
    monthly = parsed
    weekly = monthly / TRADING_WEEKS_PER_MONTH
    daily = monthly / TRADING_DAYS_PER_MONTH
  } else if (source === 'weekly') {
    weekly = parsed
    daily = weekly / TRADING_DAYS_PER_WEEK
    monthly = weekly * TRADING_WEEKS_PER_MONTH
  } else {
    daily = parsed
    weekly = daily * TRADING_DAYS_PER_WEEK
    monthly = daily * TRADING_DAYS_PER_MONTH
  }

  return {
    dailyProfitGoal: roundMoney(daily),
    weeklyProfitGoal: roundMoney(weekly),
    monthlyProfitGoal: roundMoney(monthly),
  }
}
