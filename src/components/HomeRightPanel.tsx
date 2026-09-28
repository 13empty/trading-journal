import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { GoalPlan } from '../types/goalPlan'
import { DayGoalProgress } from './DayGoalProgress'
import type { EquityPoint, ThresholdRuleState } from '../types/journal'
import type { ProfitGoalState } from '../lib/profitGoals'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { formatDisplayDate } from '../lib/dateDisplay'
import { parseLocalDateKey } from '../lib/mt5Date'
import type { Translations } from '../i18n/types'
import { RiskRulesSummary } from './OptionsProgress'

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
  dayMap: Map<string, DayActivity>
  profitGoals: ProfitGoalState[]
  goalPlans?: GoalPlan[]
  tPlan?: Translations['goalPlan']
  thresholdRules: ThresholdRuleState[]
  showGoals: boolean
  showRules: boolean
  tHero: Translations['dayHero']
  tGoals: Translations['profitGoals']
  tThresholds: Translations['thresholds']
  goalsTitle: string
  rulesTitle: string
}

/** Calendar side: which day is selected, plus month goals and rules. The trade list lives in Diario. */
export function HomeRightPanel({
  selectedDate,
  selectedDay,
  dateFormat,
  dateLocale,
  dayMap,
  profitGoals,
  goalPlans,
  tPlan,
  thresholdRules,
  showRules,
  tGoals,
  tThresholds,
  rulesTitle,
}: Props) {
  const showRulesBlock = showRules && thresholdRules.some((r) => r.status !== 'off')
  const pnl = selectedDay?.pnl ?? 0

  return (
    <div className="home-right-panel" data-sections={showRulesBlock ? '3' : '2'}>
      <div className="home-day-line">
        <span className="home-day-line-date">
          {formatDisplayDate(parseLocalDateKey(selectedDate), dateFormat, dateLocale)}
        </span>
        <span className={`home-day-line-pnl ${pnlClass(pnl)}`}>{formatMoney(pnl)}</span>
      </div>

      <DayGoalProgress
        goals={profitGoals}
        plans={goalPlans}
        dayMap={dayMap}
        selectedDate={selectedDate}
        t={tGoals}
        tPlan={tPlan}
      />

      {showRulesBlock && (
        <section className="panel home-progress-section home-rules-section">
          <h3>{rulesTitle}</h3>
          <RiskRulesSummary rules={thresholdRules} t={tThresholds} />
        </section>
      )}
    </div>
  )
}
