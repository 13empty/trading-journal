import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import {
  effectiveMfeR,
  effectiveStopLoss,
  effectiveTakeProfit,
  tradeMetaKey,
} from './analytics'

/** Within this fraction of the SL distance, the exit counts as "at" the level. */
const AT_LEVEL = 0.12
/** Within this fraction of risk from entry, the exit is a scratch. */
const SCRATCH = 0.15
const MIN_SAMPLE = 5

export type ExitKind =
  | 'hit_tp'
  | 'early_profit'
  | 'hit_sl'
  | 'early_cut'
  | 'scratch'
  | 'sl_overrun'
  | 'profit_no_tp'
  | 'loss_no_sl'

export type ExitDiagnosis =
  | 'no_data'
  | 'on_plan'
  | 'early_profit_full_sl'
  | 'early_both'
  | 'early_profit_only'
  | 'early_cut_ok'
  | 'too_many_scratches'
  | 'mixed'

export interface ExitPlanRow {
  trade: Trade
  kind: ExitKind
  /** Favorable price move (positive = profit). */
  move: number
  /** Fraction of the path to TP that was captured (0–1+). */
  tpCapture: number | null
  /** Signed R of the exit vs the SL distance. */
  exitR: number | null
  /** Planned reward in R (TP distance / SL distance). */
  plannedTpR: number | null
  /** Price reached about the TP while the trade was open. */
  priceReachedTp: boolean
}

export interface ExitPlanStats {
  sample: number
  withTp: number
  withSl: number
  hitTp: number
  earlyProfit: number
  hitSl: number
  earlyCut: number
  scratch: number
  slOverrun: number
  /** Early-profit exits as % of trades that had a TP. */
  earlyProfitPct: number
  hitTpPct: number
  /** Early cuts as % of trades that had an SL. */
  earlyCutPct: number
  hitSlPct: number
  scratchPct: number
  /** Mean share of the TP path captured on early-profit exits (0–100). */
  avgCapturePct: number | null
  /** Mean exit R on early cuts (negative). */
  avgCutR: number | null
  /** Sum of R left versus the planned TP on early-profit exits. */
  rLeft: number | null
  /** Sum of R saved versus a full −1R stop on early cuts. */
  rSaved: number | null
  /** Early profits where MFE already reached the TP. */
  reachedTpThenLeft: number
  diagnosis: ExitDiagnosis
  rows: ExitPlanRow[]
}

function levelDistance(
  entry: number,
  level: number,
  side: Trade['side'],
  kind: 'sl' | 'tp',
): number | null {
  if (!(entry > 0) || !(level > 0) || level === entry) return null
  const favorable = side === 'short' ? entry - level : level - entry
  if (kind === 'tp' && favorable <= 0) return null
  if (kind === 'sl' && favorable >= 0) return null
  const dist = Math.abs(entry - level)
  return dist > 0 ? dist : null
}

export function classifyExit(trade: Trade, meta?: TradeMeta): ExitPlanRow | null {
  const entry = trade.entryPrice
  const exit = trade.exitPrice
  if (!(entry > 0) || !(exit > 0)) return null

  const move = trade.side === 'short' ? entry - exit : exit - entry
  const sl = effectiveStopLoss(trade, meta)
  const tp = effectiveTakeProfit(trade, meta)
  const risk = sl != null ? levelDistance(entry, sl, trade.side, 'sl') : null
  const reward = tp != null ? levelDistance(entry, tp, trade.side, 'tp') : null
  if (risk == null && reward == null) return null

  const plannedTpR = risk != null && reward != null ? reward / risk : null
  const exitR = risk != null ? move / risk : null
  const tpCapture = reward != null ? move / reward : null
  const mfe = effectiveMfeR(trade, meta)
  const priceReachedTp =
    plannedTpR != null && mfe != null && Number.isFinite(mfe) && mfe >= plannedTpR * 0.9

  const base = { trade, move, tpCapture, exitR, plannedTpR, priceReachedTp }

  const tolRisk = risk != null ? risk * AT_LEVEL : 0
  const tolReward = reward != null ? reward * AT_LEVEL : 0

  if (risk != null && move <= -(risk - tolRisk)) {
    const kind: ExitKind = move < -(risk + tolRisk) ? 'sl_overrun' : 'hit_sl'
    return { ...base, kind }
  }
  if (reward != null && move >= reward - tolReward) {
    return { ...base, kind: 'hit_tp' }
  }
  if (risk != null && Math.abs(move) <= Math.max(risk * SCRATCH, tolRisk)) {
    return { ...base, kind: 'scratch' }
  }
  if (move > 0 && reward != null && move < reward - tolReward) {
    return { ...base, kind: 'early_profit' }
  }
  if (move < 0 && risk != null && move > -(risk - tolRisk)) {
    return { ...base, kind: 'early_cut' }
  }
  if (move > 0 && reward == null) return { ...base, kind: 'profit_no_tp' }
  if (move < 0 && risk == null) return { ...base, kind: 'loss_no_sl' }
  return null
}

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0
}

function diagnose(s: Omit<ExitPlanStats, 'diagnosis' | 'rows'>): ExitDiagnosis {
  if (s.sample < MIN_SAMPLE) return 'no_data'

  const winnersWithTp = s.hitTp + s.earlyProfit
  const earlyAmongWinners = winnersWithTp > 0 ? s.earlyProfit / winnersWithTp : 0

  if (
    winnersWithTp >= 3 &&
    earlyAmongWinners >= 0.5 &&
    s.withSl >= 3 &&
    s.hitSl / s.withSl >= 0.45 &&
    s.earlyCut / s.withSl < 0.35
  ) {
    return 'early_profit_full_sl'
  }
  if (s.withTp >= 3 && s.earlyProfitPct >= 35 && s.withSl >= 3 && s.earlyCutPct >= 35) {
    return 'early_both'
  }
  if (s.withTp >= 3 && s.earlyProfitPct >= 40 && s.hitTpPct < 35) {
    return 'early_profit_only'
  }
  if (
    s.withSl >= 3 &&
    s.earlyCutPct >= 40 &&
    s.hitTpPct >= 40 &&
    s.earlyProfitPct < 30
  ) {
    return 'early_cut_ok'
  }
  if (s.scratchPct >= 35) return 'too_many_scratches'

  const onPlan = s.hitTp + s.hitSl
  if (onPlan / s.sample >= 0.6 && s.earlyProfitPct < 25 && s.earlyCutPct < 25) {
    return 'on_plan'
  }
  return 'mixed'
}

export function computeExitPlan(
  trades: Trade[],
  metaMap: Record<string, TradeMeta>,
): ExitPlanStats {
  const rows: ExitPlanRow[] = []
  for (const trade of trades) {
    const row = classifyExit(trade, metaMap[tradeMetaKey(trade)])
    if (row) rows.push(row)
  }

  let hitTp = 0
  let earlyProfit = 0
  let hitSl = 0
  let earlyCut = 0
  let scratch = 0
  let slOverrun = 0
  let captureSum = 0
  let captureN = 0
  let cutSum = 0
  let cutN = 0
  let rLeft = 0
  let rLeftN = 0
  let rSaved = 0
  let rSavedN = 0
  let reachedTpThenLeft = 0

  for (const row of rows) {
    if (row.kind === 'hit_tp') hitTp += 1
    if (row.kind === 'early_profit') {
      earlyProfit += 1
      if (row.tpCapture != null) {
        captureSum += Math.max(0, row.tpCapture)
        captureN += 1
      }
      if (row.plannedTpR != null && row.exitR != null) {
        rLeft += Math.max(0, row.plannedTpR - row.exitR)
        rLeftN += 1
      }
      if (row.priceReachedTp) reachedTpThenLeft += 1
    }
    if (row.kind === 'hit_sl') hitSl += 1
    if (row.kind === 'early_cut') {
      earlyCut += 1
      if (row.exitR != null) {
        cutSum += row.exitR
        cutN += 1
        rSaved += Math.max(0, 1 + row.exitR)
        rSavedN += 1
      }
    }
    if (row.kind === 'scratch') scratch += 1
    if (row.kind === 'sl_overrun') slOverrun += 1
  }

  let withTp = 0
  let withSl = 0
  for (const row of rows) {
    if (row.tpCapture != null) withTp += 1
    if (row.exitR != null) withSl += 1
  }

  const partial = {
    sample: rows.length,
    withTp,
    withSl,
    hitTp,
    earlyProfit,
    hitSl,
    earlyCut,
    scratch,
    slOverrun,
    earlyProfitPct: pct(earlyProfit, withTp),
    hitTpPct: pct(hitTp, withTp),
    earlyCutPct: pct(earlyCut, withSl),
    hitSlPct: pct(hitSl, withSl),
    scratchPct: pct(scratch, rows.length),
    avgCapturePct: captureN ? (captureSum / captureN) * 100 : null,
    avgCutR: cutN ? cutSum / cutN : null,
    rLeft: rLeftN ? rLeft : null,
    rSaved: rSavedN ? rSaved : null,
    reachedTpThenLeft,
  }

  return { ...partial, diagnosis: diagnose(partial), rows }
}
