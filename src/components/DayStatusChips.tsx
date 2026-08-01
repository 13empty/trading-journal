import type { ProfitGoalState } from '../lib/profitGoals'
import type { ThresholdRuleState } from '../types/journal'
import type { Translations } from '../i18n/types'

interface Props {
  profitGoals: ProfitGoalState[]
  thresholdRules: ThresholdRuleState[]
  showGoals: boolean
  showRules: boolean
  showGoalReachedMessage?: boolean
  t: Translations['dayTab']
  tGoals: Translations['profitGoals']
}

const GOAL_LABEL: Record<ProfitGoalState['id'], keyof Translations['profitGoals']> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
}

const GOAL_CHIP_MIN_PCT = 80

export function DayStatusChips({
  profitGoals,
  thresholdRules,
  showGoals,
  showRules,
  showGoalReachedMessage = true,
  t,
  tGoals,
}: Props) {
  const goalChips = showGoals
    ? profitGoals.filter(
        (g) =>
          g.status !== 'off' &&
          (g.status === 'progress' ? g.pct >= GOAL_CHIP_MIN_PCT : showGoalReachedMessage),
      )
    : []
  const ruleWarns = showRules ? thresholdRules.filter((r) => r.status === 'warn').length : 0

  if (goalChips.length === 0 && ruleWarns === 0) return null

  return (
    <div className="day-status-chips" aria-label={t.statusAria}>
      {goalChips.map((goal) => (
        <span
          key={goal.id}
          className={`day-chip day-chip-goal day-chip-${goal.status}`}
          title={`${tGoals[GOAL_LABEL[goal.id]]}: ${Math.round(goal.pct)}%`}
        >
          {tGoals[GOAL_LABEL[goal.id]]}
          {goal.status === 'reached' && showGoalReachedMessage ? (
            <span className="day-chip-badge ok">{tGoals.statusReached}</span>
          ) : (
            <span className="day-chip-badge">{Math.round(goal.pct)}%</span>
          )}
        </span>
      ))}
      {ruleWarns > 0 && (
        <span className="day-chip day-chip-rules day-chip-warn">
          {t.chipRulesStop.replace('{count}', String(ruleWarns))}
        </span>
      )}
    </div>
  )
}
