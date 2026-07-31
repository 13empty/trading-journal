import { useState } from 'react'
import type { ProfitGoalState } from '../lib/profitGoals'
import type { ThresholdRuleState } from '../types/journal'
import type { Translations } from '../i18n/types'
import { ProfitGoalsPanel } from './ProfitGoalsPanel'
import { ThresholdRulesPanel } from './ThresholdRulesPanel'

interface Props {
  defaultOpen: boolean
  showGoals: boolean
  showRules: boolean
  profitGoals: ProfitGoalState[]
  thresholdRules: ThresholdRuleState[]
  t: Translations['dayTab']
  tGoals: Translations['profitGoals']
  tThresholds: Translations['thresholds']
}

export function DayInsightsSection({
  defaultOpen,
  showGoals,
  showRules,
  profitGoals,
  thresholdRules,
  t,
  tGoals,
  tThresholds,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const hasGoalsPanel = showGoals && profitGoals.some((g) => g.status !== 'off')
  const hasRulesPanel = showRules && thresholdRules.length > 0

  if (!hasGoalsPanel && !hasRulesPanel) return null

  return (
    <details className="day-insights" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="day-insights-summary">
        <span>{t.insightsTitle}</span>
        <span className="day-insights-hint">{t.insightsHint}</span>
      </summary>
      <div className="day-insights-body">
        {hasGoalsPanel && <ProfitGoalsPanel goals={profitGoals} t={tGoals} compact />}
        {hasRulesPanel && (
          <ThresholdRulesPanel rules={thresholdRules} t={tThresholds} compact />
        )}
      </div>
    </details>
  )
}
