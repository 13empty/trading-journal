import { formatDistanceToNow } from 'date-fns'
import type { Locale } from 'date-fns'
import type { Mt5OpenPosition } from '../types/account'
import type { Mt5Status as Mt5StatusType } from '../lib/mt5Bridge'
import { formatMoney, pnlClass } from '../lib/aggregations'
import type { Translations } from '../i18n/types'
import { interpolate } from '../i18n'

interface Props {
  bridgeOnline: boolean
  mt5Connected: boolean
  status: Mt5StatusType | null
  lastSyncAt: number | null
  tradeCount: number
  liveTradeCount?: number
  usingLiveTrades?: boolean
  openPositions?: Mt5OpenPosition[]
  floatingPnl?: number
  onSyncNow: () => void
  syncError?: string | null
  mt5: Translations['mt5']
  dateLocale: Locale
}

export function Mt5StatusPanel({
  bridgeOnline,
  mt5Connected,
  status,
  lastSyncAt,
  tradeCount,
  liveTradeCount = 0,
  usingLiveTrades = false,
  openPositions = [],
  floatingPnl = 0,
  onSyncNow,
  syncError,
  mt5,
  dateLocale,
}: Props) {
  const tf = interpolate
  const state = !bridgeOnline ? 'offline' : mt5Connected ? 'connected' : 'waiting'

  return (
    <div className={`mt5-panel ${state}`}>
      <div className="mt5-status-bar" aria-hidden="true" />
      <div className="mt5-head">
        <span className={`mt5-dot ${state === 'connected' ? 'on' : state === 'waiting' ? 'wait' : 'off'}`} />
        <strong>{mt5.title}</strong>
      </div>

      {state === 'offline' && (
        <>
          <p className="mt5-msg">{mt5.bridgeOff}</p>
          <ol className="mt5-checklist">
            <li>
              {mt5.bridgeOffStep1.split(':')[0]}: <code>npm run bridge</code>
            </li>
            <li>
              {mt5.bridgeOffStep2.split(':')[0]}: <code>npm run dev:all</code>
            </li>
          </ol>
        </>
      )}

      {state === 'waiting' && (
        <>
          <p className="mt5-msg">{mt5.waiting}</p>
          <ol className="mt5-checklist">
            <li>{mt5.waitingStep1}</li>
            <li>{mt5.waitingStep2}</li>
            <li>{mt5.waitingStep3}</li>
            <li>
              Log: <code>{mt5.waitingStep4.replace('Log: ', '')}</code>
            </li>
          </ol>
        </>
      )}

      {state === 'connected' && (
        <>
          <p className="mt5-msg">
            {tf(mt5.accountTrades, { account: status?.account ?? '—', count: tradeCount })}
            {usingLiveTrades && (
              <span className="hint-text">
                {' '}
                · {tf(mt5.liveCalendar, { count: liveTradeCount })}
              </span>
            )}
          </p>
          {status?.balance != null && (
            <p className="mt5-balance">
              {mt5.balance} <strong>${status.balance.toFixed(2)}</strong>
              {status.equity != null && (
                <>
                  {' '}
                  · {mt5.equity} <strong>${status.equity.toFixed(2)}</strong>
                </>
              )}
            </p>
          )}
          {openPositions.length > 0 && (
            <p className={`mt5-balance ${pnlClass(floatingPnl)}`}>
              {tf(mt5.openPositions, { count: openPositions.length })}{' '}
              <strong>{formatMoney(floatingPnl)}</strong>
            </p>
          )}
          <p className="mt5-sync">{mt5.syncInterval}</p>
          {bridgeOnline && !usingLiveTrades && <p className="mt5-msg warn">{mt5.loadingTrades}</p>}
        </>
      )}

      {syncError && <p className="mt5-msg warn">{syncError}</p>}

      {lastSyncAt && (
        <p className="mt5-sync">
          {tf(mt5.lastSync, {
            time: formatDistanceToNow(lastSyncAt, { addSuffix: true, locale: dateLocale }),
          })}
        </p>
      )}

      <button type="button" className="btn-secondary full mt5-btn" onClick={onSyncNow} disabled={!bridgeOnline}>
        {mt5.syncNow}
      </button>
    </div>
  )
}
