import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AppLanguage, Translations } from './types'
import { getDateLocale, getTranslations, interpolate } from './index'
import type { Locale } from 'date-fns'

interface I18nContextValue {
  lang: AppLanguage
  t: Translations
  dateLocale: Locale
  tf: (template: string, vars: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  language,
  children,
}: {
  language: AppLanguage
  children: ReactNode
}) {
  const value = useMemo((): I18nContextValue => {
    const t = getTranslations(language)
    return {
      lang: language,
      t,
      dateLocale: getDateLocale(language),
      tf: interpolate,
    }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
