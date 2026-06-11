import type { CashMovement } from '../types/account'
import type { DayActivity } from '../types/account'
import type { AppSettings } from '../types/account'
import type { Trade } from '../types/trade'
import type { DailyNote } from '../types/journal'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { sumDayOutflow } from '../lib/displayMoney'

interface Props {
  date: string
  day: DayActivity | undefined
  dayTrades: Trade[]
  dayCash: CashMovement[]
  settings: AppSettings
  dayNote: DailyNote
  t: Translations['session']
  onClose: () => void
  onEditNotes: () => void
}

export function SessionSummaryModal({
  date,
  day,
  dayTrades,
  dayCash,
  settings,
  dayNote,
  t,
  onClose,
  onEditNotes,
}: Props) {
  const pnl = day?.pnl ?? 0
  const wins = dayTrades.filter((x) => x.pnl >= 0).length
  const losses = dayTrades.length - wins
  const goalPct =
    settings.dailyProfitGoal && settings.dailyProfitGoal > 0
      ? Math.min(100, Math.max(0, (pnl / settings.dailyProfitGoal) * 100))
      : null
  const hitLossLimit =
    settings.dailyLossLimit && pnl <= -Math.abs(settings.dailyLossLimit)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide session-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t.title}</h2>
        <p className="welcome-lead">{date}</p>

        <div className="session-stats-grid">
          <div className={`session-stat ${pnlClass(pnl)}`}>
            <span className="label">{t.pnl}</span>
            <span className="val">{formatMoney(pnl)}</span>
          </div>
          <div className="session-stat">
            <span className="label">{t.trades}</span>
            <span className="val">
              {dayTrades.length} ({wins}W / {losses}L)
            </span>
          </div>
          {settings.dailyProfitGoal != null && (
            <div className="session-stat">
              <span className="label">{t.dailyGoal}</span>
              <span className="val">
                {formatMoney(pnl)} / {formatMoney(settings.dailyProfitGoal)}
                {goalPct != null ? ` (${goalPct.toFixed(0)}%)` : ''}
              </span>
            </div>
          )}
          {day && (
            <div className="session-stat">
              <span className="label">{t.withdrawals}</span>
              <span className="val cash-out">${sumDayOutflow(dayCash, day).toFixed(2)}</span>
            </div>
          )}
        </div>

        {hitLossLimit && <p className="goal-alert inline">{t.lossLimitHit}</p>}

        {(dayNote.text || dayNote.whatWorked || dayNote.whatFailed) && (
          <div className="session-notes-preview">
            <strong>{t.notesPreview}</strong>
            {dayNote.text && <p>{dayNote.text}</p>}
            {dayNote.whatWorked && (
              <p>
                <span className="positive">+</span> {dayNote.whatWorked}
              </p>
            )}
            {dayNote.whatFailed && (
              <p>
                <span className="negative">−</span> {dayNote.whatFailed}
              </p>
            )}
          </div>
        )}

        <p className="hint-inline">{t.hint}</p>

        <div className="modal-actions">
          <button type="button" onClick={onEditNotes}>
            {t.editNotes}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
