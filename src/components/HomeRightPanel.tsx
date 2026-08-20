import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { EquityPoint, ThresholdRuleState } from '../types/journal'
import type { ProfitGoalState } from '../lib/profitGoals'
import { PROFIT_GOAL_LABEL_KEYS } from '../lib/profitGoals'
import { formatMoney, pnlClass } from '../lib/aggregations'
import type { Translations } from '../i18n/types'
import { DayHero } from './DayHero'
import { MonthlyGoalGauge, RiskRulesSummary } from './OptionsProgress'

interface Props {
  selectedDate: string
  selectedDay: DayActivity | undefined
  dayTradeCount: number
  dayWinRate: number
  displayBalance: number
  equityPoints: EquityPoint[]
  dateFormat: string
  dateLocale: Locale
  subtitle?: string
  profitGoals: ProfitGoalState[]
  thresholdRules: ThresholdRuleState[]
  showGoals: boolean
  showRules: boolean
  tHero: Translations['dayHero']
  tGoals: Translations['profitGoals']
  tThresholds: Translations['thresholds']
  goalsTitle: string
  rulesTitle: string
}

/** Home right column: PnL+equity, Metas, Reglas — share height evenly. */
export function HomeRightPanel({
  selectedDate,
  selectedDay,
  dayTradeCount,
  dayWinRate,
  displayBalance,
  equityPoints,
  dateFormat,
  dateLocale,
  subtitle,
  profitGoals,
  thresholdRules,
  showGoals,
  showRules,
  tHero,
  tGoals,
  tThresholds,
  goalsTitle,
  rulesTitle,
}: Props) {
  const activeGoals = showGoals ? profitGoals.filter((g) => g.status !== 'off') : []
  const monthlyGoal = activeGoals.find((g) => g.id === 'monthly')
  const showRulesBlock = showRules && thresholdRules.some((r) => r.status !== 'off')
  const sectionCount =
    1 + (activeGoals.length > 0 ? 1 : 0) + (showRulesBlock ? 1 : 0)

  return (
    <div
      className="home-right-panel"
      data-sections={sectionCount}
    >
      <DayHero
        selectedDate={selectedDate}
        selectedDay={selectedDay}
        dayTradeCount={dayTradeCount}
        dayWinRate={dayWinRate}
        displayBalance={displayBalance}
        equityPoints={equityPoints}
        dateFormat={dateFormat}
        dateLocale={dateLocale}
        subtitle={subtitle}
        showChart={false}
        showRecentSummary={false}
        t={tHero}
      />

      {activeGoals.length > 0 && (
        <section className="panel home-progress-section home-goals-section">
          <h3>{goalsTitle}</h3>
          <div className="home-goals-body">
            <div className="home-goals-list">
              {activeGoals.map((goal) => (
                <div key={goal.id} className={`home-goal-row home-goal-${goal.status}`}>
                  <div className="home-goal-row-head">
                    <span className="home-goal-name">
                      {tGoals[PROFIT_GOAL_LABEL_KEYS[goal.id]]}
                    </span>
                    <span className={`home-goal-pct ${pnlClass(goal.current)}`}>
                      {goal.pct.toFixed(0)}%
                    </span>
                  </div>
                  <span className={`home-goal-amt ${pnlClass(goal.current)}`}>
                    {formatMoney(goal.current)} / {formatMoney(goal.goal)}
                  </span>
                  <div className="goal-bar home-goal-bar">
                    <div
                      className={`goal-fill ${goal.status === 'reached' ? 'positive' : pnlClass(goal.current)}`}
                      style={{ width: `${Math.min(100, goal.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {monthlyGoal && (
              <MonthlyGoalGauge goal={monthlyGoal} label={tGoals.gaugeMonthly} />
            )}
          </div>
        </section>
      )}

      {showRulesBlock && (
        <section className="panel home-progress-section home-rules-section">
          <h3>{rulesTitle}</h3>
          <RiskRulesSummary rules={thresholdRules} t={tThresholds} />
        </section>
      )}
    </div>
  )
}
