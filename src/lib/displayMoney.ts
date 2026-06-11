/** Dinero que entra a la cuenta (depósitos) */
export function formatInflow(amount: number): string {
  if (amount <= 0) return '—'
  return `$${amount.toFixed(2)}`
}

/** Dinero que sale de la cuenta (retiros) — monto positivo, no es una pérdida de trading */
export function formatOutflow(amount: number): string {
  if (amount <= 0) return '—'
  return `$${amount.toFixed(2)}`
}

export function outflowHint(): string {
  return 'Dinero que retiraste de la cuenta (reduce el saldo en MT5; no es pérdida de trades).'
}

import { cashMovementKey } from './mergeTrades'
import type { DayActivity } from '../types/account'

export function sumDayOutflow(
  dayCash: { category: string; amount: number; notes: string; date: string; type: string }[],
  selectedDay: Pick<DayActivity, 'withdraws' | 'transfersOut' | 'otherFees'>,
): number {
  const outCategories = new Set(['withdraw', 'transfer_out', 'fee'])
  if (dayCash.length > 0) {
    const seen = new Set<string>()
    let total = 0
    for (const c of dayCash) {
      if (!outCategories.has(c.category)) continue
      const key = cashMovementKey(c)
      if (seen.has(key)) continue
      seen.add(key)
      total += c.amount
    }
    return total
  }
  return selectedDay.withdraws + selectedDay.transfersOut + selectedDay.otherFees
}
