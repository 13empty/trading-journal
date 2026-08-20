import { PROFIT_GOAL_LABEL_KEYS, type ProfitGoalState } from '../lib/profitGoals'
import { formatMoney, pnlClass } from '../lib/aggregations'
import type { Translations } from '../i18n/types'

interface Props {
  goals: ProfitGoalState[]
  t: Translations['profitGoals']
  compact?: boolean
  showGoalReachedMessage?: boolean
  showGauge?: boolean
}

function GoalGauge({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c
  return (
    <div className="goal-gauge" aria-label={`${label} ${clamped.toFixed(1)}%`}>
      <svg viewBox="0 0 88 88" className="goal-gauge-svg" aria-hidden="true">
        <circle className="goal-gauge-track" cx="44" cy="44" r={r} />
        <circle
          className="goal-gauge-fill"
          cx="44"
          cy="44"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="goal-gauge-center">
        <span className="goal-gauge-pct">{clamped.toFixed(1)}%</span>
        <span className="goal-gauge-label">{label}</span>
      </div>
    </div>
  )
}

export function ProfitGoalsPanel({
  goals,
  t,
  compact = false,
  showGoalReachedMessage = true,
  showGauge = true,
}: Props) {
  const active = goals.filter((g) => g.status !== 'off')
  if (active.length === 0) return null

  const reachedCount = showGoalReachedMessage
    ? active.filter((g) => g.status === 'reached').length
    : 0
  const monthly = active.find((g) => g.id === 'monthly')

  const statusLabel = (goal: ProfitGoalState) => {
    if (goal.status === 'reached') {
      return showGoalReachedMessage ? t.statusReached : t.statusProgress
    }
    if (goal.status === 'progress') return t.statusProgress
    return t.statusOff
  }

  return (
    <section
      className={`panel profit-goals-panel${reachedCount > 0 ? ' has-reached' : ''}${compact ? ' compact' : ''}${showGauge && monthly ? ' with-gauge' : ''}`}
      aria-label={t.title}
    >
      {!compact && (
        <>
          <h3>{t.title}</h3>
          <p className="profit-goals-sub">{t.subtitle}</p>
        </>
      )}
      <div className="profit-goals-layout">
        <ul className="profit-goals-list">
          {active.map((goal) => (
            <li key={goal.id} className={`profit-goal profit-goal-${goal.status}`}>
              <div className="profit-goal-head">
                <span className="profit-goal-name">{t[PROFIT_GOAL_LABEL_KEYS[goal.id]]}</span>
                <span className={`profit-goal-status profit-status-${goal.status}`}>
                  {statusLabel(goal)}
                </span>
              </div>
              <span className={`profit-goal-amount ${pnlClass(goal.current)}`}>
                {formatMoney(goal.current)} / {formatMoney(goal.goal)}
              </span>
              <div className="goal-bar">
                <div
                  className={`goal-fill ${goal.status === 'reached' ? 'positive' : pnlClass(goal.current)}`}
                  style={{ width: `${goal.pct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        {showGauge && monthly && <GoalGauge pct={monthly.pct} label={t.gaugeMonthly} />}
      </div>
    </section>
  )
}
