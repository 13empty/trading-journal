import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import { effectiveMaeR, effectiveMfeR, realizedR, tradeMetaKey } from './analytics'

export interface ExcursionInsight {
  kind: 'left_on_table' | 'sl_tight' | 'ok'
  /** R left on table (mfeR − closedR) when favorable */
  leftOnTableR?: number
  mfeR?: number
  maeR?: number
  closedR?: number | null
}

/** Closed R for excursion math (signed). */
export function closedR(trade: Trade, meta?: TradeMeta): number | null {
  return realizedR(trade, meta)
}

export function excursionInsight(trade: Trade, meta?: TradeMeta): ExcursionInsight | null {
  const mfeR = effectiveMfeR(trade, meta) ?? undefined
  const maeR = effectiveMaeR(trade, meta) ?? undefined
  if (mfeR == null && maeR == null) return null

  const closed = closedR(trade, meta)
  const out: ExcursionInsight = {
    kind: 'ok',
    mfeR,
    maeR,
    closedR: closed,
  }

  if (mfeR != null && mfeR > 0 && closed != null) {
    const left = mfeR - closed
    if (left >= 0.5) {
      out.kind = 'left_on_table'
      out.leftOnTableR = left
      return out
    }
  }

  // Hit nearly full risk against before close → SL possibly too tight
  if (maeR != null && maeR >= 0.85) {
    out.kind = 'sl_tight'
    return out
  }

  return out
}

export interface ExcursionAggregate {
  sampleCount: number
  avgMfeR: number | null
  avgMaeR: number | null
  avgLeftOnTableR: number | null
  leftOnTableCount: number
  leftOnTablePct: number
  slTightCount: number
  slTightPct: number
  /** By setup: avg R left on table */
  bySetup: Array<{
    setup: string
    trades: number
    avgLeftOnTableR: number
    avgMfeR: number
    avgClosedR: number
  }>
}

export function computeExcursionStats(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
): ExcursionAggregate {
  let mfeSum = 0
  let mfeN = 0
  let maeSum = 0
  let maeN = 0
  let leftSum = 0
  let leftN = 0
  let leftCount = 0
  let slTight = 0
  let sample = 0

  type SetupAcc = {
    trades: number
    leftSum: number
    leftN: number
    mfeSum: number
    mfeN: number
    closedSum: number
    closedN: number
  }
  const bySetup = new Map<string, SetupAcc>()

  for (const t of trades) {
    const meta = metaMap[tradeMetaKey(t)]
    const mfe = effectiveMfeR(t, meta)
    const mae = effectiveMaeR(t, meta)
    const has = mfe != null || mae != null
    if (!has) continue
    sample += 1

    if (mfe != null && Number.isFinite(mfe)) {
      mfeSum += mfe
      mfeN += 1
    }
    if (mae != null && Number.isFinite(mae)) {
      maeSum += mae
      maeN += 1
    }

    const insight = excursionInsight(t, meta)
    if (insight?.kind === 'left_on_table' && insight.leftOnTableR != null) {
      leftCount += 1
      leftSum += insight.leftOnTableR
      leftN += 1
    }
    if (insight?.kind === 'sl_tight') slTight += 1

    const setup = meta?.setup?.trim()
    if (setup) {
      const acc = bySetup.get(setup) ?? {
        trades: 0,
        leftSum: 0,
        leftN: 0,
        mfeSum: 0,
        mfeN: 0,
        closedSum: 0,
        closedN: 0,
      }
      acc.trades += 1
      if (mfe != null) {
        acc.mfeSum += mfe
        acc.mfeN += 1
      }
      const cr = closedR(t, meta)
      if (cr != null) {
        acc.closedSum += cr
        acc.closedN += 1
      }
      if (insight?.leftOnTableR != null && insight.leftOnTableR > 0) {
        acc.leftSum += insight.leftOnTableR
        acc.leftN += 1
      }
      bySetup.set(setup, acc)
    }
  }

  return {
    sampleCount: sample,
    avgMfeR: mfeN ? mfeSum / mfeN : null,
    avgMaeR: maeN ? maeSum / maeN : null,
    avgLeftOnTableR: leftN ? leftSum / leftN : null,
    leftOnTableCount: leftCount,
    leftOnTablePct: sample ? (leftCount / sample) * 100 : 0,
    slTightCount: slTight,
    slTightPct: sample ? (slTight / sample) * 100 : 0,
    bySetup: [...bySetup.entries()]
      .map(([setup, a]) => ({
        setup,
        trades: a.trades,
        avgLeftOnTableR: a.leftN ? a.leftSum / a.leftN : 0,
        avgMfeR: a.mfeN ? a.mfeSum / a.mfeN : 0,
        avgClosedR: a.closedN ? a.closedSum / a.closedN : 0,
      }))
      .filter((x) => x.avgLeftOnTableR > 0 || x.avgMfeR > 0)
      .sort((a, b) => b.avgLeftOnTableR - a.avgLeftOnTableR)
      .slice(0, 5),
  }
}
