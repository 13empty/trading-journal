import type { AppSettings } from '../types/account'
import type { CashMovement } from '../types/account'
import type { Trade } from '../types/trade'
import { dedupeCashMovements } from './mergeTrades'
import type { AppLanguage } from '../i18n/types'

const TRADES_KEY = 'trading-journal-trades'
const CASH_KEY = 'trading-journal-cash'
const SETTINGS_KEY = 'trading-journal-settings'

const defaultSettings = (): AppSettings => ({ initialBalance: 0, language: 'es' as AppLanguage })

export function loadTrades(): Trade[] {
  try {
    const raw = localStorage.getItem(TRADES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Trade[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveTrades(trades: Trade[]): void {
  try {
    localStorage.setItem(TRADES_KEY, JSON.stringify(trades))
  } catch {
    console.warn('localStorage lleno: trades no guardados en disco')
  }
}

function migrateCash(c: CashMovement): CashMovement {
  if (c.category) return c
  const notes = (c.notes || '').toLowerCase()
  let category = c.type as CashMovement['category']
  if (notes.includes('divs') || notes.includes('fee')) category = 'fee'
  else if (notes.includes('autotrf') && c.type === 'withdraw') category = 'transfer_out'
  else if (notes.includes('autotrf') && c.type === 'deposit') category = 'transfer_in'
  return { ...c, category }
}

export function loadCashMovements(): CashMovement[] {
  try {
    const raw = localStorage.getItem(CASH_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CashMovement[]
    return Array.isArray(parsed) ? dedupeCashMovements(parsed.map(migrateCash)) : []
  } catch {
    return []
  }
}

export function saveCashMovements(movements: CashMovement[]): void {
  localStorage.setItem(CASH_KEY, JSON.stringify(movements))
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings()
    return { ...defaultSettings(), ...(JSON.parse(raw) as AppSettings) }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    console.warn('localStorage lleno: ajustes no guardados')
  }
}

export function createId(): string {
  return crypto.randomUUID()
}
