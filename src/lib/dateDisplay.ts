import { format } from 'date-fns'
import type { Locale } from 'date-fns'

/** Prepositions/articles kept lowercase in Spanish/Portuguese date phrases. */
const LOWERCASE_WORDS = new Set([
  'a',
  'e',
  'o',
  'u',
  'y',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'na',
  'no',
  'nas',
  'nos',
  'vs',
])

export function capitalizeDateLabel(text: string): string {
  if (!text) return text
  return text.replace(/[\p{L}\p{M}]+/gu, (word, offset) => {
    const lower = word.toLocaleLowerCase()
    if (offset > 0 && LOWERCASE_WORDS.has(lower)) return lower
    if (lower.length === 0) return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
}

export function formatDisplayDate(date: Date, pattern: string, locale?: Locale): string {
  const raw = format(date, pattern, locale ? { locale } : undefined)
  return capitalizeDateLabel(raw)
}

/** yyyy-MM → "Julio 2026" */
export function formatMonthKey(monthKey: string, locale?: Locale): string {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return formatDisplayDate(new Date(year, month - 1, 1), 'MMMM yyyy', locale)
}
