import { useMemo, useState } from 'react'
import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { netPnl } from '../lib/analytics'
import { computeExitPlan, type ExitDiagnosis, type ExitKind, type ExitPlanRow } from '../lib/exitPlan'
import { sortTradesRecentFirst } from '../lib/tradeSort'

interface Props {
  trades: Trade[]
  metaMap: Record<string, TradeMeta>
  t: Translations['exitPlan']
  sideLabels: Translations['side']
}

const EARLY: ExitKind[] = ['early_profit', 'early_cut', 'scratch']

const TONE: Record<ExitDiagnosis, 'bad' | 'ok' | 'neutral'> = {
  no_data: 'neutral',
  on_plan: 'ok',
  early_profit_full_sl: 'bad',
  early_both: 'bad',
  early_profit_only: 'bad',
  early_cut_ok: 'ok',
  too_many_scratches: 'bad',
  mixed: 'neutral',
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')
}

function n(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

function detail(row: ExitPlanRow, t: Translations['exitPlan']): string {
  if (row.kind === 'early_profit' && row.tpCapture != null) {
    const base = fill(t.detailEarlyProfit, { pct: n(row.tpCapture * 100) })
    return row.priceReachedTp ? `${base} · ${t.detailReachedTp}` : base
  }
  if (row.kind === 'early_cut' && row.exitR != null) {
    return fill(t.detailEarlyCut, { r: n(row.exitR, 2) })
  }
  if (row.kind === 'sl_overrun' && row.exitR != null) {
    return fill(t.detailOverrun, { r: n(row.exitR, 2) })
  }
  if (row.kind === 'hit_tp') return t.detailHitTp
  if (row.kind === 'hit_sl') return t.detailHitSl
  if (row.kind === 'scratch') return t.detailScratch
  if (row.kind === 'profit_no_tp') return t.detailProfitNoTp
  return t.detailLossNoSl
}

export function ExitPlanPanel({ trades, metaMap, t, sideLabels }: Props) {
  const [earlyOnly, setEarlyOnly] = useState(true)
  const stats = useMemo(() => computeExitPlan(trades, metaMap), [trades, metaMap])

  const ordered = useMemo(() => {
    const byId = new Map(stats.rows.map((row) => [row.trade.id, row]))
    return sortTradesRecentFirst(stats.rows.map((row) => row.trade))
      .map((trade) => byId.get(trade.id))
      .filter((row): row is ExitPlanRow => row != null)
  }, [stats.rows])

  const visible = earlyOnly ? ordered.filter((row) => EARLY.includes(row.kind)) : ordered
  const planPct = stats.sample ? ((stats.hitTp + stats.hitSl) / stats.sample) * 100 : 0
  const vars = {
    sample: String(stats.sample),
    planPct: n(planPct),
    earlyProfitPct: n(stats.earlyProfitPct),
    earlyCutPct: n(stats.earlyCutPct),
    hitTpPct: n(stats.hitTpPct),
    hitSlPct: n(stats.hitSlPct),
    scratchPct: n(stats.scratchPct),
    capture: n(stats.avgCapturePct),
    cut: n(stats.avgCutR, 2),
  }
  const tone = TONE[stats.diagnosis]

  return (
    <div className="exit-plan-panel">
      <section className="panel">
        <div className="panel-head">
          <h3>{t.title}</h3>
        </div>
        <p className="hint-inline">{t.subtitle}</p>
        <div className={`exit-verdict ${tone}`}>
          <strong>{t.verdictTitle}</strong>
          <p>{fill(t[stats.diagnosis], vars)}</p>
          {stats.rLeft != null && stats.rLeft >= 0.5 ? (
            <p>{fill(t.extraLeft, { rLeft: n(stats.rLeft, 1) })}</p>
          ) : null}
          {stats.rSaved != null && stats.rSaved >= 0.5 ? (
            <p>{fill(t.extraSaved, { rSaved: n(stats.rSaved, 1) })}</p>
          ) : null}
          {stats.reachedTpThenLeft > 0 ? (
            <p>{fill(t.extraReached, { n: String(stats.reachedTpThenLeft) })}</p>
          ) : null}
        </div>
      </section>

      {stats.sample === 0 ? (
        <section className="panel">
          <p className="empty">{t.empty}</p>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="label">{t.kpiHitTp}</span>
                <span className="val positive">{n(stats.hitTpPct)}%</span>
                <span className="label">{stats.hitTp}/{stats.withTp}</span>
              </div>
              <div className="kpi-card">
                <span className="label">{t.kpiEarlyProfit}</span>
                <span className="val">{n(stats.earlyProfitPct)}%</span>
                <span className="label">{stats.earlyProfit}/{stats.withTp}</span>
              </div>
              <div className="kpi-card">
                <span className="label">{t.kpiHitSl}</span>
                <span className="val negative">{n(stats.hitSlPct)}%</span>
                <span className="label">{stats.hitSl}/{stats.withSl}</span>
              </div>
              <div className="kpi-card">
                <span className="label">{t.kpiEarlyCut}</span>
                <span className="val">{n(stats.earlyCutPct)}%</span>
                <span className="label">{stats.earlyCut}/{stats.withSl}</span>
              </div>
              <div className="kpi-card">
                <span className="label">{t.kpiScratch}</span>
                <span className="val">{n(stats.scratchPct)}%</span>
                <span className="label">{stats.scratch}/{stats.sample}</span>
              </div>
              <div className="kpi-card">
                <span className="label">{t.kpiCapture}</span>
                <span className="val">{stats.avgCapturePct != null ? `${n(stats.avgCapturePct)}%` : '—'}</span>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.listTitle}</h3>
              <div className="panel-head-actions">
                <button
                  type="button"
                  className={`btn-ghost-sm${earlyOnly ? ' active' : ''}`}
                  onClick={() => setEarlyOnly(true)}
                >
                  {t.listEarlyOnly}
                </button>
                <button
                  type="button"
                  className={`btn-ghost-sm${!earlyOnly ? ' active' : ''}`}
                  onClick={() => setEarlyOnly(false)}
                >
                  {t.listAll}
                </button>
              </div>
            </div>
            {visible.length === 0 ? (
              <p className="empty">{t.listEmpty}</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table compact">
                  <thead>
                    <tr>
                      <th>{t.colDate}</th>
                      <th>{t.colSymbol}</th>
                      <th>{t.colSide}</th>
                      <th>{t.colExit}</th>
                      <th>{t.colDetail}</th>
                      <th>{t.colPnl}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 80).map((row) => {
                      const pnl = netPnl(row.trade)
                      return (
                        <tr key={row.trade.id}>
                          <td>{row.trade.date}</td>
                          <td>{row.trade.symbol}</td>
                          <td>{sideLabels[row.trade.side]}</td>
                          <td>{t.kind[row.kind]}</td>
                          <td>{detail(row, t)}</td>
                          <td className={pnlClass(pnl)}>{formatMoney(pnl)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
