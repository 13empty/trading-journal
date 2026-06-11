import type { CashMovement } from '../types/account'
import type { DayActivity } from '../types/account'
import type { Translations } from '../i18n/types'

export function cashForDate(cash: CashMovement[], dateKey: string): CashMovement[] {
  return cash.filter((c) => c.date.slice(0, 10) === dateKey)
}

export function dayCashSummary(
  activity: DayActivity,
  movements: CashMovement[],
  labels: Translations['calendar']['cashLabels'],
): string {
  const parts: string[] = []
  if (activity.deposits > 0 && activity.transfersIn === 0) {
    parts.push(`${labels.deposit}: +$${activity.deposits.toFixed(2)}`)
  }
  if (activity.transfersIn > 0) {
    parts.push(`${labels.transferIn}: +$${activity.transfersIn.toFixed(2)}`)
  }
  if (activity.withdraws > 0) {
    parts.push(`${labels.withdraw}: −$${activity.withdraws.toFixed(2)}`)
  }
  if (activity.transfersOut > 0) {
    parts.push(`${labels.transferOut}: −$${activity.transfersOut.toFixed(2)}`)
  }
  if (activity.otherFees > 0) {
    parts.push(`${labels.fee}: −$${activity.otherFees.toFixed(2)}`)
  }
  for (const m of movements.slice(0, 3)) {
    const note = m.notes?.trim()
    if (note && !parts.some((p) => p.includes(note.slice(0, 20)))) {
      parts.push(note.slice(0, 60))
    }
  }
  return parts.join(' · ')
}

export type CashBadge = 'D' | 'W' | 'R' | 'L' | 'F'

export function badgesForDay(activity: DayActivity): CashBadge[] {
  const badges: CashBadge[] = []
  const pureDeposit = activity.deposits - activity.transfersIn
  if (pureDeposit > 0) badges.push('D')
  if (activity.withdraws > 0) badges.push('W')
  if (activity.transfersOut > 0) badges.push('R')
  if (activity.transfersIn > 0) badges.push('L')
  if (activity.otherFees > 0) badges.push('F')
  return badges
}

export function badgesInMonth(
  dayMap: Map<string, DayActivity>,
  monthPrefix: string,
): Set<CashBadge> {
  const set = new Set<CashBadge>()
  for (const [date, activity] of dayMap) {
    if (!date.startsWith(monthPrefix)) continue
    for (const b of badgesForDay(activity)) set.add(b)
  }
  return set
}
