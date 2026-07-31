import { addDays, format, startOfWeek } from 'date-fns'
import type { Locale } from 'date-fns'

import { capitalizeDateLabel } from './dateDisplay'

/** Cabeceras lun–dom según idioma (es: Lu Ma Mi Ju Vi Sá Do — sin X confusa). */
export function weekdayHeaders(dateLocale: Locale): string[] {
  const monday = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => {
    const raw = format(addDays(monday, i), 'EEEEEE', { locale: dateLocale })
    if (!raw) return ''
    return capitalizeDateLabel(raw)
  })
}
