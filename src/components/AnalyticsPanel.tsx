import { startOfWeek, format } from 'date-fns'
import type { Locale } from 'date-fns'
import { useMemo, useState } from 'react'
import type { AccountSummary, AppSettings, DayActivity } from '../types/account'
import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import {
  buildEquityCurve,
  balanceBeforeByDate,
  compareMonths,
  computeAdvancedMetrics,
  computeDrawdown,
  computeSessionStats,
  computeSetupComboStats,
  computeMistakeStats,
  computeStreaks,
  computeSymbolStats,
  effectiveRR,
  effectiveRiskPct,
  feesByDay,
  filterByAccount,
  formatDuration,
  goalAlert,
  netPnl,
  realizedR,
  resolveTradeSession,
  tradeHoldMinutes,
  tradeMetaKey,
  uniqueAccounts,
  weeklyPnl,
  monthlyPnl,
} from '../lib/analytics'
import { formatMoney, pnlClass, winRate } from '../lib/aggregations'
import { parseLocalDateKey } from '../lib/mt5Date'
import { analyzeRiskAdvice, computeWeeklyStats } from '../lib/riskAdvice'
import { computeExcursionStats } from '../lib/excursion'
import { RiskAdvicePanel } from './RiskAdvicePanel'
import { TradeSearchPanel } from './TradeSearchPanel'
import { AccountFinancePanel } from './AccountFinancePanel'
import { PeriodSummaryPanel } from './PeriodSummaryPanel'
import { buildReportData, exportMonthlyReport, refDateFromActivities } from '../lib/exportReport'
import { sortTradesRecentFirst } from '../lib/tradeSort'
import { EquityCurve } from './EquityCurve'

interface Props {
  trades: Trade[]
  activities: DayActivity[]
  settings: AppSettings
  onSettingsChange?: (s: AppSettings) => void
  metaMap: Record<string, TradeMeta>
  selectedDate: string
  selectedDayPnl: number
  t: Translations['analytics']
  tJournal: Translations['journal']
  tRiskAdvice: Translations['riskAdvice']
  tFinance: Translations['finance']
  tSearch: Translations['search']
  tPeriod: Translations['period']
  sideLabels: Translations['side']
  displayAccount: AccountSummary
  displayBalance: number
  mismatchHint?: string
  onSelectDate: (date: string) => void
  dateLocale: Locale
}

const SESSION_LABEL: Record<string, keyof Translations['analytics']> = {
  asia: 'sessionAsia',
  london: 'sessionLondon',
  ny: 'sessionNy',
  other: 'sessionOther',
}

export function AnalyticsPanel({
  trades,
  activities,
  settings,
  metaMap,
  selectedDate,
  selectedDayPnl,
  t,
  tJournal,
  tRiskAdvice,
  tFinance,
  tSearch,
  tPeriod,
  sideLabels,
  displayAccount,
  displayBalance,
  mismatchHint,
  onSelectDate,
  dateLocale,
}: Props) {
  const accounts = useMemo(
    () => uniqueAccounts(trades, settings.knownAccounts ?? []),
    [trades, settings.knownAccounts],
  )
  const [accountFilter, setAccountFilter] = useState<string>('')

  const filteredTrades = useMemo(
    () => filterByAccount(trades, accountFilter || null),
    [trades, accountFilter],
  )

  const recentTrades = useMemo(
    () => sortTradesRecentFirst(filteredTrades).slice(0, 50),
    [filteredTrades],
  )

  const balanceByDate = useMemo(
    () => new Map(activities.map((a) => [a.date, a.endBalance])),
    [activities],
  )
  const balanceBeforeMap = useMemo(
    () => balanceBeforeByDate(activities, settings.initialBalance ?? 0),
    [activities, settings.initialBalance],
  )

  const curve = useMemo(() => buildEquityCurve(activities), [activities])
  const drawdown = useMemo(() => computeDrawdown(curve), [curve])
  const symbols = useMemo(() => computeSymbolStats(filteredTrades), [filteredTrades])
  const sessions = useMemo(
    () => computeSessionStats(filteredTrades, metaMap),
    [filteredTrades, metaMap],
  )
  const setupCombos = useMemo(
    () => computeSetupComboStats(filteredTrades, metaMap, balanceBeforeMap),
    [filteredTrades, metaMap, balanceBeforeMap],
  )
  const mistakeStats = useMemo(
    () => computeMistakeStats(filteredTrades, metaMap, 5),
    [filteredTrades, metaMap],
  )
  const excursionStats = useMemo(
    () => computeExcursionStats(filteredTrades, metaMap),
    [filteredTrades, metaMap],
  )
  const streaks = useMemo(() => computeStreaks(filteredTrades, activities), [filteredTrades, activities])
  const metrics = useMemo(
    () => computeAdvancedMetrics(filteredTrades, metaMap, balanceBeforeMap),
    [filteredTrades, metaMap, balanceBeforeMap],
  )
  const compare = useMemo(
    () => compareMonths(filteredTrades, refDateFromActivities(activities), dateLocale),
    [filteredTrades, activities, dateLocale],
  )

  const refDate = selectedDate ? parseLocalDateKey(selectedDate) : new Date()
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 })
  const weekPnl = weeklyPnl(activities, weekStart)
  const monthPnlValue = monthlyPnl(activities, refDate)
  const balance = displayBalance > 0
    ? displayBalance
    : settings.brokerBalance ?? activities[activities.length - 1]?.endBalance ?? 0
  const riskAdvice = useMemo(() => {
    const weekly = computeWeeklyStats(activities, selectedDate)
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    return analyzeRiskAdvice({
      activities,
      asOfDate: selectedDate,
      todayDate: todayKey,
      weekly,
      metrics,
      drawdown,
      tradeCount: filteredTrades.length,
      balance,
      dailyLossLimit: settings.dailyLossLimit,
    })
  }, [
    activities,
    selectedDate,
    metrics,
    drawdown,
    filteredTrades.length,
    balance,
    settings.dailyLossLimit,
  ])
  // Loss-limit banner can use live PnL; profit-goal bars use closed only
  const alertKey = goalAlert(selectedDayPnl, settings)
  const selectedClosedPnl =
    activities.find((a) => a.date === selectedDate)?.pnl ??
    selectedDayPnl

  const pfLabel =
    metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)

  const handleExport = () => {
    const data = buildReportData(filteredTrades, activities, settings, {
      metrics,
      drawdown,
      streaks,
      symbols,
      compare,
    })
    exportMonthlyReport(data, dateLocale, {
      reportTitle: t.exportTitle,
      trades: t.trades,
      closedPnl: t.closedPnl,
      winRate: t.winRate,
      expectancy: t.expectancy,
      profitFactor: t.profitFactor,
      maxDrawdown: t.maxDrawdown,
      avgRR: t.avgRR,
      streaks: t.streaksTitle,
      maxWinStreak: t.maxWinStreak,
      maxLossStreak: t.maxLossStreak,
      maxGreenDays: t.maxGreenDays,
      maxRedDays: t.maxRedDays,
      compare: t.compareTitle,
      previous: t.previous,
      current: t.current,
      bestWorst: t.bestWorst,
      best: t.bestDay,
      worst: t.worstDay,
      bySymbol: t.bySymbol,
      symbol: t.symbol,
      noData: t.noData,
    })
  }

  return (
    <div className="analytics-panel">
      {alertKey && (
        <div className="goal-alert" role="alert">
          {t.lossLimitHit.replace('{limit}', String(settings.dailyLossLimit))}
        </div>
      )}

      <div className="analytics-toolbar">
        {accounts.length > 1 && (
          <label className="inline-label">
            {t.accountFilter}
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              <option value="">{t.allAccounts}</option>
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn-secondary" onClick={handleExport}>
          {t.exportPdf}
        </button>
      </div>

      <TradeSearchPanel
        trades={filteredTrades}
        metaMap={metaMap}
        t={tSearch}
        sideLabels={sideLabels}
        onSelectDate={onSelectDate}
      />

      <section className="panel analytics-section">
        <h3>{t.kpiTitle}</h3>
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="label">{t.expectancy}</span>
            <span className={`val ${pnlClass(metrics.expectancy)}`}>{formatMoney(metrics.expectancy)}</span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.profitFactor}</span>
            <span className="val">{pfLabel}</span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.maxDrawdown}</span>
            <span className="val negative">
              −${drawdown.maxDrawdown.toFixed(2)} ({drawdown.maxDrawdownPct.toFixed(1)}%)
            </span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.winRate}</span>
            <span className="val">{winRate(filteredTrades).toFixed(1)}%</span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.avgRR}</span>
            <span className="val">{metrics.avgRR > 0 ? metrics.avgRR.toFixed(2) : '—'}</span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.avgRisk}</span>
            <span className="val">
              {metrics.avgRiskPct > 0 ? `${metrics.avgRiskPct.toFixed(2)}%` : '—'}
            </span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.avgWin}</span>
            <span className="val positive">{formatMoney(metrics.avgWin)}</span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.avgLoss}</span>
            <span className="val negative">{formatMoney(-metrics.avgLoss)}</span>
          </div>
          <div className="kpi-card">
            <span className="label">{t.avgHold}</span>
            <span className="val">{formatDuration(metrics.avgHoldMinutes)}</span>
          </div>
        </div>
      </section>

      <section className="panel analytics-section">
        <h3>{t.equityCurve}</h3>
        <EquityCurve points={curve} />
        <p className="hint-inline">
          {t.peak}: ${drawdown.peakBalance.toFixed(2)} ({drawdown.peakDate || '—'}) · {t.trough}: $
          {drawdown.troughBalance.toFixed(2)} ({drawdown.troughDate || '—'})
        </p>
      </section>

      <section className="panel analytics-section">
        <h3>{t.goalsTitle}</h3>
        <p className="hint-inline">{t.goalsEditInOptions}</p>
        <div className="goal-progress">
          {settings.dailyProfitGoal != null && selectedDate && (
            <div className="goal-bar-wrap">
              <span>
                {t.todayGoal}: {formatMoney(selectedClosedPnl)} /{' '}
                {formatMoney(settings.dailyProfitGoal)}
                {selectedClosedPnl >= settings.dailyProfitGoal &&
                settings.showGoalReachedMessage !== false
                  ? ` · ${t.goalReached}`
                  : ''}
              </span>
              <div className="goal-bar">
                <div
                  className={`goal-fill ${pnlClass(selectedClosedPnl)}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (selectedClosedPnl / settings.dailyProfitGoal) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
          {settings.weeklyProfitGoal != null && (
            <div className="goal-bar-wrap">
              <span>
                {t.weekGoal}: {formatMoney(weekPnl)} / {formatMoney(settings.weeklyProfitGoal)}
                {weekPnl >= settings.weeklyProfitGoal && settings.showGoalReachedMessage !== false
                  ? ` · ${t.goalReached}`
                  : ''}
              </span>
              <div className="goal-bar">
                <div
                  className={`goal-fill ${pnlClass(weekPnl)}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (weekPnl / settings.weeklyProfitGoal) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
          {settings.monthlyProfitGoal != null && (
            <div className="goal-bar-wrap">
              <span>
                {t.monthGoal}: {formatMoney(monthPnlValue)} / {formatMoney(settings.monthlyProfitGoal)}
                {monthPnlValue >= settings.monthlyProfitGoal && settings.showGoalReachedMessage !== false
                  ? ` · ${t.goalReached}`
                  : ''}
              </span>
              <div className="goal-bar">
                <div
                  className={`goal-fill ${pnlClass(monthPnlValue)}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (monthPnlValue / settings.monthlyProfitGoal) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {filteredTrades.length > 0 && (
        <RiskAdvicePanel
          advice={riskAdvice}
          balance={balance}
          t={tRiskAdvice}
        />
      )}

      <section className="panel analytics-section">
        <h3>{t.streaksTitle}</h3>
        <div className="streak-grid">
          <div>
            <span className="label">{t.currentWinStreak}</span>
            <span className="val">{streaks.currentWin}</span>
          </div>
          <div>
            <span className="label">{t.currentLossStreak}</span>
            <span className="val">{streaks.currentLoss}</span>
          </div>
          <div>
            <span className="label">{t.maxWinStreak}</span>
            <span className="val">{streaks.maxWin}</span>
          </div>
          <div>
            <span className="label">{t.maxLossStreak}</span>
            <span className="val">{streaks.maxLoss}</span>
          </div>
          <div>
            <span className="label">{t.greenDaysStreak}</span>
            <span className="val">{streaks.currentGreenDays}</span>
          </div>
          <div>
            <span className="label">{t.redDaysStreak}</span>
            <span className="val">{streaks.currentRedDays}</span>
          </div>
        </div>
      </section>

      <section className="panel analytics-section">
        <h3>{t.compareTitle}</h3>
        <p className="compare-line">{compare.label}</p>
        <table className="data-table compact">
          <thead>
            <tr>
              <th></th>
              <th>{t.trades}</th>
              <th>{t.winRate}</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t.previous}</td>
              <td>{compare.previous.trades}</td>
              <td>{compare.previous.winRate.toFixed(1)}%</td>
              <td className={pnlClass(compare.previous.pnl)}>{formatMoney(compare.previous.pnl)}</td>
            </tr>
            <tr>
              <td>{t.current}</td>
              <td>{compare.current.trades}</td>
              <td>{compare.current.winRate.toFixed(1)}%</td>
              <td className={pnlClass(compare.current.pnl)}>{formatMoney(compare.current.pnl)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel analytics-section">
        <h3>{t.bySymbol}</h3>
        {symbols.length === 0 ? (
          <p className="empty">{t.noData}</p>
        ) : (
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.symbol}</th>
                <th>{t.trades}</th>
                <th>{t.winRate}</th>
                <th>{t.avgPnl}</th>
                <th>Swap</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((s) => (
                <tr key={s.symbol}>
                  <td>{s.symbol}</td>
                  <td>{s.trades}</td>
                  <td>{s.winRate.toFixed(1)}%</td>
                  <td className={pnlClass(s.avgPnl)}>{formatMoney(s.avgPnl)}</td>
                  <td className="negative">{s.swap > 0 ? `−$${s.swap.toFixed(2)}` : '—'}</td>
                  <td className={pnlClass(s.pnl)}>{formatMoney(s.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {sessions.length > 0 && (
        <section className="panel analytics-section">
          <h3>{t.bySession}</h3>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.session}</th>
                <th>{t.trades}</th>
                <th>{t.winRate}</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.session}>
                  <td>{t[SESSION_LABEL[s.session]]}</td>
                  <td>{s.trades}</td>
                  <td>{s.winRate.toFixed(1)}%</td>
                  <td className={pnlClass(s.pnl)}>{formatMoney(s.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel analytics-section span-2">
        <h3>{t.setupAnalytics}</h3>
        <p className="hint-inline">{t.setupAnalyticsHint}</p>
        {setupCombos.length === 0 ? (
          <p className="empty">{t.setupAnalyticsEmpty}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>{t.setupCombo}</th>
                  <th>{t.trades}</th>
                  <th>{t.winRate}</th>
                  <th>{t.expectancyR}</th>
                  <th>{t.avgPnl}</th>
                  <th>PnL</th>
                </tr>
              </thead>
              <tbody>
                {setupCombos.map((c) => {
                  const setupKey = `setup_${c.setup}` as keyof Translations['journal']
                  const setupName =
                    typeof tJournal[setupKey] === 'string'
                      ? (tJournal[setupKey] as string)
                      : c.setup
                  const combo = `${setupName} + ${t[SESSION_LABEL[c.session]]} + ${sideLabels[c.side]}`
                  const rText =
                    c.expectancyR != null
                      ? `${c.expectancyR >= 0 ? '+' : ''}${c.expectancyR.toFixed(2)}R`
                      : '—'
                  return (
                    <tr key={`${c.setup}-${c.session}-${c.side}`}>
                      <td>
                        <div className="setup-combo-cell">
                          <strong>{combo}</strong>
                          <span className="hint-inline">
                            {t.winRate}: {c.winRate.toFixed(0)}%
                            {c.expectancyR != null
                              ? ` → ${rText} ${t.expectancyRShort}`
                              : ''}
                          </span>
                        </div>
                      </td>
                      <td>{c.trades}</td>
                      <td>{c.winRate.toFixed(1)}%</td>
                      <td className={c.expectancyR != null ? pnlClass(c.expectancyR) : undefined}>
                        {rText}
                      </td>
                      <td className={pnlClass(c.avgPnl)}>{formatMoney(c.avgPnl)}</td>
                      <td className={pnlClass(c.pnl)}>{formatMoney(c.pnl)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel analytics-section">
        <h3>{t.mistakeTracker}</h3>
        <p className="hint-inline">{t.mistakeTrackerHint}</p>
        {mistakeStats.length === 0 ? (
          <p className="empty">{t.mistakeTrackerEmpty}</p>
        ) : (
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.mistakeError}</th>
                <th>{t.trades}</th>
                <th>P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {mistakeStats.map((m) => {
                const mk = `mistake_${m.mistake}` as keyof Translations['journal']
                const name =
                  typeof tJournal[mk] === 'string' ? (tJournal[mk] as string) : m.mistake
                return (
                  <tr key={m.mistake}>
                    <td>{name}</td>
                    <td>{m.trades}</td>
                    <td className={pnlClass(m.pnl)}>{formatMoney(m.pnl)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel analytics-section span-2">
        <h3>{t.excursionTitle}</h3>
        <p className="hint-inline">{t.excursionHintAnalytics}</p>
        {excursionStats.sampleCount === 0 ? (
          <p className="empty">{t.excursionEmpty}</p>
        ) : (
          <>
            <div className="streak-grid excursion-kpis">
              <div>
                <span className="label">{t.excursionAvgMfe}</span>
                <span className="val">
                  {excursionStats.avgMfeR != null
                    ? `+${excursionStats.avgMfeR.toFixed(2)}R`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="label">{t.excursionAvgMae}</span>
                <span className="val">
                  {excursionStats.avgMaeR != null
                    ? `−${excursionStats.avgMaeR.toFixed(2)}R`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="label">{t.excursionLeftPct}</span>
                <span className="val">
                  {excursionStats.leftOnTablePct.toFixed(0)}%
                  <span className="hint-inline">
                    {' '}
                    ({excursionStats.leftOnTableCount}/{excursionStats.sampleCount})
                  </span>
                </span>
              </div>
              <div>
                <span className="label">{t.excursionAvgLeft}</span>
                <span className="val">
                  {excursionStats.avgLeftOnTableR != null
                    ? `~${excursionStats.avgLeftOnTableR.toFixed(1)}R`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="label">{t.excursionSlTightPct}</span>
                <span className="val">
                  {excursionStats.slTightPct.toFixed(0)}%
                  <span className="hint-inline">
                    {' '}
                    ({excursionStats.slTightCount}/{excursionStats.sampleCount})
                  </span>
                </span>
              </div>
            </div>
            {excursionStats.bySetup.length > 0 ? (
              <>
                <h4 className="sub-head">{t.excursionBySetup}</h4>
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>{tJournal.setupType}</th>
                      <th>{t.trades}</th>
                      <th>{t.excursionAvgMfe}</th>
                      <th>{t.excursionAvgClosed}</th>
                      <th>{t.excursionAvgLeft}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excursionStats.bySetup.map((row) => {
                      const sk = `setup_${row.setup}` as keyof Translations['journal']
                      const name =
                        typeof tJournal[sk] === 'string'
                          ? (tJournal[sk] as string)
                          : row.setup
                      return (
                        <tr key={row.setup}>
                          <td>{name}</td>
                          <td>{row.trades}</td>
                          <td>+{row.avgMfeR.toFixed(2)}R</td>
                          <td className={pnlClass(row.avgClosedR)}>
                            {row.avgClosedR >= 0 ? '+' : ''}
                            {row.avgClosedR.toFixed(2)}R
                          </td>
                          <td className="negative">~{row.avgLeftOnTableR.toFixed(1)}R</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            ) : null}
          </>
        )}
      </section>

      <section className="panel analytics-section span-2">
        <h3>{t.tradeAnalytics}</h3>
        <p className="hint-inline">{tJournal.tradeAnalyticsHint}</p>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{t.symbol}</th>
                <th>{tJournal.setupType}</th>
                <th>PnL</th>
                <th>{tJournal.resultR}</th>
                <th>{t.duration}</th>
                <th>{t.session}</th>
                <th>R:R</th>
                <th>{t.risk}</th>
                <th>{tJournal.tags}</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => {
                const key = tradeMetaKey(trade)
                const meta = metaMap[key]
                const bal = balanceBeforeMap.get(trade.date) ?? balanceByDate.get(trade.date) ?? 0
                const rr = effectiveRR(trade, meta)
                const rp = effectiveRiskPct(trade, meta, bal)
                const sess = resolveTradeSession(trade, meta)
                const rReal = realizedR(trade, meta)
                const setupKey = meta?.setup
                  ? (`setup_${meta.setup}` as keyof Translations['journal'])
                  : null
                const setupName =
                  setupKey && typeof tJournal[setupKey] === 'string'
                    ? (tJournal[setupKey] as string)
                    : meta?.setup || '—'
                return (
                  <tr key={trade.id}>
                    <td>{trade.date}</td>
                    <td>{trade.symbol}</td>
                    <td>
                      {setupName}
                      {meta?.setupQuality ? ` · ${meta.setupQuality}` : ''}
                      {meta?.timeframe ? ` · ${meta.timeframe}` : ''}
                    </td>
                    <td className={pnlClass(netPnl(trade))}>{formatMoney(netPnl(trade))}</td>
                    <td className={rReal != null ? pnlClass(rReal) : undefined}>
                      {rReal != null ? `${rReal >= 0 ? '+' : ''}${rReal.toFixed(2)}R` : '—'}
                    </td>
                    <td>{formatDuration(tradeHoldMinutes(trade))}</td>
                    <td>{sess ? t[SESSION_LABEL[sess]] : '—'}</td>
                    <td>{rr != null ? rr.toFixed(2) : '—'}</td>
                    <td>{rp != null ? `${rp.toFixed(2)}%` : '—'}</td>
                    <td className="tag-cell">{(meta?.tags ?? []).join(', ') || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel analytics-section">
        <h3>{t.feesByDay}</h3>
        <table className="data-table compact">
          <thead>
            <tr>
              <th>{t.date}</th>
              <th>{t.commission}</th>
              <th>Swap</th>
            </tr>
          </thead>
          <tbody>
            {[...feesByDay(filteredTrades).entries()]
              .sort((a, b) => b[0].localeCompare(a[0]))
              .slice(0, 14)
              .map(([date, v]) => (
                <tr key={date}>
                  <td>{date}</td>
                  <td className="negative">{v.fees > 0 ? `−$${v.fees.toFixed(2)}` : '—'}</td>
                  <td className="negative">{v.swap > 0 ? `−$${v.swap.toFixed(2)}` : '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <PeriodSummaryPanel trades={filteredTrades} dateLocale={dateLocale} t={tPeriod} />

      <AccountFinancePanel
        account={displayAccount}
        t={tFinance}
        mismatchHint={mismatchHint}
      />
    </div>
  )
}
