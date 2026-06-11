/** Solo dia calendario (yyyy-MM-dd), sin cambiar por zona horaria del PC. */

const DEFAULT_SERVER_OFFSET_HOURS = Number(
  import.meta.env.VITE_MT5_SERVER_OFFSET_HOURS ?? 6,
)

export function brokerOffsetHours(): number {
  const n = DEFAULT_SERVER_OFFSET_HOURS
  return Number.isFinite(n) ? n : 3
}

/** yyyy-MM-dd → Date en mediodía local (evita que UTC corra el día en el calendario). */
export function parseLocalDateKey(dateStr: string): Date {
  const part = dateStr.trim().slice(0, 10)
  const [y, m, d] = part.split('-').map(Number)
  if (!y || !m || !d) return new Date()
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}
/** Extrae yyyy-MM-dd de texto MT5 (2026.06.03 o 2026-06-03 18:37:56). */
export function dateOnlyFromMt5String(value: string): string {
  const s = value.trim()
  const dotted = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/)
  if (dotted) return `${dotted[1]}-${dotted[2]}-${dotted[3]}`
  const dashed = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`
  return s.slice(0, 10)
}

/** Unix deal time → fecha en hora del servidor broker (IC ~ UTC+3). */
export function dateOnlyFromMt5Unix(seconds: number, offsetHours = brokerOffsetHours()): string {
  const ms = seconds * 1000 + offsetHours * 3600 * 1000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateOnlyFromMt5(value: string | number): string {
  if (typeof value === 'number') return dateOnlyFromMt5Unix(value)
  return dateOnlyFromMt5String(value)
}
