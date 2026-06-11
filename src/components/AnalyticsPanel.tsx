import { startOfWeek } from 'date-fns'
import type { Locale } from 'date-fns'
import { useMemo, useState } from 'react'
import type { DayActivity } from '../types/account'
import type { AppSettings } from '../types/account'
import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import {
  buildEquityCurve,
  compareMonths,
  computeAdvancedMetrics,
  computeDrawdown,
  computeSessionStats,
  computeStreaks,
  computeSymbolStats,
  effectiveRR,
  effectiveRiskPct,
  feesByDay,
  filterByAccount,
  formatDuration,
  goalAlert,
  netPnl,
  tradeHoldMinutes,
  tradeMetaKey,
  tradeSession,
  uniqueAccounts,
  weeklyPnl,
} from '../lib/analytics'
import { formatMoney, pnlClass, winRate } from '../lib/aggregations'
import { buildReportData, exportMonthlyReport, refDateFromActivities } from '../lib/exportReport'
import { sortTradesRecentFirst } from '../lib/tradeSort'
import { EquityCurve } from './EquityCurve'

interface Props {
  trades: Trade[]
  activities: DayActivity[]
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  metaMap: Record<string, TradeMeta>
  selectedDate: string
  selectedDayPnl: number
  t: Translations['analytics']
  tJournal: Translations['journal']
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
  onSettingsChange,
  metaMap,
  selectedDate,
  selectedDayPnl,
  t,
  tJournal,
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

  const curve = useMemo(() => buildEquityCurve(activities), [activities])
  const drawdown = useMemo(() => computeDrawdown(curve), [curve])
  const symbols = useMemo(() => computeSymbolStats(filteredTrades), [filteredTrades])
  const sessions = useMemo(() => computeSessionStats(filteredTrades), [filteredTrades])
  const streaks = useMemo(() => computeStreaks(filteredTrades, activities), [filteredTrades, activities])
  const metrics = useMemo(
    () => computeAdvancedMetrics(filteredTrades, metaMap, balanceByDate),
    [filteredTrades, metaMap, balanceByDate],
  )
  const compare = useMemo(
    () => compareMonths(filteredTrades, refDateFromActivities(activities), dateLocale),
    [filteredTrades, activities, dateLocale],
  )

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekPnl = weeklyPnl(activities, weekStart)
  const alertKey = goalAlert(selectedDayPnl, settings)

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
        <div className="goals-grid">
          <label>
            {t.dailyProfitGoal}
            <input
              type="number"
              step="any"
              value={settings.dailyProfitGoal ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  dailyProfitGoal: parseFloat(e.target.value) || undefined,
                })
              }
            />
          </label>
          <label>
            {t.dailyLossLimit}
            <input
              type="number"
              step="any"
              value={settings.dailyLossLimit ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  dailyLossLimit: parseFloat(e.target.value) || undefined,
                })
              }
            />
          </label>
          <label>
            {t.weeklyProfitGoal}
            <input
              type="number"
              step="any"
              value={settings.weeklyProfitGoal ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  weeklyProfitGoal: parseFloat(e.target.value) || undefined,
                })
              }
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.alertOnLossLimit ?? false}
              onChange={(e) =>
                onSettingsChange({ ...settings, alertOnLossLimit: e.target.checked })
              }
            />
            {t.alertOnLossLimit}
          </label>
        </div>
        <div className="goal-progress">
          {settings.dailyProfitGoal != null && selectedDate && (
            <div className="goal-bar-wrap">
              <span>
                {t.todayGoal}: {formatMoney(selectedDayPnl)} / {formatMoney(settings.dailyProfitGoal)}
              </span>
              <div className="goal-bar">
                <div
                  className={`goal-fill ${pnlClass(selectedDayPnl)}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, (selectedDayPnl / settings.dailyProfitGoal) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
          {settings.weeklyProfitGoal != null && (
            <div className="goal-bar-wrap">
              <span>
                {t.weekGoal}: {formatMoney(weekPnl)} / {formatMoney(settings.weeklyProfitGoal)}
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
        </div>
      </section>

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
        <h3>{t.tradeAnalytics}</h3>
        <p className="hint-inline">{tJournal.tradeAnalyticsHint}</p>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>{t.date}</th>
                <th>{t.symbol}</th>
                <th>PnL</th>
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
                const bal = balanceByDate.get(trade.date) ?? 0
                const rr = effectiveRR(trade, meta)
                const rp = effectiveRiskPct(trade, meta, bal)
                const sess = tradeSession(trade.closeTime)
                return (
                  <tr key={trade.id}>
                    <td>{trade.date}</td>
                    <td>{trade.symbol}</td>
                    <td className={pnlClass(netPnl(trade))}>{formatMoney(netPnl(trade))}</td>
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
    </div>
  )
}
