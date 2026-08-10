import type { AccentTheme } from '../types/account'

export const ACCENT_THEMES: { id: AccentTheme; accent: string; dim: string }[] = [
  { id: 'blue', accent: '#58a6ff', dim: '#58a6ff1f' },
  { id: 'teal', accent: '#3dccc7', dim: '#3dccc71f' },
  { id: 'green', accent: '#3fb950', dim: '#3fb9501f' },
  { id: 'amber', accent: '#d29922', dim: '#d299221f' },
  { id: 'rose', accent: '#f778ba', dim: '#f778ba1f' },
]

export function applyAccentTheme(theme: AccentTheme | undefined): void {
  const preset = ACCENT_THEMES.find((t) => t.id === (theme ?? 'blue')) ?? ACCENT_THEMES[0]
  const root = document.documentElement
  root.style.setProperty('--accent', preset.accent)
  root.style.setProperty('--accent-dim', preset.dim)
  root.dataset.accent = preset.id
}
