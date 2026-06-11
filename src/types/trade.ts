export type PeriodView = 'day' | 'week' | 'month' | 'year'

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
  positionId?: string
  /** ISO or MT5 datetime string from bridge */
  openTime?: string
  closeTime?: string
  swap?: number
  commission?: number
  accountId?: string
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
