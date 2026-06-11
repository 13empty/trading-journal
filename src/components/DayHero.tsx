import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { parseLocalDateKey } from '../lib/mt5Date'
import { EquityCurve } from './EquityCurve'
import type { EquityPoint } from '../types/journal'

interface Props {
  selectedDate: string
  selectedDay: DayActivity | undefined
  dayTradeCount: number
  dayWinRate: number
  displayBalance: number
  equityPoints: EquityPoint[]
  dateFormat: string
  dateLocale: Locale
  subtitle?: string
  t: Translations['dayHero']
}

export function DayHero({
  selectedDate,
  selectedDay,
  dayTradeCount,
  dayWinRate,
  displayBalance,
  equityPoints,
  dateFormat,
  dateLocale,
  subtitle,
  t,
}: Props) {
  const pnl = selectedDay?.pnl ?? 0
  const hasLive = (selectedDay?.openCount ?? 0) > 0

  return (
    <section className="panel day-hero">
      <div className="day-hero-head">
        <div>
          <h2 className="day-hero-date">
            {format(parseLocalDateKey(selectedDate), dateFormat, { locale: dateLocale })}
          </h2>
          {subtitle && <p className="day-hero-sub">{subtitle}</p>}
        </div>
      </div>

      <div className={`day-hero-pnl ${pnlClass(pnl)}`}>
        <span className="day-hero-pnl-label">{t.pnl}</span>
        <span className="day-hero-pnl-amount">{formatMoney(pnl)}</span>
        {hasLive && (
          <span className="day-hero-pnl-hint">
            {t.floating} {formatMoney(selectedDay?.livePnl ?? 0)}
          </span>
        )}
      </div>

      <div className="day-kpi-row">
        <div className="kpi-card hero-kpi">
          <span className="label">{t.balance}</span>
          <span className="val">{formatMoney(displayBalance).replace('+', '')}</span>
        </div>
        <div className="kpi-card hero-kpi">
          <span className="label">{t.trades}</span>
          <span className="val">{dayTradeCount}</span>
        </div>
        <div className="kpi-card hero-kpi">
          <span className="label">{t.winRate}</span>
          <span className="val">{dayTradeCount > 0 ? `${dayWinRate.toFixed(0)}%` : '—'}</span>
        </div>
      </div>

      <div className="day-hero-chart">
        <h4 className="day-hero-chart-title">{t.equity}</h4>
        <EquityCurve points={equityPoints} />
      </div>
    </section>
  )
}
