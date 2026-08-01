import type { DayJournalStats } from '../lib/tradeJournalStats'
import type { Translations } from '../i18n/types'
import { interpolate } from '../i18n'

interface Props {
  stats: DayJournalStats
  t: Translations['dayJournal']
}

export function DayTradeJournalBar({ stats, t }: Props) {
  const tf = interpolate

  return (
    <div className="day-journal-bar" aria-label={t.title}>
      <span className="day-journal-chip">
        {tf(t.journaled, { done: stats.journaled, total: stats.total })}
      </span>
      <span className="day-journal-chip" title={t.setupHint}>
        {tf(t.setupPct, { pct: Math.round(stats.setupPct) })}
      </span>
      <span className="day-journal-chip" title={t.riskHint}>
        {tf(t.riskPct, { pct: Math.round(stats.riskPct) })}
      </span>
      {stats.avgR != null && (
        <span className="day-journal-chip">
          {tf(t.avgR, { r: stats.avgR.toFixed(1) })}
        </span>
      )}
    </div>
  )
}
