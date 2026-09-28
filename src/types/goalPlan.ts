/** A dated profit plan: daily amount, window, and the rules that protect it. */
export interface GoalPlan {
  id: string
  name: string
  /** Profit to make on each trading day. */
  dailyAmount: number
  /**
   * Optional period target. When empty, the goal is daily amount × trading days.
   */
  totalGoal?: number
  /** yyyy-MM-dd */
  startDate: string
  /** yyyy-MM-dd */
  endDate: string
  /** Count Monday–Friday only. Weekend PnL still counts toward progress. */
  weekdaysOnly: boolean
  stopAtDailyTarget: boolean
  maxDailyLoss?: number
  maxTradesPerDay?: number
  /** Percent of balance risked on one trade. */
  riskPerTradePct?: number
  strategy: string
}
