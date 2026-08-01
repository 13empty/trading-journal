import type { RiskAdvice, RiskAdviceReasonId } from '../lib/riskAdvice'
import { formatMoney, formatBalance, pnlClass } from '../lib/aggregations'
import { formatCompactPercent } from '../lib/calendarPnl'
import type { Translations } from '../i18n/types'
import { interpolate } from '../i18n'

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
  protect: 'positive',
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
  daily_gain_spike: 'reasonDailyGainSpike',
  daily_avg_positive: 'reasonDailyAvgPositive',
  daily_swing_elevated: 'reasonDailySwingElevated',
  account_growing: 'reasonAccountGrowing',
}

const ACTION_KEY: Record<RiskAdvice['action'], keyof Translations['riskAdvice']> = {
  increase: 'actionIncrease',
  hold: 'actionHold',
  decrease: 'actionDecrease',
  protect: 'actionProtect',
  insufficient: 'actionInsufficient',
}

function CurrentRiskBlock({
  advice,
  t,
}: {
  advice: RiskAdvice
  t: Translations['riskAdvice']
}) {
  const tf = interpolate
  const cr = advice.currentRisk

  if (cr.source === 'none' && cr.dailyLimitPct == null) {
    return (
      <div className="risk-current-block">
        <span className="label">{t.currentRisk}</span>
        <p className="risk-current-empty">{t.riskUnknown}</p>
      </div>
    )
  }

  const sourceLabel =
    cr.source === 'journal'
      ? tf(t.riskSourceJournal, { count: cr.journalTrades })
      : cr.source === 'journal_amount'
        ? tf(t.riskSourceJournalAmount, { count: cr.journalAmountTrades })
        : cr.source === 'inferred'
          ? t.riskSourceInferred
          : cr.source === 'implied_wins'
            ? t.riskSourceImpliedWins
            : cr.source === 'daily_swing'
              ? t.riskSourceDailySwing
              : cr.source === 'today_session'
                ? t.riskSourceTodaySession
                : cr.source === 'daily_limit'
                  ? t.riskSourceDailyLimit
                  : null

  return (
    <div className="risk-current-block">
      <span className="label">{t.currentRisk}</span>
      {cr.pct != null && (
        <strong className="risk-current-main">
          {cr.pct.toFixed(2)}%
          {sourceLabel ? <span className="risk-current-source"> · {sourceLabel}</span> : null}
        </strong>
      )}
      {cr.amount != null && (
        <span className="hint">
          {tf(t.currentRiskAmount, { amount: formatBalance(cr.amount) })}
        </span>
      )}
      {cr.source === 'inferred' && (
        <span className="hint">{t.riskInferredHint}</span>
      )}
      {cr.source === 'implied_wins' && (
        <span className="hint">{t.riskImpliedWinsHint}</span>
      )}
      {cr.source === 'daily_swing' && (
        <span className="hint">{t.riskDailySwingHint}</span>
      )}
      {cr.source === 'today_session' && (
        <span className="hint">{t.riskTodaySessionHint}</span>
      )}
      {cr.source === 'daily_limit' && (
        <span className="hint">{t.riskDailyLimitPerTradeHint}</span>
      )}
      {cr.journalTrades > 0 && cr.source !== 'journal' && cr.source !== 'journal_amount' && (
        <span className="hint">
          {tf(t.riskJournalPartial, { count: cr.journalTrades, pct: cr.journalPct?.toFixed(2) ?? '—' })}
        </span>
      )}
      {cr.inferredPct != null && cr.source !== 'inferred' && (
        <span className="hint">
          {tf(t.riskAltLoss, { pct: cr.inferredPct.toFixed(2) })}
        </span>
      )}
      {cr.dailyLimitPct != null && cr.dailyLimitAmount != null && (
        <span className="hint risk-daily-limit">
          {tf(t.riskDailyLimit, {
            pct: cr.dailyLimitPct.toFixed(2),
            amount: formatMoney(cr.dailyLimitAmount),
          })}
        </span>
      )}
    </div>
  )
}

function DailyPerformanceRow({
  daily,
  t,
}: {
  daily: RiskAdvice['daily']
  t: Translations['riskAdvice']
}) {
  const tf = interpolate

  return (
    <div className="risk-advice-grid risk-daily-grid">
      <div className="risk-advice-stat">
        <span className="label">{t.todayReturn}</span>
        {daily.todayPct != null ? (
          <>
            <span className={`val ${pnlClass(daily.todayPnl ?? 0)}`}>
              {formatCompactPercent(daily.todayPct)}
            </span>
            {daily.todayPnl != null && (
              <span className="hint">
                {formatMoney(daily.todayPnl)}
                {daily.todayTrades > 0
                  ? ` · ${tf(t.todayTrades, { count: daily.todayTrades })}`
                  : ''}
              </span>
            )}
          </>
        ) : (
          <span className="val muted">—</span>
        )}
      </div>

      <div className="risk-advice-stat">
        <span className="label">
          {tf(t.avgDailyReturn, { count: daily.activeDaysSampled })}
        </span>
        <span className={`val ${pnlClass(daily.avgDailyPnl)}`}>
          {daily.activeDaysSampled > 0 ? formatCompactPercent(daily.avgDailyPct) : '—'}
        </span>
        <span className="hint">
          {daily.activeDaysSampled > 0
            ? tf(t.avgDailyHint, {
                amount: formatMoney(daily.avgDailyPnl),
                swing: daily.avgAbsDailyPct.toFixed(2),
              })
            : t.avgDailyEmpty}
        </span>
      </div>

      {daily.weekToDatePct != null && (
        <div className="risk-advice-stat risk-week-stat">
          <span className="label">{t.weekToDateReturn}</span>
          <span className={`val ${pnlClass(daily.weekToDatePnl)}`}>
            {formatCompactPercent(daily.weekToDatePct)}
          </span>
          <span className="hint">{formatMoney(daily.weekToDatePnl)}</span>
        </div>
      )}
    </div>
  )
}

export function RiskAdvicePanel({ advice, balance, t, compact = false }: Props) {
  const tf = interpolate
  const { weekly, daily, action, suggestedRiskPct, suggestedRiskAmount: suggestedAmount, balanceUsed, conservativeRiskPct, conservativeRiskAmount } = advice
  const riskBalance = balanceUsed > 0 ? balanceUsed : balance

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

      <DailyPerformanceRow daily={daily} t={t} />

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
          <CurrentRiskBlock advice={advice} t={t} />
          <div className="risk-suggested-block">
            <span className="label">{t.suggestedRisk}</span>
            <span className="val">{suggestedRiskPct.toFixed(2)}%</span>
            {riskBalance > 0 && (
              <>
                <span className="hint">
                  {tf(t.suggestedRiskBalance, { balance: formatBalance(riskBalance) })}
                </span>
                <span className="hint">
                  {tf(t.suggestedRiskAmount, {
                    pct: suggestedRiskPct.toFixed(2),
                    balance: formatBalance(riskBalance),
                    amount: formatBalance(suggestedAmount),
                  })}
                </span>
                <span className="hint risk-conservative-ref">
                  {tf(t.conservativeRiskRef, {
                    pct: conservativeRiskPct.toFixed(0),
                    amount: formatBalance(conservativeRiskAmount),
                  })}
                </span>
              </>
            )}
            {(action === 'hold' || action === 'protect') && (
              <span className="hint">{t.suggestedRiskHoldHint}</span>
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
