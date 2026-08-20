import { PROFIT_GOAL_LABEL_KEYS, type ProfitGoalState } from '../lib/profitGoals'
import { formatMoney, pnlClass } from '../lib/aggregations'
import type { ThresholdRuleState } from '../types/journal'
import { THRESHOLD_LABEL_KEYS } from '../lib/thresholdRules'
import type { Translations } from '../i18n/types'

interface Props {
  goals: ProfitGoalState[]
  rules: ThresholdRuleState[]
  showGoals: boolean
  showRules: boolean
  tGoals: Translations['profitGoals']
  tThresholds: Translations['thresholds']
}

function ruleLevel(rule: ThresholdRuleState): 'off' | 'low' | 'medium' | 'high' {
  if (rule.status === 'off') return 'off'
  if (rule.status === 'warn') return 'high'
  if ((rule.progress ?? 0) >= 70) return 'medium'
  return 'low'
}

/** Bottom dock for secondary windows: metas + reglas (no mini day PnL). */
export function ProgressDock({
  goals,
  rules,
  showGoals,
  showRules,
  tGoals,
  tThresholds,
}: Props) {
  const activeGoals = showGoals ? goals.filter((g) => g.status !== 'off') : []
  const activeRules = showRules ? rules.filter((r) => r.status !== 'off') : []

  if (activeGoals.length === 0 && activeRules.length === 0) return null

  return (
    <div className="progress-dock" aria-label={`${tGoals.title} · ${tThresholds.title}`}>
      {activeGoals.length > 0 && (
        <section className="progress-dock-goals">
          <span className="progress-dock-title">{tGoals.title}</span>
          <div className="progress-dock-goals-row">
            {activeGoals.map((goal) => (
              <div key={goal.id} className={`progress-dock-goal progress-dock-goal-${goal.status}`}>
                <div className="progress-dock-goal-head">
                  <span className="progress-dock-goal-name">
                    {tGoals[PROFIT_GOAL_LABEL_KEYS[goal.id]]}
                  </span>
                  <span className={`progress-dock-goal-pct ${pnlClass(goal.current)}`}>
                    {goal.pct.toFixed(0)}%
                  </span>
                </div>
                <span className={`progress-dock-goal-amt ${pnlClass(goal.current)}`}>
                  {formatMoney(goal.current)} / {formatMoney(goal.goal)}
                </span>
                <div className="goal-bar progress-dock-bar">
                  <div
                    className={`goal-fill ${goal.status === 'reached' ? 'positive' : pnlClass(goal.current)}`}
                    style={{ width: `${Math.min(100, goal.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeRules.length > 0 && (
        <section className="progress-dock-rules">
          <span className="progress-dock-title">{tThresholds.title}</span>
          <div className="progress-dock-rules-row">
            {activeRules.map((rule) => {
              const level = ruleLevel(rule)
              const levelLabel =
                level === 'high'
                  ? tThresholds.riskHigh
                  : level === 'medium'
                    ? tThresholds.riskMedium
                    : level === 'low'
                      ? tThresholds.riskLow
                      : tThresholds.riskOff
              return (
                <div key={rule.id} className={`progress-dock-rule threshold-${rule.status}`}>
                  <div className="progress-dock-rule-head">
                    <span className="progress-dock-rule-name">
                      {tThresholds[THRESHOLD_LABEL_KEYS[rule.id]]}
                    </span>
                    <span className="progress-dock-rule-head-right">
                      {rule.progress != null && (
                        <span className="progress-dock-rule-pct">{rule.progress.toFixed(0)}%</span>
                      )}
                      {level !== 'off' && (
                        <span className={`risk-pill risk-pill-${level}`}>
                          <i className="risk-pill-dot" aria-hidden="true" />
                          {levelLabel}
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="progress-dock-rule-detail">{rule.detail ?? '—'}</span>
                  {rule.progress != null && (
                    <div className="threshold-bar progress-dock-bar">
                      <div
                        className={`threshold-fill threshold-fill-${rule.status}`}
                        style={{ width: `${Math.min(100, Math.max(0, rule.progress))}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
