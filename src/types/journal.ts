export interface TradeChecklist {
  hadSetup: boolean
  respectedRisk: boolean
  inTradingHours: boolean
}

export interface TradeMeta {
  tags?: string[]
  riskAmount?: number
  riskPercent?: number
  rewardAmount?: number
  rrRatio?: number
  screenshotUrl?: string
  chartLink?: string
  checklist?: TradeChecklist
  journalNotes?: string
}

export interface DailyNote {
  text: string
  whatWorked: string
  whatFailed: string
}

export interface TrackingGoals {
  dailyProfitGoal?: number
  dailyLossLimit?: number
  weeklyProfitGoal?: number
  alertOnLossLimit?: boolean
  /** Max closed trades per day before rule fires */
  maxTradesPerDay?: number
  /** Minutes after a loss before another trade flags revenge risk */
  revengeCooldownMinutes?: number
  /** Current drawdown from equity peak (%) before rule fires */
  maxDrawdownFromPeakPct?: number
  /** Desktop alerts for threshold rules (loss, trades, revenge, drawdown) */
  alertOnThresholds?: boolean
  /** Master switch: show rules panel, interrupts, and threshold alerts */
  tradingRulesEnabled?: boolean
}

export type ThresholdRuleId = 'daily_loss' | 'max_trades' | 'revenge_risk' | 'drawdown_peak'

export type ThresholdStatus = 'ok' | 'warn' | 'off'

export interface ThresholdRuleState {
  id: ThresholdRuleId
  status: ThresholdStatus
  detail?: string
}

export type TradingSession = 'asia' | 'london' | 'ny' | 'other'

export interface SymbolStats {
  symbol: string
  trades: number
  wins: number
  losses: number
  pnl: number
  fees: number
  swap: number
  winRate: number
  avgPnl: number
}

export interface SessionStats {
  session: TradingSession
  trades: number
  pnl: number
  winRate: number
}

export interface StreakInfo {
  currentWin: number
  currentLoss: number
  maxWin: number
  maxLoss: number
  currentGreenDays: number
  currentRedDays: number
  maxGreenDays: number
  maxRedDays: number
}

export interface DrawdownInfo {
  maxDrawdown: number
  maxDrawdownPct: number
  peakBalance: number
  troughBalance: number
  peakDate: string
  troughDate: string
}

export interface EquityPoint {
  date: string
  balance: number
  pnl: number
}

export interface PeriodCompare {
  label: string
  current: { pnl: number; trades: number; winRate: number }
  previous: { pnl: number; trades: number; winRate: number }
}

export interface AdvancedMetrics {
  expectancy: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  avgRR: number
  avgRiskPct: number
  avgHoldMinutes: number
}
