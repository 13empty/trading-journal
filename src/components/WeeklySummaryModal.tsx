import { formatDisplayDate } from '../lib/dateDisplay'
import type { Locale } from 'date-fns'
import type { WeeklySummaryData } from '../lib/weeklySummary'
import type { WeeklyNote } from '../types/journal'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { interpolate } from '../i18n'
import { parseLocalDateKey } from '../lib/mt5Date'

interface Props {
  summary: WeeklySummaryData
  weekNote: WeeklyNote
  dateLocale: Locale
  t: Translations['weekly']
  onSaveNote: (patch: Partial<WeeklyNote>) => void
  onClose: () => void
}

export function WeeklySummaryModal({
  summary,
  weekNote,
  dateLocale,
  t,
  onSaveNote,
  onClose,
}: Props) {
  const tf = interpolate
  const rangeLabel = tf(t.weekRange, {
    start: formatDisplayDate(parseLocalDateKey(summary.weekStart), 'd MMM', dateLocale),
    end: formatDisplayDate(parseLocalDateKey(summary.weekEnd), 'd MMM yyyy', dateLocale),
  })

  const fmtDay = (date: string, pnl: number) =>
    `${formatDisplayDate(parseLocalDateKey(date), 'EEE d', dateLocale)} · ${formatMoney(pnl)}`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide session-modal weekly-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t.title}</h2>
        <p className="welcome-lead">{rangeLabel}</p>

        {summary.tradingDays === 0 ? (
          <p className="empty">{t.noTrades}</p>
        ) : (
          <>
            <div className="session-stats-grid">
              <div className={`session-stat ${pnlClass(summary.totalPnl)}`}>
                <span className="label">{t.totalPnl}</span>
                <span className="val">{formatMoney(summary.totalPnl)}</span>
              </div>
              <div className="session-stat">
                <span className="label">{t.tradingDays}</span>
                <span className="val">
                  {summary.tradingDays} · {summary.tradeCount} trades
                </span>
              </div>
              <div className="session-stat">
                <span className="label">{t.winRate}</span>
                <span className="val">
                  {summary.tradeCount > 0 ? `${summary.winRatePct.toFixed(0)}%` : '—'}
                </span>
              </div>
              <div className="session-stat">
                <span className="label">{t.greenRed}</span>
                <span className="val">
                  <span className="positive">{summary.greenDays}+</span>
                  {' / '}
                  <span className="negative">{summary.redDays}−</span>
                </span>
              </div>
              {summary.bestDay && (
                <div className="session-stat">
                  <span className="label">{t.bestDay}</span>
                  <span className={`val ${pnlClass(summary.bestDay.pnl)}`}>
                    {fmtDay(summary.bestDay.date, summary.bestDay.pnl)}
                  </span>
                </div>
              )}
              {summary.worstDay && (
                <div className="session-stat">
                  <span className="label">{t.worstDay}</span>
                  <span className={`val ${pnlClass(summary.worstDay.pnl)}`}>
                    {fmtDay(summary.worstDay.date, summary.worstDay.pnl)}
                  </span>
                </div>
              )}
            </div>

            {summary.topSymbols.length > 0 && (
              <div className="weekly-symbols">
                <strong>{t.topSymbols}</strong>
                <ul>
                  {summary.topSymbols.map((row) => (
                    <li key={row.symbol}>
                      <span>{row.symbol}</span>
                      <span className="hint-text">{row.trades} trades</span>
                      <span className={pnlClass(row.pnl)}>{formatMoney(row.pnl)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <div className="weekly-notes-form">
          <label>
            {t.repeat}
            <textarea
              rows={2}
              value={weekNote.repeat}
              onChange={(e) => onSaveNote({ repeat: e.target.value })}
            />
          </label>
          <label>
            {t.avoid}
            <textarea
              rows={2}
              value={weekNote.avoid}
              onChange={(e) => onSaveNote({ avoid: e.target.value })}
            />
          </label>
          <label>
            {t.focus}
            <textarea
              rows={2}
              value={weekNote.focus}
              onChange={(e) => onSaveNote({ focus: e.target.value })}
            />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
