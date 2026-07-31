import { useMemo, useState } from 'react'
import type { Locale } from 'date-fns'
import type { Trade } from '../types/trade'
import type { PeriodView } from '../types/trade'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass, winRate, groupByPeriod } from '../lib/aggregations'

interface Props {
  trades: Trade[]
  dateLocale: Locale
  t: Translations['period']
}

export function PeriodSummaryPanel({ trades, dateLocale, t }: Props) {
  const [period, setPeriod] = useState<PeriodView>('month')

  const periodLabels: Record<PeriodView, string> = {
    day: t.day,
    week: t.week,
    month: t.month,
    year: t.year,
  }

  const summaries = useMemo(
    () => groupByPeriod(trades, period, dateLocale),
    [trades, period, dateLocale],
  )
  const wr = useMemo(() => winRate(trades), [trades])

  return (
    <section className="panel analytics-section">
      <div className="panel-head">
        <h3>
          {t.view} {periodLabels[period]}
        </h3>
        <div className="period-btns">
          {(Object.keys(periodLabels) as PeriodView[]).map((p) => (
            <button
              key={p}
              type="button"
              className={period === p ? 'active' : ''}
              onClick={() => setPeriod(p)}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>
      {summaries.length === 0 ? (
        <p className="empty">{t.empty}</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.period}</th>
              <th>{t.trades}</th>
              <th>{t.pnl}</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.key}>
                <td>{s.label}</td>
                <td>{s.trades}</td>
                <td className={pnlClass(s.pnl)}>{formatMoney(s.pnl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint-inline">
        {t.winRate} {wr.toFixed(1)}% · {trades.length} {t.positions}
      </p>
    </section>
  )
}
