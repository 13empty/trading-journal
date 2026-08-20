import type { ReactNode } from 'react'
import type { Translations } from '../i18n/types'

export type MainTab = 'calendar' | 'day' | 'analytics' | 'projection' | 'sync' | 'settings'

interface Props {
  active: MainTab
  onChange: (tab: MainTab) => void
  t: Translations['nav']
  brandTitle: string
  footer?: ReactNode
}

const ICONS: Record<MainTab, ReactNode> = {
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  day: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 4h11l3 3v13H5V4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 10h8M8 14h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  analytics: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 19V5M4 19h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 15v-4M12 15V8M16 15v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  projection: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 16l5-5 4 3 7-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 6h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  sync: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 0-13.5-5.8M4 12a8 8 0 0 0 13.5 5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M6.5 3.5V8H11M17.5 20.5V16H13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
}

const TABS: { id: MainTab; labelKey: keyof Translations['nav'] }[] = [
  { id: 'calendar', labelKey: 'calendar' },
  { id: 'day', labelKey: 'day' },
  { id: 'analytics', labelKey: 'analytics' },
  { id: 'sync', labelKey: 'sync' },
  { id: 'settings', labelKey: 'settings' },
]

export function SideNav({ active, onChange, t, brandTitle, footer }: Props) {
  return (
    <nav className="nav-rail" aria-label={brandTitle}>
      <div className="nav-rail-brand">
        <span className="logo">TJ</span>
        <span className="nav-rail-brand-text">{brandTitle}</span>
      </div>
      <div className="nav-rail-tabs" role="tablist" aria-orientation="vertical">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`nav-rail-btn${active === tab.id ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="nav-rail-btn-icon">{ICONS[tab.id]}</span>
            <span className="nav-rail-btn-label">{t[tab.labelKey]}</span>
          </button>
        ))}
      </div>
      {footer && <div className="nav-rail-footer">{footer}</div>}
    </nav>
  )
}
