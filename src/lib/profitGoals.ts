import { endOfWeek, format, startOfWeek } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { TrackingGoals } from '../types/journal'
import { parseLocalDateKey } from './mt5Date'

export type ProfitGoalId = 'daily' | 'weekly' | 'monthly'

export interface ProfitGoalState {
  id: ProfitGoalId
  status: 'off' | 'progress' | 'reached'
  current: number
  goal: number
  pct: number
}

export function periodPnl(
  dayMap: Map<string, DayActivity>,
  selectedDate: string,
  period: 'day' | 'week' | 'month',
): number {
  if (period === 'day') return dayMap.get(selectedDate)?.pnl ?? 0

  const d = parseLocalDateKey(selectedDate)
  if (period === 'week') {
    const startKey = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const endKey = format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    let total = 0
    for (const [date, activity] of dayMap) {
      if (date >= startKey && date <= endKey) total += activity.pnl
    }
    return total
  }

  const monthKey = format(d, 'yyyy-MM')
  let total = 0
  for (const [date, activity] of dayMap) {
    if (date.startsWith(monthKey)) total += activity.pnl
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
