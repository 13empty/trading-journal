import { addMonths, differenceInCalendarDays, format, getISODay, startOfMonth } from 'date-fns'
import type { DayActivity } from '../types/account'
import { monthGridDays } from './account'
import { parseLocalDateKey } from './mt5Date'

export type StreakKind = 'win' | 'loss' | 'flat'

export const PROJECTION_HORIZONS = [15, 30, 45, 60, 90] as const

export interface DayAverages {
  avgWinDayPnl: number
  winDays: number
  avgLossDayPnl: number
  lossDays: number
  avgDayPnl: number
  activeDays: number
  totalPnl: number
}

export interface ProjectionHorizon {
  days: number
  projectedBalance: number
  projectedPnl: number
}

export interface ScopeProjection {
  scope: 'month' | 'all'
  label: string
  averages: DayAverages
  dailyRate: number
  horizons: ProjectionHorizon[]
  sampleNote?: 'noWinDays' | 'noLossDays' | 'noDays'
}

export interface DayStreakState {
  kind: StreakKind
  days: number
  todayPnl: number
}

export interface ProgressProjection {
  asOfDate: string
  monthKey: string
  streak: DayStreakState
  startBalance: number
  month: ScopeProjection
  all: ScopeProjection
}

function daySign(pnl: number): StreakKind {
  if (pnl > 0) return 'win'
  if (pnl < 0) return 'loss'
  return 'flat'
}

export function computeDayAverages(activities: DayActivity[]): DayAverages {
  const active = activities.filter((d) => d.trades > 0 || d.pnl !== 0)
  if (active.length === 0) {
    return {
      avgWinDayPnl: 0,
      winDays: 0,
      avgLossDayPnl: 0,
      lossDays: 0,
      avgDayPnl: 0,
      activeDays: 0,
      totalPnl: 0,
    }
  }

  const wins = active.filter((d) => d.pnl > 0)
  const losses = active.filter((d) => d.pnl < 0)
  const totalPnl = active.reduce((s, d) => s + d.pnl, 0)

  return {
    avgWinDayPnl: wins.length ? wins.reduce((s, d) => s + d.pnl, 0) / wins.length : 0,
    winDays: wins.length,
    avgLossDayPnl: losses.length ? losses.reduce((s, d) => s + d.pnl, 0) / losses.length : 0,
    lossDays: losses.length,
    avgDayPnl: totalPnl / active.length,
    activeDays: active.length,
    totalPnl,
  }
}

export function getDayStreakAt(activities: DayActivity[], asOfDate: string): DayStreakState {
  const sorted = [...activities]
    .filter((d) => d.date <= asOfDate && (d.trades > 0 || d.pnl !== 0))
    .sort((a, b) => a.date.localeCompare(b.date))

  const today = sorted.find((d) => d.date === asOfDate)
  const todayPnl = today?.pnl ?? 0

  if (sorted.length === 0) {
    return { kind: 'flat', days: 0, todayPnl }
  }

  let kind = daySign(sorted[sorted.length - 1].pnl)
  if (kind === 'flat') {
    return { kind: 'flat', days: 0, todayPnl }
  }

  let days = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    const sign = daySign(sorted[i].pnl)
    if (sign === 'flat') break
    if (sign !== kind) break
    days += 1
  }

  return { kind, days, todayPnl }
}

function dailyRateForStreak(averages: DayAverages, kind: StreakKind): { rate: number; note?: ScopeProjection['sampleNote'] } {
  if (averages.activeDays === 0) {
    return { rate: 0, note: 'noDays' }
  }
  if (kind === 'win') {
    if (averages.winDays === 0) return { rate: averages.avgDayPnl, note: 'noWinDays' }
    return { rate: averages.avgWinDayPnl }
  }
  if (kind === 'loss') {
    if (averages.lossDays === 0) return { rate: averages.avgDayPnl, note: 'noLossDays' }
    return { rate: averages.avgLossDayPnl }
  }
  return { rate: averages.avgDayPnl }
}

function buildScopeProjection(
  scope: 'month' | 'all',
  label: string,
  activities: DayActivity[],
  streakKind: StreakKind,
  startBalance: number,
): ScopeProjection {
  const averages = computeDayAverages(activities)
  const { rate, note } = dailyRateForStreak(averages, streakKind)
  const horizons = PROJECTION_HORIZONS.map((days) => {
    const projectedPnl = rate * days
    return {
      days,
      projectedPnl,
      projectedBalance: startBalance + projectedPnl,
    }
  })

  return {
    scope,
    label,
    averages,
    dailyRate: rate,
    horizons,
    sampleNote: note,
  }
}

export function computeProgressProjection(
  activities: DayActivity[],
  startBalance: number,
  asOfDate: string = format(new Date(), 'yyyy-MM-dd'),
): ProgressProjection {
  const monthKey = format(startOfMonth(parseLocalDateKey(asOfDate)), 'yyyy-MM')
  const monthActivities = activities.filter((d) => d.date.startsWith(monthKey))
  const streak = getDayStreakAt(activities, asOfDate)

  return {
    asOfDate,
    monthKey,
    streak,
    startBalance,
    month: buildScopeProjection('month', monthKey, monthActivities, streak.kind, startBalance),
    all: buildScopeProjection('all', 'all', activities, streak.kind, startBalance),
  }
}

export function projectionCurvePoints(
  startBalance: number,
  dailyRate: number,
  maxDays: number,
): { day: number; balance: number }[] {
  const points: { day: number; balance: number }[] = [{ day: 0, balance: startBalance }]
  for (let d = 1; d <= maxDays; d++) {
    points.push({ day: d, balance: startBalance + dailyRate * d })
  }
  return points
}

export type ProjectionCalKind = 'pad' | 'past' | 'today' | 'future'

export interface ProjectionCalCell {
  date: string | null
  dayNum: number | null
  kind: ProjectionCalKind
  dayPnl: number | null
  daysFromAsOf: number | null
  projectedPnl: number | null
  projectedBalance: number | null
  horizon?: number
}

export interface ProjectionMonthCal {
  monthKey: string
  weeks: ProjectionCalCell[][]
  futureDays: number
  monthProjectedPnl: number
  monthEndBalance: number
}

const HORIZON_SET = new Set<number>(PROJECTION_HORIZONS)

function emptyPad(): ProjectionCalCell {
  return {
    date: null,
    dayNum: null,
    kind: 'pad',
    dayPnl: null,
    daysFromAsOf: null,
    projectedPnl: null,
    projectedBalance: null,
  }
}

function cellForDate(
  date: Date,
  asOfDate: string,
  startBalance: number,
  dailyRate: number,
  byDate: Map<string, DayActivity>,
): ProjectionCalCell {
  const key = format(date, 'yyyy-MM-dd')
  const daysFromAsOf = differenceInCalendarDays(date, parseLocalDateKey(asOfDate))
  const actual = byDate.get(key)
  const horizon = HORIZON_SET.has(daysFromAsOf) ? daysFromAsOf : undefined

  if (daysFromAsOf < 0) {
    return {
      date: key,
      dayNum: date.getDate(),
      kind: 'past',
      dayPnl: actual ? actual.pnl : null,
      daysFromAsOf,
      projectedPnl: null,
      projectedBalance: actual?.endBalance ?? null,
      horizon,
    }
  }

  if (daysFromAsOf === 0) {
    return {
      date: key,
      dayNum: date.getDate(),
      kind: 'today',
      dayPnl: actual ? actual.pnl : 0,
      daysFromAsOf: 0,
      projectedPnl: 0,
      projectedBalance: startBalance,
      horizon,
    }
  }

  const projectedPnl = dailyRate * daysFromAsOf
  return {
    date: key,
    dayNum: date.getDate(),
    kind: 'future',
    dayPnl: dailyRate,
    daysFromAsOf,
    projectedPnl,
    projectedBalance: startBalance + projectedPnl,
    horizon,
  }
}

function weeksForMonth(
  month: Date,
  asOfDate: string,
  startBalance: number,
  dailyRate: number,
  byDate: Map<string, DayActivity>,
): ProjectionCalCell[][] {
  const days = monthGridDays(month)
  const padStart = getISODay(days[0]) - 1
  const cells: ProjectionCalCell[] = [
    ...Array.from({ length: padStart }, () => emptyPad()),
    ...days.map((d) => cellForDate(d, asOfDate, startBalance, dailyRate, byDate)),
  ]
  while (cells.length % 7 !== 0) cells.push(emptyPad())

  const weeks: ProjectionCalCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks.filter((week) => week.some((c) => c.kind !== 'pad'))
}

/** Current month + next two, mixing actuals (past) with streak-rate projection (future). */
export function buildThreeMonthProjectionCalendar(
  asOfDate: string,
  startBalance: number,
  dailyRate: number,
  activities: DayActivity[],
): ProjectionMonthCal[] {
  const byDate = new Map(activities.map((d) => [d.date, d]))
  const origin = startOfMonth(parseLocalDateKey(asOfDate))

  return [0, 1, 2].map((offset) => {
    const month = addMonths(origin, offset)
    const weeks = weeksForMonth(month, asOfDate, startBalance, dailyRate, byDate)
    const flat = weeks.flat().filter((c) => c.kind !== 'pad')
    const future = flat.filter((c) => c.kind === 'future')
    const last = [...flat].reverse().find((c) => c.projectedBalance != null)

    return {
      monthKey: format(month, 'yyyy-MM'),
      weeks,
      futureDays: future.length,
      monthProjectedPnl: future.reduce((s, c) => s + (c.dayPnl ?? 0), 0),
      monthEndBalance: last?.projectedBalance ?? startBalance,
    }
  })
}
