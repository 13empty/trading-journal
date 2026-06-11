import { enUS, es, ptBR } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import type { AppLanguage, Translations } from './types'
import { es as esT } from './locales/es'
import { en as enT } from './locales/en'
import { pt as ptT } from './locales/pt'

const catalogs: Record<AppLanguage, Translations> = {
  es: esT,
  en: enT,
  pt: ptT,
}

export function getTranslations(lang: AppLanguage): Translations {
  return catalogs[lang] ?? catalogs.es
}

export function getDateLocale(lang: AppLanguage): Locale {
  switch (lang) {
    case 'en':
      return enUS
    case 'pt':
      return ptBR
    default:
      return es
  }
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

export type { AppLanguage, Translations }
export { SUPPORTED_LANGUAGES } from './types'
