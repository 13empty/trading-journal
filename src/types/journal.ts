export interface TradeChecklist {
  hadSetup: boolean
  respectedRisk: boolean
  inTradingHours: boolean
}

/** Common ICT / price-action setups (custom string also allowed). */
export type SetupId =
  | 'fvg'
  | 'order_block'
  | 'breakout'
  | 'liquidity_sweep'
  | 'bos'
  | 'choch'
  | 'supply_demand'
  | 'trend_continuation'
  | 'reversal'
  | 'other'

export type SetupQuality = 'A' | 'B' | 'C'

export type TradeTimeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1'

export type ScreenshotSlot = 'before' | 'after' | 'close'

export interface TradeScreenshots {
  /** Relative path under userData/trade-screenshots */
  before?: string
  after?: string
  close?: string
}

/** Why the trade went wrong (learning tags). */
export type MistakeId =
  | 'entered_late'
  | 'no_confirmation'
  | 'moved_sl'
  | 'early_tp'
  | 'revenge'
  | 'overtrading'
  | 'outside_hours'
  | 'risk_too_high'
  | 'broke_rule'
  | 'wrong_setup'

export interface MistakeStats {
  mistake: MistakeId | string
  trades: number
  pnl: number
  avgPnl: number
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
  /** Setup type used for the trade (FVG, OB, …) */
  setup?: SetupId | string
  /** Chart timeframe */
  timeframe?: TradeTimeframe | string
  /** Override of auto session from close time */
  session?: TradingSession
  /** Setup quality grade */
  setupQuality?: SetupQuality
  /** Planned stop loss price */
  stopLoss?: number
  /** Planned take profit price */
  takeProfit?: number
  /** Local chart screenshots linked to this trade */
  screenshots?: TradeScreenshots
  /** Mistake tracker: why this trade failed / what went wrong */
  mistakes?: MistakeId[]
  /**
   * Maximum Favorable Excursion in R (how far price went in your favor).
   * e.g. 7 means +7R peak before close.
   */
  mfeR?: number
  /**
   * Maximum Adverse Excursion in R (how far against, as a positive number).
   * e.g. 0.9 means almost −1R drawdown during the trade.
   */
  maeR?: number
}

export interface DailyNote {
  text: string
  whatWorked: string
  whatFailed: string
}

export interface WeeklyNote {
  repeat: string
  avoid: string
  focus: string
}

export interface TrackingGoals {
  dailyProfitGoal?: number
  dailyLossLimit?: number
  weeklyProfitGoal?: number
  monthlyProfitGoal?: number
  /**
   * When enabled, editing one profit goal fills the other two
   * (≈5 trading days/week, ≈20 trading days/month).
   */
  autoCalcProfitGoals?: boolean
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
  /** Desktop + UI message when a profit goal is reached */
  showGoalReachedMessage?: boolean
  /**
   * Close all open MT5 positions when a DAY rule is breached
   * (daily loss limit or max trades per day only).
   */
  autoCloseOnDayRule?: boolean
}

export type ThresholdRuleId = 'daily_loss' | 'max_trades' | 'revenge_risk' | 'drawdown_peak'

export type ThresholdStatus = 'ok' | 'warn' | 'off'

export interface ThresholdRuleState {
  id: ThresholdRuleId
  status: ThresholdStatus
  detail?: string
  /** 0–100 usage of the limit (for progress bars) */
  progress?: number
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

/** Aggregated performance for Setup + Session + Direction combos. */
export interface SetupComboStats {
  setup: string
  session: TradingSession
  side: 'long' | 'short'
  trades: number
  wins: number
  losses: number
  winRate: number
  /** Average realized R (signed). Null if no risk/R data. */
  expectancyR: number | null
  /** Sample size for R expectancy */
  rSampleCount: number
  pnl: number
  avgPnl: number
  /** Average result % of balance when available */
  avgPct: number | null
  pctSampleCount: number
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
  avgRiskAmount: number
  riskPctSampleCount: number
  riskAmountSampleCount: number
  avgHoldMinutes: number
}
