import { formatMoney, formatBalance, pnlClass, winRate } from '../lib/aggregations'
import { computeDrawdown, computeProfitFactor } from '../lib/analytics'
import type { EquityPoint } from '../types/journal'
import type { Trade } from '../types/trade'
import type { Translations } from '../i18n/types'
import { useMemo } from 'react'

interface Props {
  balance: number
  equity: number | null
  netProfit: number
  trades: Trade[]
  equityCurve: EquityPoint[]
  t: Translations['statsBar']
}

/** Horizontal strip under the calendar (mockup layout). */
export function AccountStatsBar({
  balance,
  equity,
  netProfit,
  trades,
  equityCurve,
  t,
}: Props) {
  const wr = useMemo(() => winRate(trades), [trades])
  const pf = useMemo(() => computeProfitFactor(trades), [trades])
  const dd = useMemo(() => computeDrawdown(equityCurve), [equityCurve])
  const equityVal = equity ?? balance

  return (
    <footer className="account-stats-bar account-stats-bar-under-cal" aria-label={t.title}>
      <div className="account-stat">
        <span className="account-stat-label">{t.balance}</span>
        <span className="account-stat-val">{formatBalance(balance)}</span>
      </div>
      <div className="account-stat">
        <span className="account-stat-label">{t.equity}</span>
        <span className="account-stat-val">{formatBalance(equityVal)}</span>
      </div>
      <div className="account-stat account-stat-emphasis">
        <span className="account-stat-label">{t.netProfit}</span>
        <span className={`account-stat-val ${pnlClass(netProfit)}`}>{formatMoney(netProfit)}</span>
      </div>
      <div className="account-stat">
        <span className="account-stat-label">{t.trades}</span>
        <span className="account-stat-val">{trades.length}</span>
      </div>
      <div className="account-stat">
        <span className="account-stat-label">{t.winRate}</span>
        <span className="account-stat-val">
          {trades.length > 0 ? `${wr.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="account-stat">
        <span className="account-stat-label">{t.profitFactor}</span>
        <span className={`account-stat-val ${Number.isFinite(pf) && pf >= 1 ? 'positive' : ''}`}>
          {Number.isFinite(pf) ? pf.toFixed(2) : '—'}
        </span>
      </div>
      <div className="account-stat">
        <span className="account-stat-label">{t.maxDrawdown}</span>
        <span className={`account-stat-val ${dd.maxDrawdown > 0 ? 'negative' : ''}`}>
          {dd.maxDrawdown > 0 ? formatMoney(-dd.maxDrawdown) : '—'}
        </span>
      </div>
    </footer>
  )
}
