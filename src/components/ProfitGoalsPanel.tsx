import type { ProfitGoalState } from '../lib/profitGoals'
import { formatMoney, pnlClass } from '../lib/aggregations'
import type { Translations } from '../i18n/types'

interface Props {
  goals: ProfitGoalState[]
  t: Translations['profitGoals']
  compact?: boolean
}

const LABEL_KEY: Record<ProfitGoalState['id'], keyof Translations['profitGoals']> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
}

export function ProfitGoalsPanel({ goals, t, compact = false }: Props) {
  const active = goals.filter((g) => g.status !== 'off')
  if (active.length === 0) return null

  const reachedCount = active.filter((g) => g.status === 'reached').length

  const statusLabel = (goal: ProfitGoalState) => {
    if (goal.status === 'reached') return t.statusReached
    if (goal.status === 'progress') return t.statusProgress
    return t.statusOff
  }

  return (
    <section
      className={`panel profit-goals-panel${reachedCount > 0 ? ' has-reached' : ''}${compact ? ' compact' : ''}`}
      aria-label={t.title}
    >
      {!compact && (
        <>
          <h3>{t.title}</h3>
          <p className="profit-goals-sub">{t.subtitle}</p>
        </>
      )}
      <ul className="profit-goals-list">
        {active.map((goal) => (
          <li
            key={goal.id}
            className={`profit-goal profit-goal-${goal.status}`}
          >
            <div className="profit-goal-head">
              <span className="profit-goal-name">{t[LABEL_KEY[goal.id]]}</span>
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
    </section>
  )
}
