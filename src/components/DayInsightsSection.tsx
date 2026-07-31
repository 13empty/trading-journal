import { useState } from 'react'
import type { ProfitGoalState } from '../lib/profitGoals'
import type { DailyNote, ThresholdRuleState } from '../types/journal'
import type { Translations } from '../i18n/types'
import { ProfitGoalsPanel } from './ProfitGoalsPanel'
import { ThresholdRulesPanel } from './ThresholdRulesPanel'

interface Props {
  defaultOpen: boolean
  showGoals: boolean
  showRules: boolean
  profitGoals: ProfitGoalState[]
  thresholdRules: ThresholdRuleState[]
  dayNote: DailyNote
  onSaveNote: (patch: Partial<DailyNote>) => void
  t: Translations['dayTab']
  tGoals: Translations['profitGoals']
  tThresholds: Translations['thresholds']
  tJournal: Translations['journal']
}

export function DayInsightsSection({
  defaultOpen,
  showGoals,
  showRules,
  profitGoals,
  thresholdRules,
  dayNote,
  onSaveNote,
  t,
  tGoals,
  tThresholds,
  tJournal,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const hasGoalsPanel = showGoals && profitGoals.some((g) => g.status !== 'off')
  const hasRulesPanel = showRules && thresholdRules.length > 0

  if (!hasGoalsPanel && !hasRulesPanel) {
    return (
      <details className="day-insights" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="day-insights-summary">{t.notesOnlyTitle}</summary>
        <div className="day-insights-body">
          <DailyNotesForm dayNote={dayNote} onSaveNote={onSaveNote} tJournal={tJournal} />
        </div>
      </details>
    )
  }

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
        <DailyNotesForm dayNote={dayNote} onSaveNote={onSaveNote} tJournal={tJournal} />
      </div>
    </details>
  )
}

function DailyNotesForm({
  dayNote,
  onSaveNote,
  tJournal,
}: {
  dayNote: DailyNote
  onSaveNote: (patch: Partial<DailyNote>) => void
  tJournal: Translations['journal']
}) {
  return (
    <div className="daily-notes daily-notes-compact">
      <h4 className="sub-head">{tJournal.dailyNotes}</h4>
      <label>
        <textarea
          rows={2}
          value={dayNote.text}
          onChange={(e) => onSaveNote({ text: e.target.value })}
          placeholder="…"
        />
      </label>
      <div className="notes-row">
        <label>
          {tJournal.whatWorked}
          <input
            type="text"
            value={dayNote.whatWorked}
            onChange={(e) => onSaveNote({ whatWorked: e.target.value })}
          />
        </label>
        <label>
          {tJournal.whatFailed}
          <input
            type="text"
            value={dayNote.whatFailed}
            onChange={(e) => onSaveNote({ whatFailed: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
