import { format } from 'date-fns'
import type { Locale } from 'date-fns'
import type { DayActivity } from '../types/account'
import type { AppSettings } from '../types/account'
import type {
  AdvancedMetrics,
  DrawdownInfo,
  PeriodCompare,
  StreakInfo,
  SymbolStats,
} from '../types/journal'
import type { Trade } from '../types/trade'
import { formatMoney, winRate } from './aggregations'
import { parseLocalDateKey } from './mt5Date'

export interface ReportData {
  generatedAt: string
  accountLabel: string
  trades: Trade[]
  activities: DayActivity[]
  metrics: AdvancedMetrics
  drawdown: DrawdownInfo
  streaks: StreakInfo
  symbols: SymbolStats[]
  compare: PeriodCompare
  settings: AppSettings
  closedPnl: number
  winRatePct: number
}

function reportHtml(data: ReportData, locale: Locale, labels: Record<string, string>): string {
  const month = format(new Date(), 'MMMM yyyy', { locale })
  const pf =
    data.metrics.profitFactor === Infinity ? '∞' : data.metrics.profitFactor.toFixed(2)

  const symbolRows = data.symbols
    .slice(0, 15)
    .map(
      (s) =>
        `<tr><td>${s.symbol}</td><td>${s.trades}</td><td>${s.winRate.toFixed(1)}%</td><td>${formatMoney(s.pnl)}</td></tr>`,
    )
    .join('')

  const bestDay = [...data.activities].sort((a, b) => b.pnl - a.pnl)[0]
  const worstDay = [...data.activities].sort((a, b) => a.pnl - b.pnl)[0]

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Trading Journal — ${month}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 2rem; color: #111; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .sub { color: #666; margin-bottom: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem; }
  .card .label { font-size: 0.75rem; color: #666; }
  .card .val { font-size: 1.1rem; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.85rem; }
  th, td { border-bottom: 1px solid #eee; padding: 0.4rem 0.5rem; text-align: left; }
  th { color: #666; font-weight: 600; }
  .pos { color: #059669; }
  .neg { color: #dc2626; }
  @media print { body { padding: 1rem; } }
</style>
</head>
<body>
  <h1>Trading Journal — ${labels.reportTitle}</h1>
  <p class="sub">${data.accountLabel} · ${data.generatedAt} · ${data.trades.length} ${labels.trades}</p>

  <div class="grid">
    <div class="card"><div class="label">${labels.closedPnl}</div><div class="val">${formatMoney(data.closedPnl)}</div></div>
    <div class="card"><div class="label">${labels.winRate}</div><div class="val">${data.winRatePct.toFixed(1)}%</div></div>
    <div class="card"><div class="label">${labels.expectancy}</div><div class="val">${formatMoney(data.metrics.expectancy)}</div></div>
    <div class="card"><div class="label">${labels.profitFactor}</div><div class="val">${pf}</div></div>
    <div class="card"><div class="label">${labels.maxDrawdown}</div><div class="val neg">−$${data.drawdown.maxDrawdown.toFixed(2)} (${data.drawdown.maxDrawdownPct.toFixed(1)}%)</div></div>
    <div class="card"><div class="label">${labels.avgRR}</div><div class="val">${data.metrics.avgRR > 0 ? data.metrics.avgRR.toFixed(2) : '—'}</div></div>
  </div>

  <h2>${labels.streaks}</h2>
  <p>${labels.maxWinStreak}: ${data.streaks.maxWin} · ${labels.maxLossStreak}: ${data.streaks.maxLoss} · ${labels.maxGreenDays}: ${data.streaks.maxGreenDays} · ${labels.maxRedDays}: ${data.streaks.maxRedDays}</p>

  <h2>${labels.compare}</h2>
  <p>${data.compare.label}: ${labels.previous} ${formatMoney(data.compare.previous.pnl)} (${data.compare.previous.trades} ${labels.trades}) → ${labels.current} ${formatMoney(data.compare.current.pnl)} (${data.compare.current.trades} ${labels.trades})</p>

  <h2>${labels.bestWorst}</h2>
  <p>${bestDay ? `${labels.best}: ${bestDay.date} ${formatMoney(bestDay.pnl)}` : '—'} · ${worstDay ? `${labels.worst}: ${worstDay.date} ${formatMoney(worstDay.pnl)}` : '—'}</p>

  <h2>${labels.bySymbol}</h2>
  <table>
    <thead><tr><th>${labels.symbol}</th><th>${labels.trades}</th><th>${labels.winRate}</th><th>PnL</th></tr></thead>
    <tbody>${symbolRows || `<tr><td colspan="4">${labels.noData}</td></tr>`}</tbody>
  </table>

  <script>window.onload = () => window.print()</script>
</body>
</html>`
}

export function exportMonthlyReport(data: ReportData, locale: Locale, labels: Record<string, string>): void {
  const html = reportHtml(data, locale, labels)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (!w) {
    const a = document.createElement('a')
    a.href = url
    a.download = `trading-journal-${format(new Date(), 'yyyy-MM')}.html`
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function buildReportData(
  trades: Trade[],
  activities: DayActivity[],
  settings: AppSettings,
  extras: Omit<ReportData, 'generatedAt' | 'accountLabel' | 'trades' | 'activities' | 'settings' | 'closedPnl' | 'winRatePct'>,
): ReportData {
  const closedPnl = trades.reduce((s, t) => s + t.pnl, 0)
  return {
    generatedAt: format(new Date(), 'yyyy-MM-dd HH:mm'),
    accountLabel: settings.accountLabel ?? 'MT5',
    trades,
    activities,
    settings,
    closedPnl,
    winRatePct: winRate(trades),
    ...extras,
  }
}

export function refDateFromActivities(activities: DayActivity[]): Date {
  if (activities.length === 0) return new Date()
  const latest = activities.map((a) => a.date).sort().pop()!
  return parseLocalDateKey(latest)
}
