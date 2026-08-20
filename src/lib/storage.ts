import type { AppSettings } from '../types/account'
import type { CashMovement } from '../types/account'
import type { Trade } from '../types/trade'
import { dedupeCashMovements } from './mergeTrades'
import type { AppLanguage } from '../i18n/types'

const TRADES_KEY = 'trading-journal-trades'
const CASH_KEY = 'trading-journal-cash'
export const SETTINGS_STORAGE_KEY = 'trading-journal-settings'
const SETTINGS_KEY = SETTINGS_STORAGE_KEY
const SETTINGS_BROADCAST = 'tj-settings'

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
    try {
      const bc = new BroadcastChannel(SETTINGS_BROADCAST)
      bc.postMessage({ type: 'settings', settings })
      bc.close()
    } catch {
      /* BroadcastChannel unavailable */
    }
  } catch {
    console.warn('localStorage lleno: ajustes no guardados')
  }
}

/** Sync settings across Electron windows / browser tabs. */
export function subscribeSettings(onChange: (settings: AppSettings) => void): () => void {
  const applyRaw = (raw: string | null) => {
    if (!raw) return
    try {
      onChange({ ...defaultSettings(), ...(JSON.parse(raw) as AppSettings) })
    } catch {
      /* ignore bad payload */
    }
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key !== SETTINGS_KEY) return
    applyRaw(e.newValue)
  }

  let bc: BroadcastChannel | null = null
  try {
    bc = new BroadcastChannel(SETTINGS_BROADCAST)
    bc.onmessage = (ev) => {
      const data = ev.data as { type?: string; settings?: AppSettings } | null
      if (data?.type === 'settings' && data.settings) {
        onChange({ ...defaultSettings(), ...data.settings })
      }
    }
  } catch {
    bc = null
  }

  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener('storage', onStorage)
    bc?.close()
  }
}

export function createId(): string {
  return crypto.randomUUID()
}
