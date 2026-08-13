export type CashCategory = 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out' | 'fee'

export type CashType = 'deposit' | 'withdraw'

export interface CashMovement {
  id: string
  date: string
  type: CashType
  category: CashCategory
  amount: number
  notes: string
}

import type { AppLanguage } from '../i18n/types'
import type { TrackingGoals } from './journal'

export type CalendarPnlDisplay = 'dollar' | 'percent' | 'both'

/**
 * Full UI appearance packs (palette + mood).
 * Replaces separate dark/light + accent picker.
 */
export type AppearanceId = 'midnight' | 'graphite' | 'cyber' | 'slate' | 'light'

/** @deprecated use AppearanceId — kept for migrating stored settings */
export type UiMode = 'dark' | 'light'
/** @deprecated accents are baked into each appearance */
export type AccentTheme = 'blue' | 'teal' | 'green' | 'amber' | 'rose'

export interface AppSettings extends TrackingGoals {
  initialBalance: number
  brokerBalance?: number
  brokerEquity?: number
  brokerBalanceDate?: string
  /** Total Net Profit del reporte MT5 (suma trades cerrados) */
  mt5NetProfit?: number
  /** UI language (es, en, pt) */
  language?: AppLanguage
  /** Visual appearance pack */
  appearance?: AppearanceId
  /** @deprecated migrated into appearance */
  uiMode?: UiMode
  /** @deprecated accents come from appearance packs */
  accentTheme?: AccentTheme
  /** Etiqueta de la cuenta MT5 activa */
  accountLabel?: string
  /** IDs de cuentas conocidas (multi-cuenta) */
  knownAccounts?: string[]
  /** Notificaciones de escritorio (Electron / navegador) */
  desktopNotifications?: boolean
  /** No mostrar guía de bienvenida */
  welcomeDismissed?: boolean
  /** Broker elegido en el asistente */
  brokerPreset?: string
  brokerConfigured?: boolean
  mt5ServerOffsetHours?: number
  /** URL feed de actualizaciones (generic provider) */
  updateFeedUrl?: string
  /** Calendario: mostrar PnL en $, % o ambos */
  calendarPnlDisplay?: CalendarPnlDisplay
}

export interface Mt5OpenPosition {
  id: number
  symbol: string
  side: string
  volume: number
  openPrice: number
  profit: number
  swap?: number
}

export interface DayActivity {
  date: string
  pnl: number
  grossPnl: number
  fees: number
  trades: number
  deposits: number
  withdraws: number
  transfersIn: number
  transfersOut: number
  otherFees: number
  netCash: number
  endBalance: number
  /** Posiciones abiertas (PnL flotante de hoy) */
  openCount?: number
  livePnl?: number
}

export interface AccountSummary {
  brokerBalance: number | null
  totalDeposits: number
  totalWithdraws: number
  netCashIn: number
  /** Saldo − (depósitos − retiros) — lo que MT5 muestra como ganancia de cuenta */
  accountProfit: number
  /** Suma PnL neto de posiciones cerradas (Total Net Profit ~989.94) */
  mt5NetProfit: number
  swap: number
  balanceFees: number
  transfersOut: number
  grossLoss: number
  grossProfit: number
}
