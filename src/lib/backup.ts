import type { AppSettings } from '../types/account'
import type { CashMovement } from '../types/account'
import type { DailyNote, TradeMeta } from '../types/journal'
import type { Trade } from '../types/trade'

export const BACKUP_VERSION = 1

export interface BackupBundle {
  version: typeof BACKUP_VERSION
  exportedAt: string
  appVersion: string
  trades: Trade[]
  cash: CashMovement[]
  settings: AppSettings
  tradeMeta: Record<string, TradeMeta>
  dailyNotes: Record<string, DailyNote>
}

export function buildBackup(data: Omit<BackupBundle, 'version' | 'exportedAt' | 'appVersion'>): BackupBundle {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '1.2.0',
    ...data,
  }
}

export function downloadBackup(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trading-journal-backup-${bundle.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackup(raw: string): BackupBundle {
  const data = JSON.parse(raw) as BackupBundle
  if (!data || data.version !== BACKUP_VERSION) {
    throw new Error('invalid_version')
  }
  if (!Array.isArray(data.trades) || !Array.isArray(data.cash)) {
    throw new Error('invalid_shape')
  }
  return data
}
