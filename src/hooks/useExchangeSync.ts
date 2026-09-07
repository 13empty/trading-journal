import { useCallback, useEffect, useRef, useState } from 'react'
import type { CashMovement, Mt5OpenPosition } from '../types/account'
import type { Trade } from '../types/trade'
import {
  deleteExchangeConnection,
  fetchExchangeCatalog,
  fetchExchangeConnections,
  saveExchangeConnection,
  syncExchanges,
  testExchangeConnection,
  type ExchangeCatalogItem,
  type ExchangeConnectionPublic,
  type ExchangeSyncResult,
} from '../lib/exchangeBridge'
import { mergeCashBySignature, mergeTrades } from '../lib/mergeTrades'

interface Options {
  trades: Trade[]
  cash: CashMovement[]
  onTrades: (trades: Trade[]) => void
  onCash: (cash: CashMovement[]) => void
}

const POLL_MS = 180_000

export function useExchangeSync({ trades, cash, onTrades, onCash }: Options) {
  const [catalog, setCatalog] = useState<ExchangeCatalogItem[]>([])
  const [connections, setConnections] = useState<ExchangeConnectionPublic[]>([])
  const [openPositions, setOpenPositions] = useState<Mt5OpenPosition[]>([])
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tradesRef = useRef(trades)
  const cashRef = useRef(cash)
  tradesRef.current = trades
  cashRef.current = cash

  const refreshList = useCallback(async () => {
    const [items, conns] = await Promise.all([fetchExchangeCatalog(), fetchExchangeConnections()])
    if (items.length) setCatalog(items)
    setConnections(conns)
    return conns
  }, [])

  const applyResults = useCallback(
    (results: Awaited<ReturnType<typeof syncExchanges>>) => {
      const okRows = results.filter((r: ExchangeSyncResult) => r.ok)
      const incomingTrades = okRows.flatMap((r: ExchangeSyncResult) => r.trades || [])
      const incomingCash = okRows.flatMap((r: ExchangeSyncResult) => r.cash || [])
      const incomingOpen = okRows.flatMap((r: ExchangeSyncResult) => r.openPositions || [])
      setOpenPositions(incomingOpen)
      if (incomingTrades.length) onTrades(mergeTrades(tradesRef.current, incomingTrades))
      if (incomingCash.length) onCash(mergeCashBySignature(cashRef.current, incomingCash))
      const firstErr = results.find((r: ExchangeSyncResult) => !r.ok)?.error
      setError(firstErr || null)
    },
    [onTrades, onCash],
  )

  const syncNow = useCallback(
    async (id?: string) => {
      setSyncing(true)
      try {
        const results = await syncExchanges(id)
        applyResults(results)
        await refreshList()
        return results
      } finally {
        setSyncing(false)
      }
    },
    [applyResults, refreshList],
  )

  const saveConnection = useCallback(
    async (payload: Parameters<typeof saveExchangeConnection>[0]) => {
      const result = await saveExchangeConnection(payload)
      await refreshList()
      return result
    },
    [refreshList],
  )

  const removeConnection = useCallback(
    async (id: string) => {
      const ok = await deleteExchangeConnection(id)
      await refreshList()
      return ok
    },
    [refreshList],
  )

  const testConnection = useCallback(async (payload: Parameters<typeof testExchangeConnection>[0]) => {
    return testExchangeConnection(payload)
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    if (connections.length === 0) return
    void syncNow()
    const id = setInterval(() => {
      void syncNow()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [connections.length, syncNow])

  const floatingPnl = openPositions.reduce((s, p) => s + (p.profit || 0) + (p.swap ?? 0), 0)
  const balanceSum = connections.reduce((s, c) => s + (c.balance ?? 0), 0)
  const hasBalance = connections.some((c) => c.balance != null)

  return {
    catalog,
    connections,
    openPositions,
    floatingPnl,
    balanceSum,
    hasBalance,
    syncing,
    error,
    refreshList,
    syncNow,
    saveConnection,
    removeConnection,
    testConnection,
  }
}
