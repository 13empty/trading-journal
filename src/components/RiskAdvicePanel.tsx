import type { RiskAdvice, RiskAdviceReasonId } from '../lib/riskAdvice'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { suggestedRiskAmount } from '../lib/riskAdvice'
import type { Translations } from '../i18n/types'

interface Props {
  advice: RiskAdvice
  balance: number
  t: Translations['riskAdvice']
  compact?: boolean
}

const ACTION_CLASS: Record<RiskAdvice['action'], string> = {
  increase: 'positive',
  hold: 'neutral',
  decrease: 'negative',
  insufficient: 'muted',
}

const REASON_KEY: Record<RiskAdviceReasonId, keyof Translations['riskAdvice']> = {
  insufficient_weeks: 'reasonInsufficientWeeks',
  insufficient_trades: 'reasonInsufficientTrades',
  positive_expectancy: 'reasonPositiveExpectancy',
  negative_expectancy: 'reasonNegativeExpectancy',
  profit_factor_strong: 'reasonProfitFactorStrong',
  profit_factor_weak: 'reasonProfitFactorWeak',
  drawdown_elevated: 'reasonDrawdownElevated',
  drawdown_severe: 'reasonDrawdownSevere',
  weekly_avg_positive: 'reasonWeeklyAvgPositive',
  weekly_avg_negative: 'reasonWeeklyAvgNegative',
  recent_weeks_weak: 'reasonRecentWeeksWeak',
  recent_weeks_strong: 'reasonRecentWeeksStrong',
  loss_streak_weeks: 'reasonLossStreakWeeks',
  stable_edge: 'reasonStableEdge',
}

const ACTION_KEY: Record<RiskAdvice['action'], keyof Translations['riskAdvice']> = {
  increase: 'actionIncrease',
  hold: 'actionHold',
  decrease: 'actionDecrease',
  insufficient: 'actionInsufficient',
}

export function RiskAdvicePanel({ advice, balance, t, compact = false }: Props) {
  const { weekly, action, currentRiskPct, suggestedRiskPct } = advice
  const riskAmount = suggestedRiskAmount(balance, suggestedRiskPct)

  if (weekly.weeksSampled === 0 && action !== 'insufficient') return null

  return (
    <section
      className={`panel risk-advice-panel risk-advice-${action}${compact ? ' compact' : ''}`}
      aria-label={t.title}
    >
      {!compact && (
        <>
          <h3>{t.title}</h3>
          <p className="risk-advice-sub">{t.subtitle}</p>
        </>
      )}

      <div className="risk-advice-grid">
        <div className="risk-advice-stat">
          <span className="label">{t.avgWeeklyPnl}</span>
          <span className={`val ${pnlClass(weekly.avgWeeklyPnl)}`}>
            {weekly.weeksSampled > 0 ? formatMoney(weekly.avgWeeklyPnl) : '—'}
          </span>
          {weekly.weeksSampled > 0 && (
            <span className="hint">
              {t.weeksSampled.replace('{count}', String(weekly.weeksSampled))}
              {' · '}
              {t.greenRedWeeks
                .replace('{green}', String(weekly.greenWeeks))
                .replace('{red}', String(weekly.redWeeks))}
            </span>
          )}
        </div>

        <div className="risk-advice-stat">
          <span className="label">{t.recentWeeklyAvg}</span>
          <span className={`val ${pnlClass(weekly.recentAvgWeeklyPnl)}`}>
            {weekly.weeksSampled > 0 ? formatMoney(weekly.recentAvgWeeklyPnl) : '—'}
          </span>
          <span className="hint">{t.recentWeeklyHint}</span>
        </div>
      </div>

      <div className={`risk-advice-verdict risk-verdict-${ACTION_CLASS[action]}`}>
        <span className="risk-advice-verdict-label">{t.recommendation}</span>
        <strong>{t[ACTION_KEY[action]]}</strong>
      </div>

      {action !== 'insufficient' && (
        <div className="risk-advice-risk-row">
          <div>
            <span className="label">{t.currentRisk}</span>
            <span className="val">
              {currentRiskPct != null ? `${currentRiskPct.toFixed(2)}%` : t.riskUnknown}
            </span>
          </div>
          <div>
            <span className="label">{t.suggestedRisk}</span>
            <span className="val">{suggestedRiskPct.toFixed(2)}%</span>
            {balance > 0 && (
              <span className="hint">
                {t.suggestedRiskAmount.replace('{amount}', formatMoney(riskAmount))}
              </span>
            )}
          </div>
        </div>
      )}

      {action === 'insufficient' && (
        <p className="risk-advice-note">{t.needMoreData}</p>
      )}

      {advice.reasons.length > 0 && (
        <ul className="risk-advice-reasons">
          {advice.reasons.map((id) => (
            <li key={id}>{t[REASON_KEY[id]]}</li>
          ))}
        </ul>
      )}

      <p className="risk-advice-disclaimer">{t.disclaimer}</p>
    </section>
  )
}
