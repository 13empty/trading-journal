import { addMonths, eachDayOfInterval, endOfMonth, format, getISODay, startOfMonth } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { GoalPlan } from '../types/goalPlan'
import { parseLocalDateKey } from './mt5Date'
import { closedDayPnl } from './profitGoals'

export type GoalPlanIssue = 'range' | 'daily' | 'noDays'

export type GoalPace = 'upcoming' | 'on_track' | 'ahead' | 'behind' | 'reached' | 'missed'

export interface GoalPlanMonth {
  /** yyyy-MM */
  key: string
  tradingDays: number
  target: number
  actual: number
}

export interface GoalPlanEvaluation {
  issue?: GoalPlanIssue
  tradingDays: number
  /** Completed trading days before today, inside the window. */
  elapsedDays: number
  /** Trading days from today through the end date. */
  daysLeft: number
  includesToday: boolean
  /** Period target the plan is measured against. */
  target: number
  customTotal: boolean
  /** What the typed daily amount produces over the whole window. */
  plannedReach: number
  /** Daily pace that lands exactly on the period target. */
  paceDaily: number
  actual: number
  /** Target share that should already be booked on completed days. */
  expectedByNow: number
  remaining: number
  /** What is needed per trading day from today. Null when no days remain and the goal is still open. */
  requiredDaily: number | null
  pace: GoalPace
  months: GoalPlanMonth[]
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function isTradingDay(date: Date, weekdaysOnly: boolean): boolean {
  if (!weekdaysOnly) return true
  return getISODay(date) <= 5
}

export function listTradingDays(start: string, end: string, weekdaysOnly: boolean): string[] {
  if (!start || !end || start > end) return []
  return eachDayOfInterval({
    start: parseLocalDateKey(start),
    end: parseLocalDateKey(end),
  })
    .filter((date) => isTradingDay(date, weekdaysOnly))
    .map((date) => format(date, 'yyyy-MM-dd'))
}

/** Next month through December of that year (or a short window if that December is already past). */
export function suggestedPlanWindow(asOf: string): { startDate: string; endDate: string } {
  const today = parseLocalDateKey(asOf)
  const start = startOfMonth(addMonths(today, 1))
  let end = new Date(start.getFullYear(), 11, 31, 12, 0, 0, 0)
  if (end < start) end = endOfMonth(addMonths(start, 2))
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  }
}

function sumClosedPnl(dayMap: Map<string, DayActivity>, from: string, to: string): number {
  if (!from || !to || from > to) return 0
  let total = 0
  for (const [date, activity] of dayMap) {
    if (date >= from && date <= to) total += closedDayPnl(activity)
  }
  return total
}

function emptyEval(issue?: GoalPlanIssue): GoalPlanEvaluation {
  return {
    issue,
    tradingDays: 0,
    elapsedDays: 0,
    daysLeft: 0,
    includesToday: false,
    target: 0,
    customTotal: false,
    plannedReach: 0,
    paceDaily: 0,
    actual: 0,
    expectedByNow: 0,
    remaining: 0,
    requiredDaily: null,
    pace: 'upcoming',
    months: [],
  }
}

export function evaluateGoalPlan(
  plan: Pick<
    GoalPlan,
    'dailyAmount' | 'totalGoal' | 'startDate' | 'endDate' | 'weekdaysOnly'
  >,
  dayMap: Map<string, DayActivity>,
  asOfDate: string,
): GoalPlanEvaluation {
  if (!plan.startDate || !plan.endDate || plan.startDate > plan.endDate) return emptyEval('range')
  if (!Number.isFinite(plan.dailyAmount) || plan.dailyAmount <= 0) return emptyEval('daily')

  const days = listTradingDays(plan.startDate, plan.endDate, plan.weekdaysOnly)
  if (days.length === 0) return emptyEval('noDays')

  const customTotal = plan.totalGoal != null && Number.isFinite(plan.totalGoal) && plan.totalGoal > 0
  const target = roundMoney(customTotal ? plan.totalGoal! : plan.dailyAmount * days.length)
  const plannedReach = roundMoney(plan.dailyAmount * days.length)
  const paceDaily = roundMoney(target / days.length)

  const elapsedKeys = days.filter((date) => date < asOfDate)
  const leftKeys = days.filter((date) => date >= asOfDate)
  const includesToday = days.includes(asOfDate)

  const actualThrough = asOfDate < plan.startDate ? plan.startDate : asOfDate > plan.endDate ? plan.endDate : asOfDate
  const actual =
    asOfDate < plan.startDate ? 0 : roundMoney(sumClosedPnl(dayMap, plan.startDate, actualThrough))

  const expectedByNow = roundMoney(paceDaily * elapsedKeys.length)
  const remaining = roundMoney(target - actual)

  let requiredDaily: number | null
  if (remaining <= 0) requiredDaily = 0
  else if (leftKeys.length === 0) requiredDaily = null
  else requiredDaily = roundMoney(remaining / leftKeys.length)

  let pace: GoalPace
  if (asOfDate < plan.startDate) pace = 'upcoming'
  else if (actual + 0.005 >= target) pace = 'reached'
  else if (asOfDate > plan.endDate) pace = 'missed'
  else if (elapsedKeys.length === 0) pace = 'on_track'
  else {
    const tol = Math.max(1, Math.abs(expectedByNow) * 0.02)
    if (actual > expectedByNow + tol) pace = 'ahead'
    else if (actual < expectedByNow - tol) pace = 'behind'
    else pace = 'on_track'
  }

  const monthMap = new Map<string, { tradingDays: number; rawTarget: number; actual: number }>()
  for (const date of days) {
    const key = date.slice(0, 7)
    const row = monthMap.get(key) ?? { tradingDays: 0, rawTarget: 0, actual: 0 }
    row.tradingDays += 1
    row.rawTarget += target / days.length
    monthMap.set(key, row)
  }

  if (asOfDate >= plan.startDate) {
    const actualEnd = asOfDate > plan.endDate ? plan.endDate : asOfDate
    for (const [date, activity] of dayMap) {
      if (date < plan.startDate || date > actualEnd) continue
      const key = date.slice(0, 7)
      const row = monthMap.get(key)
      if (!row) continue
      row.actual += closedDayPnl(activity)
    }
  }

  const monthKeys = [...monthMap.keys()].sort()
  let allocated = 0
  const months: GoalPlanMonth[] = monthKeys.map((key, index) => {
    const row = monthMap.get(key)!
    const isLast = index === monthKeys.length - 1
    const monthTarget = isLast ? roundMoney(target - allocated) : roundMoney(row.rawTarget)
    allocated += monthTarget
    return {
      key,
      tradingDays: row.tradingDays,
      target: monthTarget,
      actual: roundMoney(row.actual),
    }
  })

  return {
    tradingDays: days.length,
    elapsedDays: elapsedKeys.length,
    daysLeft: leftKeys.length,
    includesToday,
    target,
    customTotal,
    plannedReach,
    paceDaily,
    actual,
    expectedByNow,
    remaining,
    requiredDaily,
    pace,
    months,
  }
}
