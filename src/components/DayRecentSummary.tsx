import type { Locale } from 'date-fns'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { summarizeRecentEquity } from '../lib/analytics'
import { formatCompactPercent } from '../lib/calendarPnl'
import { formatDisplayDate } from '../lib/dateDisplay'
import { parseLocalDateKey } from '../lib/mt5Date'
import type { EquityPoint } from '../types/journal'
import { EquityCurve } from './EquityCurve'
import { interpolate } from '../i18n'

interface Props {
  points: EquityPoint[]
  maxDays?: number
  dateLocale: Locale
  t: Translations['dayHero']
}

export function DayRecentSummary({ points, maxDays = 14, dateLocale, t }: Props) {
  const slice = points.slice(-maxDays)
  const summary = summarizeRecentEquity(slice)

  if (!summary || slice.length < 2) return null

  const bestDayLabel = formatDisplayDate(parseLocalDateKey(summary.bestDayDate), 'd MMM', dateLocale)

  return (
    <div className="day-recent-summary">
      <div className="day-recent-head">
        <div className="day-recent-title-block">
          <span className="day-recent-label">{t.sparkline}</span>
          <span className="day-recent-meta">
            {interpolate(t.recentDays, { count: summary.dayCount })}
          </span>
        </div>
        <div className={`day-recent-total ${pnlClass(summary.totalPnl)}`}>
          <span className="day-recent-total-val">{formatMoney(summary.totalPnl)}</span>
          {summary.periodPct != null && (
            <span className="day-recent-total-pct">{formatCompactPercent(summary.periodPct)}</span>
          )}
        </div>
      </div>

      <div className="day-recent-stats">
        <div className="day-recent-stat">
          <span className="day-recent-stat-label">{t.recentAvg}</span>
          <span className={`day-recent-stat-val ${pnlClass(summary.avgDailyPnl)}`}>
            {formatMoney(summary.avgDailyPnl)}
          </span>
        </div>
        <div className="day-recent-stat">
          <span className="day-recent-stat-label">{t.recentWinLoss}</span>
          <span className="day-recent-stat-val">
            <span className="positive">{summary.greenDays}+</span>
            <span className="day-recent-stat-sep">/</span>
            <span className="negative">{summary.redDays}−</span>
          </span>
        </div>
        <div className="day-recent-stat">
          <span className="day-recent-stat-label">{t.recentBest}</span>
          <span className={`day-recent-stat-val ${pnlClass(summary.bestDayPnl)}`}>
            {formatMoney(summary.bestDayPnl)}
            <span className="day-recent-stat-sub">{bestDayLabel}</span>
          </span>
        </div>
      </div>

      <EquityCurve points={slice} height={52} showLabels />
    </div>
  )
}
