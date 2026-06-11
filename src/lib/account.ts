import { eachDayOfInterval, startOfMonth, endOfMonth, min, max } from 'date-fns'
import { dateOnlyFromMt5String, parseLocalDateKey } from './mt5Date'
import type { CashMovement, CashCategory } from '../types/account'
import type { AppSettings, DayActivity, AccountSummary } from '../types/account'
import type { Trade } from '../types/trade'

export interface Mt5BalanceClassification {
  category: CashCategory
  type: 'deposit' | 'withdraw'
}

export function classifyMt5Balance(
  comment: string,
  amount: number,
  accountId?: string,
): Mt5BalanceClassification | null {
  if (amount === 0) return null
  const c = comment.toLowerCase()

  if (c.includes('divs') || c.includes('fee') || c.includes('comision')) {
    return { category: 'fee', type: 'withdraw' }
  }

  if (c.includes('autotrf') && amount > 0) {
    return { category: 'transfer_in', type: 'deposit' }
  }

  if (c.includes('solidpayments') || c.includes('deposit')) {
    return { category: 'deposit', type: amount > 0 ? 'deposit' : 'withdraw' }
  }

  if (c.includes('/to ') || c.includes(' to ')) {
    if (accountId && c.includes(`to ${accountId}`)) {
      return { category: 'transfer_in', type: 'deposit' }
    }
    return { category: 'transfer_out', type: 'withdraw' }
  }

  if (c.includes('/fr ') || c.includes('/from') || c.includes(' fr ')) {
    return { category: 'transfer_in', type: 'deposit' }
  }

  return amount > 0
    ? { category: 'deposit', type: 'deposit' }
    : { category: 'withdraw', type: 'withdraw' }
}

export function detectCashType(transactionType: string, symbol: string): 'deposit' | 'withdraw' | null {
  const s = `${transactionType} ${symbol}`.toLowerCase()
  if (/\bdeposit\b|dep[oó]sito|ingreso/.test(s)) return 'deposit'
  if (/\bwithdraw|retiro|withdrawal\b/.test(s)) return 'withdraw'
  return null
}

export function isTradeTransaction(transactionType: string): boolean {
  const s = transactionType.toLowerCase()
  return s.includes('trade') || s.includes('buy') || s.includes('sell')
}

/** Suma la columna Profit de MT5 (bruto; comisión/swap van aparte en el terminal). */
export function netTradePnl(trades: Trade[]): number {
  return trades.reduce((s, t) => s + t.pnl, 0)
}

export function totalDeposits(cash: CashMovement[]): number {
  return cash
    .filter((c) => c.category === 'deposit' || c.category === 'transfer_in')
    .reduce((s, c) => s + c.amount, 0)
}

/** Retiros + transferencias salida + ajustes (DIVS) — coincide con MT5: 353.51 */
export function totalWithdraws(cash: CashMovement[]): number {
  return cash
    .filter(
      (c) =>
        c.category === 'withdraw' ||
        c.category === 'transfer_out' ||
        c.category === 'fee',
    )
    .reduce((s, c) => s + c.amount, 0)
}

export function buildAccountSummary(
  trades: Trade[],
  cash: CashMovement[],
  settings: AppSettings,
): AccountSummary {
  const deposits = totalDeposits(cash)
  const withdraws = totalWithdraws(cash)
  const netCashIn = deposits - withdraws
  const mt5NetProfit = settings.mt5NetProfit ?? netTradePnl(trades)
  const brokerBalance = settings.brokerBalance ?? null
  const accountProfit =
    brokerBalance != null ? brokerBalance - netCashIn : mt5NetProfit

  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0)
  const swap = trades.reduce((s, t) => s + t.fees, 0)
  const balanceFees = cash.filter((c) => c.category === 'fee').reduce((s, c) => s + c.amount, 0)
  const transfersOut = cash
    .filter((c) => c.category === 'transfer_out')
    .reduce((s, c) => s + c.amount, 0)

  return {
    brokerBalance,
    totalDeposits: deposits,
    totalWithdraws: withdraws,
    netCashIn,
    accountProfit,
    mt5NetProfit,
    swap,
    balanceFees,
    transfersOut,
    grossLoss,
    grossProfit,
  }
}

function cashDeltaForDay(movements: CashMovement[]): {
  deposits: number
  withdraws: number
  transfersIn: number
  transfersOut: number
  otherFees: number
  netCash: number
} {
  let deposits = 0
  let withdraws = 0
  let transfersIn = 0
  let transfersOut = 0
  let otherFees = 0

  for (const c of movements) {
    switch (c.category) {
      case 'deposit':
        deposits += c.amount
        break
      case 'withdraw':
        withdraws += c.amount
        break
      case 'transfer_in':
        transfersIn += c.amount
        break
      case 'transfer_out':
        transfersOut += c.amount
        break
      case 'fee':
        otherFees += c.amount
        break
    }
  }

  const netCash = deposits + transfersIn - withdraws - transfersOut - otherFees
  return { deposits, withdraws, transfersIn, transfersOut, otherFees, netCash }
}

export function normalizeDayKey(dateStr: string): string {
  return dateOnlyFromMt5String(dateStr)
}

export function buildDayActivities(
  trades: Trade[],
  cash: CashMovement[],
  settings: AppSettings,
): DayActivity[] {
  const dates = new Set<string>()
  for (const t of trades) dates.add(normalizeDayKey(t.date))
  for (const c of cash) dates.add(normalizeDayKey(c.date))
  if (dates.size === 0) return []

  const sorted = [...dates].sort()
  let balance = settings.initialBalance
  const result: DayActivity[] = []

  for (const date of sorted) {
    const dayTrades = trades.filter((t) => normalizeDayKey(t.date) === date)
    const dayCash = cash.filter((c) => normalizeDayKey(c.date) === date)
    const grossPnl = dayTrades.reduce((s, t) => s + t.pnl, 0)
    const fees = dayTrades.reduce((s, t) => s + t.fees, 0)
    const pnl = grossPnl
    const cashDay = cashDeltaForDay(dayCash)
    balance += cashDay.netCash + (grossPnl - fees)
    result.push({
      date,
      pnl,
      grossPnl,
      fees,
      trades: dayTrades.length,
      deposits: cashDay.deposits + cashDay.transfersIn,
      withdraws: cashDay.withdraws,
      transfersIn: cashDay.transfersIn,
      transfersOut: cashDay.transfersOut,
      otherFees: cashDay.otherFees,
      netCash: cashDay.netCash,
      endBalance: balance,
    })
  }

  if (settings.brokerBalance != null && result.length > 0) {
    result[result.length - 1].endBalance = settings.brokerBalance
  }

  return result
}

export function dayOutflow(
  day: Pick<DayActivity, 'withdraws' | 'transfersOut' | 'otherFees'>,
): number {
  return day.withdraws + day.transfersOut + day.otherFees
}

export function dayActivityMap(activities: DayActivity[]): Map<string, DayActivity> {
  return new Map(activities.map((d) => [d.date, d]))
}

export function calendarRange(
  trades: Trade[],
  cash: CashMovement[],
  viewMonth: Date,
): { start: Date; end: Date } {
  const today = new Date()
  const allDates = [
    ...trades.map((t) => parseLocalDateKey(t.date)),
    ...cash.map((c) => parseLocalDateKey(c.date)),
  ]
  const dataStart = allDates.length > 0 ? min(allDates) : startOfMonth(viewMonth)
  const rangeStart = min([startOfMonth(dataStart), startOfMonth(viewMonth)])
  const rangeEnd = max([endOfMonth(viewMonth), today])
  return { start: rangeStart, end: rangeEnd }
}

export function monthGridDays(month: Date): Date[] {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  return eachDayOfInterval({ start, end }).map(
    (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0),
  )
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentBalance(activities: DayActivity[], settings: AppSettings): number {
  if (settings.brokerBalance != null) return settings.brokerBalance
  if (activities.length === 0) return settings.initialBalance
  return activities[activities.length - 1].endBalance
}

export function calculatedBalance(activities: DayActivity[], settings: AppSettings): number {
  if (activities.length === 0) return settings.initialBalance
  return activities[activities.length - 1].endBalance
}
