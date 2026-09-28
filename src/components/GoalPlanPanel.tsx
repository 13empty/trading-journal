import { useMemo, useState } from 'react'
import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { GoalPlan } from '../types/goalPlan'
import type { Translations } from '../i18n/types'
import { interpolate } from '../i18n'
import { formatBalance, formatMoney, pnlClass } from '../lib/aggregations'
import { formatDisplayDate } from '../lib/dateDisplay'
import { evaluateGoalPlan, suggestedPlanWindow, type GoalPace } from '../lib/goalPlan'
import { parseLocalDateKey } from '../lib/mt5Date'
import { createId } from '../lib/storage'

interface Props {
  plans: GoalPlan[]
  dayMap: Map<string, DayActivity>
  asOfDate: string
  dateLocale: Locale
  onChange: (plans: GoalPlan[]) => void
  t: Translations['goalPlan']
}

function coercePlan(plan: GoalPlan): GoalPlan {
  return {
    id: plan.id,
    name: plan.name ?? '',
    dailyAmount: Number(plan.dailyAmount) || 0,
    totalGoal: plan.totalGoal != null && plan.totalGoal > 0 ? plan.totalGoal : undefined,
    startDate: plan.startDate,
    endDate: plan.endDate,
    weekdaysOnly: plan.weekdaysOnly !== false,
    stopAtDailyTarget: plan.stopAtDailyTarget !== false,
    maxDailyLoss: plan.maxDailyLoss,
    maxTradesPerDay: plan.maxTradesPerDay,
    riskPerTradePct: plan.riskPerTradePct,
    strategy: plan.strategy ?? '',
  }
}

function blankPlan(asOfDate: string): GoalPlan {
  const window = suggestedPlanWindow(asOfDate)
  return {
    id: createId(),
    name: '',
    dailyAmount: 300,
    startDate: window.startDate,
    endDate: window.endDate,
    weekdaysOnly: true,
    stopAtDailyTarget: true,
    strategy: '',
  }
}

function optionalNumber(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

function paceClass(pace: GoalPace): string {
  if (pace === 'ahead' || pace === 'reached') return 'positive'
  if (pace === 'behind' || pace === 'missed') return 'negative'
  return 'neutral'
}

export function GoalPlanPanel({ plans, dayMap, asOfDate, dateLocale, onChange, t }: Props) {
  const safePlans = useMemo(() => plans.map(coercePlan), [plans])
  const [draft, setDraft] = useState<GoalPlan>(() => (plans[0] ? coercePlan(plans[0]) : blankPlan(asOfDate)))
  const [dirty, setDirty] = useState(false)

  const saved = safePlans.find((plan) => plan.id === draft.id)
  const evaluation = useMemo(
    () => evaluateGoalPlan(draft, dayMap, asOfDate),
    [draft, dayMap, asOfDate],
  )

  const patch = (partial: Partial<GoalPlan>) => {
    setDraft((current) => ({ ...current, ...partial }))
    setDirty(true)
  }

  const selectPlan = (plan: GoalPlan) => {
    setDraft(plan)
    setDirty(false)
  }

  const startNew = () => {
    setDraft(blankPlan(asOfDate))
    setDirty(false)
  }

  const dateLabel = (key: string) => formatDisplayDate(parseLocalDateKey(key), 'd MMM yyyy', dateLocale)
  const monthLabel = (key: string) => formatDisplayDate(parseLocalDateKey(`${key}-01`), 'MMMM yyyy', dateLocale)

  const save = () => {
    if (evaluation.issue) return
    const name = draft.name.trim() || `${dateLabel(draft.startDate)} – ${dateLabel(draft.endDate)}`
    const nextPlan: GoalPlan = {
      ...draft,
      name,
      maxTradesPerDay:
        draft.maxTradesPerDay != null ? Math.max(1, Math.round(draft.maxTradesPerDay)) : undefined,
    }
    const exists = safePlans.some((plan) => plan.id === nextPlan.id)
    onChange(
      exists ? safePlans.map((plan) => (plan.id === nextPlan.id ? nextPlan : plan)) : [...safePlans, nextPlan],
    )
    setDraft(nextPlan)
    setDirty(false)
  }

  const remove = () => {
    if (saved && !window.confirm(t.deleteConfirm)) return
    const next = safePlans.filter((plan) => plan.id !== draft.id)
    onChange(next)
    setDraft(next[0] ?? blankPlan(asOfDate))
    setDirty(false)
  }

  const paceLabel: Record<GoalPace, string> = {
    upcoming: t.paceUpcoming,
    on_track: t.paceOnTrack,
    ahead: t.paceAhead,
    behind: t.paceBehind,
    reached: t.paceReached,
    missed: t.paceMissed,
  }

  const money = (n: number) => formatBalance(Math.abs(n))
  const summary = (() => {
    if (evaluation.issue === 'range') return t.invalidRange
    if (evaluation.issue === 'daily') return t.invalidDaily
    if (evaluation.issue === 'noDays') return t.noDays
    const vars = {
      start: dateLabel(draft.startDate),
      end: dateLabel(draft.endDate),
      days: evaluation.tradingDays,
      daily: money(draft.dailyAmount),
      total: money(evaluation.target),
      actual: formatMoney(evaluation.actual),
      expected: money(evaluation.expectedByNow),
      leftDays: evaluation.daysLeft,
      needed: evaluation.requiredDaily == null ? '—' : money(evaluation.requiredDaily),
      gap: money(Math.max(0, evaluation.remaining)),
    }
    if (evaluation.pace === 'upcoming') return interpolate(t.summaryUpcoming, vars)
    if (evaluation.pace === 'reached') return interpolate(t.summaryReached, vars)
    if (evaluation.pace === 'missed') return interpolate(t.summaryMissed, vars)
    if (evaluation.requiredDaily == null) return interpolate(t.summaryNoDays, vars)
    return interpolate(t.summaryActive, vars)
  })()

  const fitNote = (() => {
    if (evaluation.issue || !evaluation.customTotal || evaluation.pace === 'reached') return null
    const vars = {
      daily: money(draft.dailyAmount),
      reach: money(evaluation.plannedReach),
      goal: money(evaluation.target),
      needed: money(evaluation.paceDaily),
      days: evaluation.tradingDays,
    }
    const gap = evaluation.plannedReach - evaluation.target
    if (Math.abs(gap) < 0.5) return interpolate(t.noteExact, vars)
    if (gap > 0) return interpolate(t.noteEnough, vars)
    return interpolate(t.noteShort, vars)
  })()

  const rules: string[] = []
  if (!evaluation.issue) {
    rules.push(draft.weekdaysOnly ? t.ruleWeekdays : t.ruleAllDays)
    if (draft.stopAtDailyTarget) {
      rules.push(interpolate(t.ruleStop, { amount: money(draft.dailyAmount) }))
    }
    if (draft.maxDailyLoss != null && draft.maxDailyLoss > 0) {
      rules.push(interpolate(t.ruleLoss, { amount: money(draft.maxDailyLoss) }))
    }
    if (draft.maxTradesPerDay != null && draft.maxTradesPerDay > 0) {
      rules.push(interpolate(t.ruleTrades, { n: Math.round(draft.maxTradesPerDay) }))
    }
    if (draft.riskPerTradePct != null && draft.riskPerTradePct > 0) {
      rules.push(interpolate(t.ruleRisk, { pct: draft.riskPerTradePct }))
    }
  }

  const progressPct =
    evaluation.target > 0 ? Math.max(0, Math.min(100, (evaluation.actual / evaluation.target) * 100)) : 0

  return (
    <div className="goal-plan-panel">
      <section className="panel goal-plan-intro">
        <h2>{t.title}</h2>
        <p className="welcome-lead">{t.subtitle}</p>
        <div className="goal-plan-switch" role="tablist" aria-label={t.saved}>
          {safePlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              role="tab"
              aria-selected={plan.id === draft.id}
              className={`goal-plan-chip${plan.id === draft.id ? ' active' : ''}`}
              onClick={() => selectPlan(plan)}
            >
              {plan.name || t.untitled}
            </button>
          ))}
          <button type="button" className="goal-plan-chip add" onClick={startNew}>
            {t.newPlan}
          </button>
        </div>
      </section>

      <div className="goal-plan-layout">
        <section className="panel goal-plan-result" aria-live="polite">
          <div className="panel-head">
            <h3>{t.calcTitle}</h3>
            {!evaluation.issue && (
              <span className={`goal-plan-pace ${paceClass(evaluation.pace)}`}>{paceLabel[evaluation.pace]}</span>
            )}
          </div>
          <p className="goal-plan-summary">{summary}</p>
          {fitNote && <p className="projection-note">{fitNote}</p>}

          {!evaluation.issue && (
            <>
              <div className="goal-plan-stats">
                <div className="projection-stat">
                  <span className="label">{t.totalTarget}</span>
                  <span className="val">{formatBalance(evaluation.target)}</span>
                  <span className="sub">
                    {evaluation.tradingDays} {t.dayUnit}
                  </span>
                </div>
                <div className="projection-stat">
                  <span className="label">{t.made}</span>
                  <span className={`val ${pnlClass(evaluation.actual)}`}>{formatMoney(evaluation.actual)}</span>
                  <span className="sub">{t.expectedNow}: {formatBalance(evaluation.expectedByNow)}</span>
                </div>
                <div className="projection-stat">
                  <span className="label">{t.left}</span>
                  <span className="val">{formatBalance(Math.max(0, evaluation.remaining))}</span>
                  <span className="sub">
                    {evaluation.daysLeft} {t.dayUnit}
                    {evaluation.includesToday ? ` · ${t.includingToday}` : ''}
                  </span>
                </div>
                <div className="projection-stat">
                  <span className="label">{t.requiredDaily}</span>
                  <span className="val">
                    {evaluation.requiredDaily == null ? '—' : formatBalance(evaluation.requiredDaily)}
                  </span>
                  <span className="sub">
                    {t.plannedDaily}: {formatBalance(draft.dailyAmount)}
                  </span>
                </div>
              </div>
              <div className="goal-bar" aria-hidden="true">
                <div
                  className={`goal-fill ${evaluation.actual >= 0 ? 'positive' : 'negative'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="projection-note goal-plan-pct">
                {progressPct.toFixed(1)}% · {t.paceDaily}: {formatBalance(evaluation.paceDaily)}
              </p>
            </>
          )}
        </section>

        <section className="panel">
          <h3>{t.formTitle}</h3>
          <div className="journal-form-grid">
            <label className="span-2">
              {t.name}
              <input
                value={draft.name}
                placeholder={t.namePlaceholder}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <label>
              {t.dailyAmount}
              <input
                type="number"
                min={0}
                step="1"
                value={draft.dailyAmount || ''}
                onChange={(e) => patch({ dailyAmount: Number(e.target.value) })}
              />
            </label>
            <label>
              {t.totalGoal}
              <input
                type="number"
                min={0}
                step="1"
                placeholder={t.totalPlaceholder}
                value={draft.totalGoal ?? ''}
                onChange={(e) => patch({ totalGoal: optionalNumber(e.target.value) })}
              />
            </label>
            <label>
              {t.startDate}
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => patch({ startDate: e.target.value })}
              />
            </label>
            <label>
              {t.endDate}
              <input type="date" value={draft.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
            </label>
            <label className="span-2 goal-plan-check">
              <input
                type="checkbox"
                checked={draft.weekdaysOnly}
                onChange={(e) => patch({ weekdaysOnly: e.target.checked })}
              />
              <span>{t.weekdaysOnly}</span>
            </label>
          </div>
          <p className="projection-note">{t.totalHint}</p>

          <h3 className="goal-plan-subhead">{t.strategyTitle}</h3>
          <div className="journal-form-grid">
            <label className="span-2 goal-plan-check">
              <input
                type="checkbox"
                checked={draft.stopAtDailyTarget}
                onChange={(e) => patch({ stopAtDailyTarget: e.target.checked })}
              />
              <span>{t.stopAtDaily}</span>
            </label>
            <label>
              {t.maxDailyLoss}
              <input
                type="number"
                min={0}
                step="1"
                value={draft.maxDailyLoss ?? ''}
                onChange={(e) => patch({ maxDailyLoss: optionalNumber(e.target.value) })}
              />
            </label>
            <label>
              {t.maxTrades}
              <input
                type="number"
                min={1}
                step="1"
                value={draft.maxTradesPerDay ?? ''}
                onChange={(e) => patch({ maxTradesPerDay: optionalNumber(e.target.value) })}
              />
            </label>
            <label>
              {t.riskPerTrade}
              <input
                type="number"
                min={0}
                step="0.1"
                value={draft.riskPerTradePct ?? ''}
                onChange={(e) => patch({ riskPerTradePct: optionalNumber(e.target.value) })}
              />
            </label>
            <label className="span-2">
              {t.strategy}
              <textarea
                rows={4}
                placeholder={t.strategyPlaceholder}
                value={draft.strategy}
                onChange={(e) => patch({ strategy: e.target.value })}
              />
            </label>
          </div>

          <div className="settings-actions">
            <button type="button" className="btn-primary" onClick={save} disabled={!!evaluation.issue}>
              {t.save}
            </button>
            <button type="button" className="btn-ghost-sm" onClick={remove}>
              {t.delete}
            </button>
            {dirty && !evaluation.issue && <span className="projection-note">{t.unsaved}</span>}
            {saved && !dirty && <span className="projection-note">{t.savedState}</span>}
          </div>
        </section>
      </div>

      {!evaluation.issue && evaluation.months.length > 0 && (
        <section className="panel">
          <h3>{t.monthsTitle}</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.month}</th>
                  <th>{t.monthDays}</th>
                  <th>{t.monthTarget}</th>
                  <th>{t.monthActual}</th>
                  <th>{t.monthLeft}</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.months.map((month) => {
                  const left = month.target - month.actual
                  return (
                    <tr key={month.key}>
                      <td>{monthLabel(month.key)}</td>
                      <td>{month.tradingDays}</td>
                      <td>{formatBalance(month.target)}</td>
                      <td className={pnlClass(month.actual)}>{formatMoney(month.actual)}</td>
                      <td>{left <= 0.005 ? t.covered : formatBalance(left)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!evaluation.issue && (
        <section className="panel">
          <h3>{t.rulesTitle}</h3>
          {draft.strategy.trim() && <p className="goal-plan-strategy">{draft.strategy.trim()}</p>}
          {rules.length > 0 ? (
            <ul className="goal-plan-rules">
              {rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          ) : (
            <p className="projection-note">{t.ruleNone}</p>
          )}
        </section>
      )}
    </div>
  )
}
