export type PeriodView = 'day' | 'week' | 'month' | 'year'

export type TradeSource = 'mt5' | 'binance' | 'bybit' | 'okx' | 'bitget' | 'manual'

export interface Trade {
  id: string
  date: string
  symbol: string
  side: 'long' | 'short'
  quantity: number
  entryPrice: number
  exitPrice: number
  pnl: number
  fees: number
  notes: string
  /** Origin of the fill: MT5 bridge or crypto exchange connector */
  source?: TradeSource
  positionId?: string
  /** ISO or MT5 datetime string from bridge */
  openTime?: string
  closeTime?: string
  swap?: number
  commission?: number
  accountId?: string
  /** Stop loss price from MT5 orders (auto) */
  stopLoss?: number
  /** Take profit price from MT5 orders (auto) */
  takeProfit?: number
  /** $ risk from entry→SL × tick value × volume (auto) */
  riskAmount?: number
  /** Max favorable excursion in R (auto from OHLC when SL known) */
  mfeR?: number
  /** Max adverse excursion in R (auto from OHLC when SL known) */
  maeR?: number
  mfePrice?: number
  maePrice?: number
}

export interface PeriodSummary {
  key: string
  label: string
  pnl: number
  trades: number
  wins: number
  losses: number
}

export interface DaySummary {
  date: string
  pnl: number
  trades: number
}
