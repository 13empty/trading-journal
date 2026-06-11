import { addMonths, endOfWeek, format, getISODay, isToday, startOfWeek, subMonths } from 'date-fns'

import type { Locale } from 'date-fns'

import { useMemo } from 'react'

import type { CashMovement } from '../types/account'

import type { DayActivity } from '../types/account'

import { formatDateKey, monthGridDays } from '../lib/account'

import { weekdayHeaders } from '../lib/calendarLocale'

import { badgesForDay, badgesInMonth, cashForDate, dayCashSummary } from '../lib/calendarCash'

import { parseLocalDateKey } from '../lib/mt5Date'

import { formatMoney, pnlClass } from '../lib/aggregations'

import {
  dayPnlPercent,
  formatCalendarPnl,
  formatCompactPercent,
  monthReferenceBalance,
  pnlPercentFromTotal,
  weekReferenceBalance,
} from '../lib/calendarPnl'

import type { CalendarPnlDisplay } from '../types/account'

import type { Translations } from '../i18n/types'

import { CalendarPnlText } from './CalendarPnlText'



interface CalendarProps {

  month: Date

  onMonthChange: (d: Date) => void

  selectedDate: string

  onSelectDate: (date: string) => void

  dayMap: Map<string, DayActivity>

  cash: CashMovement[]

  calendar: Translations['calendar']

  dateLocale: Locale

  displayMode: CalendarPnlDisplay

  onDisplayModeChange: (mode: CalendarPnlDisplay) => void

  initialBalance: number

}



function buildWeekRows(month: Date): (Date | null)[][] {

  const days = monthGridDays(month)

  const padStart = getISODay(days[0]) - 1

  const cells: (Date | null)[] = [...Array<Date | null>(padStart).fill(null), ...days]

  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (Date | null)[][] = []

  for (let i = 0; i < cells.length; i += 7) {

    weeks.push(cells.slice(i, i + 7))

  }

  return weeks.filter((week) => week.some((d) => d !== null))

}



function sumIsoWeekPnl(

  weekDays: (Date | null)[],

  dayMap: Map<string, DayActivity>,

): { total: number; hasData: boolean } {

  const anchor = weekDays.find((d) => d != null)

  if (!anchor) return { total: 0, hasData: false }



  const start = startOfWeek(anchor, { weekStartsOn: 1 })

  const end = endOfWeek(anchor, { weekStartsOn: 1 })

  let total = 0

  let hasData = false



  for (const [dateKey, activity] of dayMap) {

    const d = parseLocalDateKey(dateKey)

    if (d >= start && d <= end) {

      total += activity.pnl

      if (activity.trades > 0 || activity.pnl !== 0) hasData = true

    }

  }



  return { total, hasData }

}



export function Calendar({

  month,

  onMonthChange,

  selectedDate,

  onSelectDate,

  dayMap,

  cash,

  calendar,

  dateLocale,

  displayMode,

  onDisplayModeChange,

  initialBalance,

}: CalendarProps) {

  const weeks = buildWeekRows(month)

  const weekdays = weekdayHeaders(dateLocale)

  const monthKey = format(month, 'yyyy-MM')



  const monthPnl = useMemo(() => {

    let total = 0

    let hasData = false

    for (const [date, activity] of dayMap) {

      if (!date.startsWith(monthKey)) continue

      total += activity.pnl

      if (activity.trades > 0 || activity.pnl !== 0) hasData = true

    }

    return { total, hasData }

  }, [dayMap, monthKey])



  const monthBadges = useMemo(() => badgesInMonth(dayMap, monthKey), [dayMap, monthKey])

  const monthPct = useMemo(() => {
    if (!monthPnl.hasData) return null
    const ref = monthReferenceBalance(dayMap, monthKey, initialBalance)
    return pnlPercentFromTotal(monthPnl.total, ref)
  }, [dayMap, monthKey, monthPnl, initialBalance])

  const displayModes: { id: CalendarPnlDisplay; label: string }[] = [
    { id: 'dollar', label: calendar.displayDollar },
    { id: 'percent', label: calendar.displayPercent },
    { id: 'both', label: calendar.displayBoth },
  ]

  return (

    <div className={`calendar calendar-pnl-${displayMode}`}>

      <div className="calendar-nav">

        <button type="button" onClick={() => onMonthChange(subMonths(month, 1))} aria-label={calendar.prevMonth}>

          ‹

        </button>

        <div className="calendar-nav-center">

          <span className="calendar-title">{format(month, 'MMMM yyyy', { locale: dateLocale })}</span>

          {monthPnl.hasData && (

            <span className={`calendar-month-total ${pnlClass(monthPnl.total)}`}>

              {calendar.monthTotal}:{' '}
              {displayMode === 'dollar' && formatMoney(monthPnl.total)}
              {displayMode === 'percent' &&
                (monthPct != null ? formatCompactPercent(monthPct) : '—')}
              {displayMode === 'both' &&
                `${formatMoney(monthPnl.total)} · ${monthPct != null ? formatCompactPercent(monthPct) : '—'}`}

            </span>

          )}

        </div>

        <button type="button" onClick={() => onMonthChange(addMonths(month, 1))} aria-label={calendar.nextMonth}>

          ›

        </button>

      </div>

      <div className="calendar-display-bar">
        <span className="calendar-display-label">{calendar.displayModeLabel}</span>
        <div className="calendar-mode-toggle" role="group" aria-label={calendar.displayModeLabel}>
          {displayModes.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={displayMode === opt.id ? 'active' : ''}
              aria-pressed={displayMode === opt.id}
              onClick={() => onDisplayModeChange(opt.id)}
              title={opt.label}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="calendar-grid-wrap">
      <table className="calendar-table">

        <thead>

          <tr>

            {weekdays.map((d) => (

              <th key={d} scope="col">

                {d}

              </th>

            ))}

            <th scope="col" className="cal-week-col" title={calendar.weekTotalTitle}>

              {calendar.weekCol}

            </th>

          </tr>

        </thead>

        <tbody>

          {weeks.map((week, wi) => {

            const weekSum = sumIsoWeekPnl(week, dayMap)
            const weekRef = weekReferenceBalance(week, dayMap, initialBalance)
            const weekPct = weekSum.hasData ? pnlPercentFromTotal(weekSum.total, weekRef) : null
            const lastDayIdx = week.reduce<number>((last, d, i) => (d ? i : last), -1)

            return (

              <tr key={`w-${wi}`}>

                {week.map((day, di) => {

                  if (!day) {
                    const trailing = lastDayIdx >= 0 && di > lastDayIdx
                    return (
                      <td
                        key={`e-${wi}-${di}`}
                        className={trailing ? 'cal-pad trailing' : 'cal-pad leading'}
                        aria-hidden="true"
                      />
                    )
                  }

                  const key = formatDateKey(day)

                  const activity = dayMap.get(key)

                  const selected = key === selectedDate

                  const hasData = !!activity

                  const pnl = activity?.pnl ?? 0

                  const isLive = (activity?.openCount ?? 0) > 0 && (activity?.livePnl ?? 0) !== 0

                  const badges = activity ? badgesForDay(activity) : []

                  const dayCash = cashForDate(cash, key)

                  const cashSummary = activity

                    ? dayCashSummary(activity, dayCash, calendar.cashLabels)

                    : ''

                  const dayPct = activity ? dayPnlPercent(activity) : null

                  const tooltipParts = [

                    hasData
                      ? `${calendar.pnlLabel}: ${formatCalendarPnl('both', pnl, dayPct, isLive).replace('*', '')}`
                      : '',

                    cashSummary,

                    isLive ? calendar.floatingTitle : '',

                  ].filter(Boolean)



                  return (

                    <td key={key} className="cal-cell-wrap">

                      <button

                        type="button"

                        className={[

                          'cal-cell',

                          hasData ? 'has-data' : '',

                          isLive ? 'has-live' : '',

                          selected ? 'selected' : '',

                          isToday(day) ? 'today' : '',

                          hasData ? pnlClass(pnl) : '',

                        ]

                          .filter(Boolean)

                          .join(' ')}

                        onClick={() => onSelectDate(key)}

                        title={tooltipParts.join('\n') || undefined}

                      >

                        {badges.length > 0 && (

                          <span className="cal-badges" aria-hidden="true">

                            {badges.includes('D') && <span className="dep">D</span>}

                            {badges.includes('W') && <span className="wit">W</span>}

                            {badges.includes('R') && <span className="tx-out">R</span>}

                            {badges.includes('L') && <span className="tx-in">L</span>}

                            {badges.includes('F') && <span className="fee">F</span>}

                          </span>

                        )}

                        <span className="cal-day-num">{format(day, 'd')}</span>

                        {hasData && activity && (
                          <CalendarPnlText
                            mode={displayMode}
                            pnl={pnl}
                            pct={dayPct}
                            isLive={isLive}
                          />
                        )}

                      </button>

                    </td>

                  )

                })}

                <td className="cal-week-total-wrap" title={calendar.weekTotalTitle}>

                  {weekSum.hasData ? (
                    <CalendarPnlText
                      mode={displayMode}
                      pnl={weekSum.total}
                      pct={weekPct}
                      compact
                      className="cal-week-total"
                    />
                  ) : (

                    <span className="cal-week-total empty">—</span>

                  )}

                </td>

              </tr>

            )

          })}

        </tbody>

      </table>
      </div>

      <div className="calendar-legend">

        <span>

          <i className="dot positive" /> {calendar.legendGain}

        </span>

        <span>

          <i className="dot negative" /> {calendar.legendLoss}

        </span>

        {monthBadges.size > 0 ? (

          <span>

            {monthBadges.has('D') && <span className="dep">D</span>}

            {monthBadges.has('W') && (

              <>

                {monthBadges.has('D') && ' · '}

                <span className="wit">W</span>

              </>

            )}

            {monthBadges.has('R') && (

              <>

                {(monthBadges.has('D') || monthBadges.has('W')) && ' · '}

                <span className="tx-out">R</span>

              </>

            )}

            {monthBadges.has('L') && (

              <>

                {(monthBadges.has('D') || monthBadges.has('W') || monthBadges.has('R')) && ' · '}

                <span className="tx-in">L</span>

              </>

            )}

            {monthBadges.has('F') && (

              <>

                {monthBadges.size > 1 && ' · '}

                <span className="fee">F</span>

              </>

            )}{' '}

            {calendar.legendCashDynamic}

          </span>

        ) : (

          <span className="hint-text">{calendar.legendCashNone}</span>

        )}

        <span>* {calendar.legendFloating}</span>

        <span>{calendar.legendWeekTotal}</span>

      </div>

    </div>

  )

}


