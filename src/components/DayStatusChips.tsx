import type { ProfitGoalState } from '../lib/profitGoals'
import type { ThresholdRuleState } from '../types/journal'
import type { Translations } from '../i18n/types'

interface Props {
  profitGoals: ProfitGoalState[]
  thresholdRules: ThresholdRuleState[]
  showGoals: boolean
  showRules: boolean
  t: Translations['dayTab']
  tGoals: Translations['profitGoals']
}

const GOAL_LABEL: Record<ProfitGoalState['id'], keyof Translations['profitGoals']> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
}

export function DayStatusChips({
  profitGoals,
  thresholdRules,
  showGoals,
  showRules,
  t,
  tGoals,
}: Props) {
  const activeGoals = showGoals ? profitGoals.filter((g) => g.status !== 'off') : []
  const ruleWarns = showRules ? thresholdRules.filter((r) => r.status === 'warn').length : 0
  const hasRules = showRules && thresholdRules.some((r) => r.status !== 'off')

  if (activeGoals.length === 0 && !hasRules) return null

  return (
    <div className="day-status-chips" aria-label={t.statusAria}>
      {activeGoals.map((goal) => (
        <span
          key={goal.id}
          className={`day-chip day-chip-goal day-chip-${goal.status}`}
          title={`${tGoals[GOAL_LABEL[goal.id]]}: ${Math.round(goal.pct)}%`}
        >
          {tGoals[GOAL_LABEL[goal.id]]}
          {goal.status === 'reached' ? (
            <span className="day-chip-badge ok">{tGoals.statusReached}</span>
          ) : (
            <span className="day-chip-badge">{Math.round(goal.pct)}%</span>
          )}
        </span>
      ))}
      {hasRules && (
        <span
          className={`day-chip day-chip-rules${ruleWarns > 0 ? ' day-chip-warn' : ' day-chip-ok'}`}
        >
          {ruleWarns > 0
            ? t.chipRulesStop.replace('{count}', String(ruleWarns))
            : t.chipRulesOk}
        </span>
      )}
    </div>
  )
}
