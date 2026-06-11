import { useCallback, useEffect, useRef, useState } from 'react'
import type { CashMovement, Mt5OpenPosition } from '../types/account'
import type { AppSettings } from '../types/account'
import type { Trade } from '../types/trade'
import { netTradePnl, normalizeDayKey } from '../lib/account'
import {
  connectMt5WebSocket,
  fetchMt5Status,
  fetchMt5Sync,
  reloadBridgeFromDisk,
  type Mt5Status,
  type Mt5SyncPayload,
} from '../lib/mt5Bridge'
import {
  dedupeCashMovements,
  mergeCashBySignature,
  mergeMt5Live,
  replaceMt5FromBridge,
} from '../lib/mergeTrades'
import { getTranslations } from '../i18n'
import { tradesListKey } from '../lib/tradeSort'

interface UseMt5SyncOptions {
  trades: Trade[]
  cash: CashMovement[]
  settings: AppSettings
  onTrades: (trades: Trade[]) => void
  onCash: (cash: CashMovement[]) => void
  onSettings: (settings: AppSettings) => void
  language?: import('../i18n/types').AppLanguage
}

type RawTrade = Trade & { side?: string; id?: string }

function normalizeBridgeTrades(raw: Trade[], account?: string | null): Trade[] {
  return raw.map((t) => {
    const r = t as RawTrade
    const pid = r.positionId || String(r.id ?? '')
    const sideRaw = String(r.side ?? '')
    let side: Trade['side'] = r.side === 'long' || r.side === 'short' ? r.side : 'long'
    if (sideRaw === 'buy') side = 'long'
    if (sideRaw === 'sell') side = 'short'
    return {
      ...r,
      side,
      date: normalizeDayKey(r.date),
      positionId: pid || undefined,
      notes: r.notes || (pid ? `MT5 #${pid}` : r.notes),
      openTime: r.openTime,
      closeTime: r.closeTime,
      swap: r.swap,
      commission: r.commission,
      accountId: r.accountId ?? account ?? undefined,
    }
  })
}

function normalizeBridgeCash(raw: CashMovement[]): CashMovement[] {
  return raw.map((c) => ({
    ...c,
    date: normalizeDayKey(c.date),
    id: c.id || `mt5-${c.date}-${c.category}-${c.amount}-${c.notes.slice(0, 24)}`,
    amount: Math.abs(c.amount),
  }))
}

export function useMt5Sync({
  trades,
  cash,
  settings,
  onTrades,
  onCash,
  onSettings,
  language = 'es',
}: UseMt5SyncOptions) {
  const [mt5Status, setMt5Status] = useState<Mt5Status | null>(null)
  const [bridgeOnline, setBridgeOnline] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [bridgeTradeCount, setBridgeTradeCount] = useState(0)
  const [bridgeTrades, setBridgeTrades] = useState<Trade[]>([])
  const [bridgeCash, setBridgeCash] = useState<CashMovement[]>([])
  const [openPositions, setOpenPositions] = useState<Mt5OpenPosition[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const tradesRef = useRef(trades)
  const cashRef = useRef(cash)
  const settingsRef = useRef(settings)

  tradesRef.current = trades
  cashRef.current = cash
  settingsRef.current = settings

  const applyBalanceToSettings = useCallback(
    (payload: Mt5SyncPayload, settingsNext: AppSettings) => {
      let changed = false
      if (payload.balance != null) {
        settingsNext.brokerBalance = payload.balance
        changed = true
      }
      if (payload.equity != null) {
        settingsNext.brokerEquity = payload.equity
        changed = true
      }
      return changed
    },
    [],
  )

  const applyFullBridgeState = useCallback(
    (payload: Mt5SyncPayload) => {
      const tradeList = normalizeBridgeTrades(payload.trades ?? [], payload.account)
      const cashList = dedupeCashMovements(normalizeBridgeCash(payload.cashMovements ?? []))

      setBridgeTrades(tradeList)
      setBridgeCash(cashList)

      const mergedTrades = replaceMt5FromBridge(tradesRef.current, tradeList)
      const tradesChanged = tradesListKey(mergedTrades) !== tradesListKey(tradesRef.current)

      const settingsNext: AppSettings = { ...settingsRef.current }
      applyBalanceToSettings(payload, settingsNext)
      settingsNext.mt5NetProfit = netTradePnl(mergedTrades)
      if (payload.account) {
        settingsNext.accountLabel = `MT5 ${payload.account}`
        const known = new Set(settingsNext.knownAccounts ?? [])
        known.add(String(payload.account))
        settingsNext.knownAccounts = [...known]
      }

      setBridgeTrades(tradeList)
      if (tradesChanged) onTrades(mergedTrades)
      onCash(cashList)
      onSettings(settingsNext)
    },
    [applyBalanceToSettings, onTrades, onCash, onSettings],
  )

  const applyPayload = useCallback(
    (payload: Mt5SyncPayload) => {
      setSyncError(null)
      if (payload.tradeCount != null) setBridgeTradeCount(payload.tradeCount)
      if (payload.openPositions) setOpenPositions(payload.openPositions)

      const isFull = Boolean(payload.full) && !payload.light && !payload.patch

      if (payload.light) {
        const settingsNext: AppSettings = { ...settingsRef.current }
        if (applyBalanceToSettings(payload, settingsNext)) onSettings(settingsNext)
        setLastSyncAt(Date.now())
        return
      }

      if (isFull) {
        applyFullBridgeState(payload)
        setLastSyncAt(Date.now())
        return
      }

      const settingsNext: AppSettings = { ...settingsRef.current }
      let settingsChanged = applyBalanceToSettings(payload, settingsNext)

      const tradeList = payload.trades ?? []
      if (tradeList.length > 0) {
        const normalized = normalizeBridgeTrades(tradeList, payload.account)
        setBridgeTrades((prev) => mergeMt5Live(prev, normalized))
        const merged = mergeMt5Live(tradesRef.current, normalized)
        settingsNext.mt5NetProfit = netTradePnl(merged)
        if (tradesListKey(merged) !== tradesListKey(tradesRef.current)) {
          settingsChanged = true
          onTrades(merged)
        }
      }

      if (payload.cashMovements && payload.cashMovements.length > 0) {
        const mergedCash = dedupeCashMovements(
          mergeCashBySignature(cashRef.current, normalizeBridgeCash(payload.cashMovements)),
        )
        setBridgeCash(mergedCash)
        onCash(mergedCash)
      }

      if (settingsChanged) onSettings(settingsNext)
      setLastSyncAt(Date.now())
    },
    [applyBalanceToSettings, applyFullBridgeState, onTrades, onCash, onSettings],
  )

  const pullFullSync = useCallback(async () => {
    try {
      const data = await fetchMt5Sync()
      if (!data) {
        setSyncError(getTranslations(language).mt5.bridgeOfflineError)
        return false
      }
      applyPayload({
        trades: data.trades ?? [],
        cashMovements: data.cashMovements ?? [],
        balance: data.balance,
        equity: data.equity,
        openPositions: data.openPositions,
        account: data.account,
        full: true,
        tradeCount: data.tradeCount ?? data.trades?.length ?? 0,
      })
      return true
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Error de sync')
      return false
    }
  }, [applyPayload, language])

  const verifyAll = useCallback(async () => {
    setVerifying(true)
    try {
      const status = await fetchMt5Status()
      setBridgeOnline(status !== null)
      setMt5Status(status)
      if (status?.tradeCount != null) setBridgeTradeCount(status.tradeCount)
      if (status !== null) await reloadBridgeFromDisk()
      await pullFullSync()
    } finally {
      setVerifying(false)
    }
  }, [pullFullSync])

  useEffect(() => {
    const poll = async () => {
      const status = await fetchMt5Status()
      setBridgeOnline(status !== null)
      setMt5Status(status)
      if (status?.tradeCount != null) setBridgeTradeCount(status.tradeCount)
      if (status?.balance != null || status?.equity != null) {
        onSettings({
          ...settingsRef.current,
          brokerBalance: status.balance ?? settingsRef.current.brokerBalance,
          brokerEquity: status.equity ?? settingsRef.current.brokerEquity,
        })
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [onSettings])

  useEffect(() => {
    if (!bridgeOnline) return
    void pullFullSync()
    const id = setInterval(() => void pullFullSync(), 3000)
    return () => clearInterval(id)
  }, [bridgeOnline, pullFullSync])

  useEffect(() => {
    return connectMt5WebSocket((payload) => applyPayload(payload))
  }, [applyPayload])

  const floatingPnl = openPositions.reduce((s, p) => s + p.profit + (p.swap ?? 0), 0)
  const hasBridgeData = bridgeTrades.length > 0 || bridgeTradeCount > 0

  return {
    mt5Status,
    bridgeOnline,
    mt5Connected: Boolean(mt5Status?.connected),
    lastSyncAt,
    bridgeTradeCount,
    bridgeTrades,
    bridgeCash,
    hasBridgeData,
    openPositions,
    floatingPnl,
    syncError,
    verifying,
    pullFullSync,
    verifyAll,
  }
}
