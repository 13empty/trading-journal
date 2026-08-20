import type { Locale } from 'date-fns'
import type { Mt5OpenPosition } from '../types/account'
import type { Mt5Status as Mt5StatusType } from '../lib/mt5Bridge'
import type { Translations } from '../i18n/types'
import { Mt5StatusPanel } from './Mt5Status'

interface Props {
  bridgeOnline: boolean
  mt5Connected: boolean
  status: Mt5StatusType | null
  lastSyncAt: number | null
  tradeCount: number
  liveTradeCount: number
  usingLiveTrades: boolean
  openPositions: Mt5OpenPosition[]
  floatingPnl: number
  syncError?: string | null
  onSyncNow: () => void
  onSessionSummary: () => void
  onWeeklySummary: () => void
  onImportExcel: () => void
  onCashForm: () => void
  onProjection?: () => void
  projectionLabel?: string
  importMsg?: string | null
  mt5: Translations['mt5']
  sessionButton: string
  weeklyButton: string
  importExcel: string
  depositWithdraw: string
  dateLocale: Locale
  t: Translations['syncHub']
}

export function SyncHubPanel({
  bridgeOnline,
  mt5Connected,
  status,
  lastSyncAt,
  tradeCount,
  liveTradeCount,
  usingLiveTrades,
  openPositions,
  floatingPnl,
  syncError,
  onSyncNow,
  onSessionSummary,
  onWeeklySummary,
  onImportExcel,
  onCashForm,
  onProjection,
  projectionLabel,
  importMsg,
  mt5,
  sessionButton,
  weeklyButton,
  importExcel,
  depositWithdraw,
  dateLocale,
  t,
}: Props) {
  return (
    <div className="sync-hub">
      <header className="sync-hub-head">
        <h2>{t.title}</h2>
        <p>{t.subtitle}</p>
      </header>

      <div className="sync-hub-card">
        <Mt5StatusPanel
          bridgeOnline={bridgeOnline}
          mt5Connected={mt5Connected}
          status={status}
          lastSyncAt={lastSyncAt}
          tradeCount={tradeCount}
          liveTradeCount={liveTradeCount}
          usingLiveTrades={usingLiveTrades}
          openPositions={openPositions}
          floatingPnl={floatingPnl}
          syncError={syncError}
          onSyncNow={onSyncNow}
          mt5={mt5}
          dateLocale={dateLocale}
        />
      </div>

      <div className="sync-hub-actions">
        <button type="button" className="btn-primary full sync-hub-primary" onClick={onSessionSummary}>
          {sessionButton}
        </button>
        <button type="button" className="btn-secondary full" onClick={onWeeklySummary}>
          {weeklyButton}
        </button>
        <div className="sync-hub-actions-row">
          <button type="button" className="btn-secondary" onClick={onImportExcel}>
            {importExcel}
          </button>
          <button type="button" className="btn-secondary" onClick={onCashForm}>
            {depositWithdraw}
          </button>
        </div>
        {onProjection && projectionLabel && (
          <button type="button" className="btn-secondary full" onClick={onProjection}>
            {projectionLabel}
          </button>
        )}
        {importMsg && <p className="import-msg sidebar-msg">{importMsg}</p>}
      </div>
    </div>
  )
}
