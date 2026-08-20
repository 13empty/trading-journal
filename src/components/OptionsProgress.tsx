import type { ProfitGoalState } from '../lib/profitGoals'
import { formatMoney, pnlClass } from '../lib/aggregations'
import type { ThresholdRuleState } from '../types/journal'
import { THRESHOLD_LABEL_KEYS } from '../lib/thresholdRules'
import type { Translations } from '../i18n/types'

function ruleLevel(rule: ThresholdRuleState): 'off' | 'low' | 'medium' | 'high' {
  if (rule.status === 'off') return 'off'
  if (rule.status === 'warn') return 'high'
  if ((rule.progress ?? 0) >= 70) return 'medium'
  return 'low'
}

/** Monthly ring like the mockup Options panel. */
export function MonthlyGoalGauge({
  goal,
  label,
}: {
  goal: ProfitGoalState
  label: string
}) {
  const pct = Math.max(0, Math.min(100, goal.pct))
  const r = 40
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="monthly-goal-gauge" aria-label={`${label} ${pct.toFixed(1)}%`}>
      <svg viewBox="0 0 100 100" className="monthly-goal-gauge-svg" aria-hidden="true">
        <circle className="goal-gauge-track" cx="50" cy="50" r={r} />
        <circle
          className="goal-gauge-fill"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="monthly-goal-gauge-center">
        <span className={`monthly-goal-gauge-pct ${pnlClass(goal.current)}`}>{pct.toFixed(1)}%</span>
        <span className="monthly-goal-gauge-caption">{label}</span>
        <span className={`monthly-goal-gauge-amt ${pnlClass(goal.current)}`}>
          {formatMoney(goal.current)} / {formatMoney(goal.goal)}
        </span>
      </div>
    </div>
  )
}

/** Horizontal risk rows + status pill per rule (mockup Options panel). */
export function RiskRulesSummary({
  rules,
  t,
}: {
  rules: ThresholdRuleState[]
  t: Translations['thresholds']
}) {
  const active = rules.filter((r) => r.status !== 'off')
  if (active.length === 0) return null

  return (
    <div className="risk-rules-summary">
      <div className="risk-rules-summary-cards">
        {active.map((rule) => {
          const level = ruleLevel(rule)
          const levelLabel =
            level === 'high'
              ? t.riskHigh
              : level === 'medium'
                ? t.riskMedium
                : level === 'low'
                  ? t.riskLow
                  : t.riskOff
          return (
            <div key={rule.id} className={`risk-summary-card threshold-${rule.status}`}>
              <div className="risk-summary-card-main">
                <span className="risk-summary-name">{t[THRESHOLD_LABEL_KEYS[rule.id]]}</span>
                <span className="risk-summary-detail">{rule.detail ?? '—'}</span>
                {rule.progress != null && (
                  <div className="threshold-bar">
                    <div
                      className={`threshold-fill threshold-fill-${rule.status}`}
                      style={{ width: `${Math.min(100, Math.max(0, rule.progress))}%` }}
                    />
                  </div>
                )}
              </div>
              {rule.progress != null && (
                <span className="risk-summary-pct">{rule.progress.toFixed(2)}%</span>
              )}
              {level !== 'off' && (
                <span className={`risk-pill risk-pill-${level}`}>
                  <i className="risk-pill-dot" aria-hidden="true" />
                  {levelLabel}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
