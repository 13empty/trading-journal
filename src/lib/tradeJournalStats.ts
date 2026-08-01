import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import { effectiveRR } from './analytics'

export interface DayJournalStats {
  total: number
  journaled: number
  withSetup: number
  withRisk: number
  withHours: number
  avgR: number | null
  setupPct: number
  riskPct: number
}

export function computeDayJournalStats(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
  tradeKey: (trade: Trade) => string,
): DayJournalStats | null {
  if (trades.length === 0) return null

  let journaled = 0
  let withSetup = 0
  let withRisk = 0
  let withHours = 0
  let rrSum = 0
  let rrCount = 0

  for (const trade of trades) {
    const meta = metaMap[tradeKey(trade)]
    if (!meta) continue

    if (
      meta.journalNotes?.trim() ||
      (meta.tags?.length ?? 0) > 0 ||
      meta.screenshotUrl?.trim() ||
      meta.chartLink?.trim()
    ) {
      journaled += 1
    }

    const checklist = meta.checklist
    if (checklist?.hadSetup) withSetup += 1
    if (checklist?.respectedRisk) withRisk += 1
    if (checklist?.inTradingHours) withHours += 1

    const rr = effectiveRR(trade, meta)
    if (rr != null) {
      rrSum += rr
      rrCount += 1
    }
  }

  const total = trades.length
  return {
    total,
    journaled,
    withSetup,
    withRisk,
    withHours,
    avgR: rrCount > 0 ? rrSum / rrCount : null,
    setupPct: (withSetup / total) * 100,
    riskPct: (withRisk / total) * 100,
  }
}

export function tradeHasJournalMeta(meta: TradeMeta | undefined): boolean {
  if (!meta) return false
  return Boolean(
    meta.journalNotes?.trim() ||
      (meta.tags?.length ?? 0) > 0 ||
      meta.screenshotUrl?.trim() ||
      meta.chartLink?.trim() ||
      meta.riskAmount != null ||
      meta.rrRatio != null ||
      meta.checklist?.hadSetup ||
      meta.checklist?.respectedRisk ||
      meta.checklist?.inTradingHours,
  )
}
