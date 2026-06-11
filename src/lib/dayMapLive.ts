import type { DayActivity, Mt5OpenPosition } from '../types/account'

export function mergeLiveDayMap(
  base: Map<string, DayActivity>,
  todayKey: string,
  openPositions: Mt5OpenPosition[],
): Map<string, DayActivity> {
  if (openPositions.length === 0) return base

  const livePnl = openPositions.reduce((s, p) => s + p.profit + (p.swap ?? 0), 0)
  const prev = base.get(todayKey)
  const next = new Map(base)

  next.set(todayKey, {
    date: todayKey,
    pnl: (prev?.pnl ?? 0) + livePnl,
    grossPnl: (prev?.grossPnl ?? 0) + livePnl,
    fees: prev?.fees ?? 0,
    trades: prev?.trades ?? 0,
    deposits: prev?.deposits ?? 0,
    withdraws: prev?.withdraws ?? 0,
    transfersIn: prev?.transfersIn ?? 0,
    transfersOut: prev?.transfersOut ?? 0,
    otherFees: prev?.otherFees ?? 0,
    netCash: prev?.netCash ?? 0,
    endBalance: prev?.endBalance ?? 0,
    openCount: openPositions.length,
    livePnl,
  })

  return next
}
