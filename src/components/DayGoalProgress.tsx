import type { DayActivity } from '../types/account'
import type { GoalPlan } from '../types/goalPlan'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { evaluateGoalPlan, type GoalPace } from '../lib/goalPlan'
import {
  PROFIT_GOAL_LABEL_KEYS,
  periodPnl,
  type ProfitGoalState,
} from '../lib/profitGoals'

interface Props {
  goals: ProfitGoalState[]
  plans?: GoalPlan[]
  dayMap: Map<string, DayActivity>
  selectedDate: string
  t: Translations['profitGoals']
  tPlan?: Translations['goalPlan']
}

const PERIOD: Record<ProfitGoalState['id'], 'day' | 'week' | 'month'> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
}

function paceLabel(pace: GoalPace, t: Translations['goalPlan']): string {
  if (pace === 'upcoming') return t.paceUpcoming
  if (pace === 'ahead') return t.paceAhead
  if (pace === 'behind') return t.paceBehind
  if (pace === 'reached') return t.paceReached
  if (pace === 'missed') return t.paceMissed
  return t.paceOnTrack
}

export function DayGoalProgress({ goals, plans = [], dayMap, selectedDate, t, tPlan }: Props) {
  return (
    <section className="panel day-goal-progress" aria-label={t.title}>
      <h3>{t.title}</h3>
      <p className="hint-inline">{t.subtitle}</p>
      <div className="day-goal-list">
        {goals.map((goal) => {
          const configured = goal.status !== 'off' && goal.goal > 0
          const current = configured ? goal.current : periodPnl(dayMap, selectedDate, PERIOD[goal.id])
          const pct = configured ? (current / goal.goal) * 100 : null
          const reached = configured && current >= goal.goal
          return (
            <div key={goal.id} className={`day-goal-row${reached ? ' reached' : ''}`}>
              <div className="day-goal-head">
                <span className="day-goal-name">{t[PROFIT_GOAL_LABEL_KEYS[goal.id]]}</span>
                <span className={`day-goal-state ${configured ? 'on' : 'off'}`}>
                  {configured ? t.statusActive : t.statusInactive}
                </span>
                <span className={`day-goal-pct ${configured ? pnlClass(current) : ''}`}>
                  {pct == null ? '—' : `${Math.round(pct)}%`}
                </span>
              </div>
              <span className={`day-goal-amt ${pnlClass(current)}`}>
                {formatMoney(current)}
                {configured ? ` / ${formatMoney(goal.goal)}` : ''}
              </span>
              <div className="goal-bar day-goal-bar" aria-hidden="true">
                <div
                  className={`goal-fill ${reached ? 'positive' : pnlClass(current)}`}
                  style={{ width: `${pct == null ? 0 : Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </div>
          )
        })}
        {tPlan && plans.length > 0 && (
          <>
            <h4 className="day-goal-plans-title">{tPlan.title}</h4>
            {plans.map((plan) => {
              const evaluation = evaluateGoalPlan(plan, dayMap, selectedDate)
              const broken = Boolean(evaluation.issue)
              const pct = !broken && evaluation.target > 0 ? (evaluation.actual / evaluation.target) * 100 : null
              const state =
                evaluation.pace === 'behind' || evaluation.pace === 'missed'
                  ? 'off'
                  : evaluation.pace === 'upcoming' || broken
                    ? 'off'
                    : 'on'
              return (
                <div key={plan.id} className={`day-goal-row${evaluation.pace === 'reached' ? ' reached' : ''}`}>
                  <div className="day-goal-head">
                    <span className="day-goal-name">{plan.name.trim() || tPlan.untitled}</span>
                    <span className={`day-goal-state ${state}`}>
                      {broken ? t.statusInactive : paceLabel(evaluation.pace, tPlan)}
                    </span>
                    <span className={`day-goal-pct ${pct == null ? '' : pnlClass(evaluation.actual)}`}>
                      {pct == null ? '—' : `${Math.round(pct)}%`}
                    </span>
                  </div>
                  <span className={`day-goal-amt ${pnlClass(evaluation.actual)}`}>
                    {broken ? '—' : `${formatMoney(evaluation.actual)} / ${formatMoney(evaluation.target)}`}
                  </span>
                  <div className="goal-bar day-goal-bar" aria-hidden="true">
                    <div
                      className={`goal-fill ${evaluation.pace === 'reached' ? 'positive' : pnlClass(evaluation.actual)}`}
                      style={{ width: `${pct == null ? 0 : Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </section>
  )
}
