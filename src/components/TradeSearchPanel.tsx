import { useMemo, useState } from 'react'
import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import { formatMoney, pnlClass } from '../lib/aggregations'
import {
  emptySearchFilters,
  searchTrades,
  uniqueSymbols,
  type TradeSearchFilters,
} from '../lib/searchTrades'

interface Props {
  trades: Trade[]
  metaMap: Record<string, TradeMeta>
  t: Translations['search']
  sideLabels: Translations['side']
  onSelectDate: (date: string) => void
}

export function TradeSearchPanel({ trades, metaMap, t, sideLabels, onSelectDate }: Props) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<TradeSearchFilters>(emptySearchFilters())

  const symbols = useMemo(() => uniqueSymbols(trades), [trades])
  const results = useMemo(
    () => searchTrades(trades, metaMap, filters).slice(0, 80),
    [trades, metaMap, filters],
  )

  const hasFilter =
    filters.query ||
    filters.symbol ||
    filters.fromDate ||
    filters.toDate ||
    filters.outcome !== 'all' ||
    filters.tag

  return (
    <section className="panel search-panel">
      <div className="panel-head">
        <h3>{t.title}</h3>
        <button type="button" className="btn-ghost-sm" onClick={() => setOpen((v) => !v)}>
          {open ? t.hide : t.show}
        </button>
      </div>

      {open && (
        <>
          <div className="search-filters">
            <input
              type="search"
              placeholder={t.queryPlaceholder}
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            />
            <select
              value={filters.symbol}
              onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
            >
              <option value="">{t.allSymbols}</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              title={t.fromDate}
            />
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              title={t.toDate}
            />
            <select
              value={filters.outcome}
              onChange={(e) =>
                setFilters({ ...filters, outcome: e.target.value as TradeSearchFilters['outcome'] })
              }
            >
              <option value="all">{t.allOutcomes}</option>
              <option value="win">{t.winsOnly}</option>
              <option value="loss">{t.lossesOnly}</option>
            </select>
            <input
              type="text"
              placeholder={t.tagPlaceholder}
              value={filters.tag}
              onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
            />
            {hasFilter && (
              <button type="button" className="btn-ghost-sm" onClick={() => setFilters(emptySearchFilters())}>
                {t.clear}
              </button>
            )}
          </div>

          <p className="hint-inline">
            {results.length} {t.results}
            {results.length === 80 ? ` (${t.truncated})` : ''}
          </p>

          {results.length === 0 ? (
            <p className="empty">{t.noResults}</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>{t.symbol}</th>
                    <th>{t.side}</th>
                    <th>PnL</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((trade) => (
                    <tr key={trade.id}>
                      <td>{trade.date}</td>
                      <td>{trade.symbol}</td>
                      <td>{sideLabels[trade.side]}</td>
                      <td className={pnlClass(trade.pnl)}>
                        {formatMoney(trade.pnl)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            onSelectDate(trade.date)
                            setOpen(false)
                          }}
                        >
                          {t.openDay}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
