import type { AppearanceId, CustomPalette, PaletteKey } from '../types/account'

export interface AppearancePreset {
  id: AppearanceId
  /** CSS variables applied to :root */
  vars: Record<string, string>
  /** Windows titleBarOverlay colors */
  titleBar: { color: string; symbolColor: string }
}

const FONT_UI = 'Segoe UI, system-ui, -apple-system, sans-serif'

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: 'midnight',
    titleBar: { color: '#0c0a0c', symbolColor: '#ffe8ea' },
    vars: {
      '--bg': '#07080c',
      '--surface': '#101014',
      '--surface-elevated': '#18181e',
      '--border': '#4a2230',
      '--text': '#f4f0f1',
      '--muted': '#9a9096',
      '--accent': '#ff2d3d',
      '--accent-dim': '#ff2d3d28',
      '--green': '#3dd68c',
      '--red': '#ff4d5e',
      '--shadow-sm': '0 0 16px #ff2d3d1c',
      '--shadow-md': '0 0 28px #ff2d3d2e',
      '--scrollbar-thumb': '#3a404c',
      '--scrollbar-thumb-hover': '#505868',
      '--font': FONT_UI,
      '--font-display': FONT_UI,
    },
  },
  {
    id: 'graphite',
    titleBar: { color: '#1c1c1e', symbolColor: '#f2f2f7' },
    vars: {
      '--bg': '#121214',
      '--surface': '#1c1c1e',
      '--surface-elevated': '#2c2c2e',
      '--border': '#3a3a3c',
      '--text': '#f5f5f7',
      '--muted': '#98989f',
      '--accent': '#0a84ff',
      '--accent-dim': '#0a84ff22',
      '--green': '#30d158',
      '--red': '#ff453a',
      '--shadow-sm': '0 2px 12px #00000040',
      '--shadow-md': '0 4px 24px #00000050',
      '--scrollbar-thumb': '#48484a',
      '--scrollbar-thumb-hover': '#636366',
      '--font': `"Space Grotesk", ${FONT_UI}`,
      '--font-display': `"Space Grotesk", ${FONT_UI}`,
    },
  },
  {
    id: 'cyber',
    titleBar: { color: '#0a0f1c', symbolColor: '#7df9ff' },
    vars: {
      '--bg': '#05070f',
      '--surface': '#0a1020',
      '--surface-elevated': '#111a30',
      '--border': '#1a3358',
      '--text': '#e6f4ff',
      '--muted': '#7a93b5',
      '--accent': '#00e5ff',
      '--accent-dim': '#00e5ff24',
      '--green': '#39ff14',
      '--red': '#ff2d6a',
      '--shadow-sm': '0 0 16px #00e5ff14',
      '--shadow-md': '0 0 28px #00e5ff22',
      '--scrollbar-thumb': '#1e3a5f',
      '--scrollbar-thumb-hover': '#2a5080',
      '--font': `Cascadia Code, Consolas, "Sora", ${FONT_UI}`,
      '--font-display': `"Orbitron", Cascadia Code, Consolas, ${FONT_UI}`,
    },
  },
  {
    id: 'crimson',
    titleBar: { color: '#0e0e10', symbolColor: '#f0f0f3' },
    vars: {
      '--bg': '#0e0e10',
      '--surface': '#1c1c22',
      '--surface-elevated': '#2a2a32',
      '--border': '#6a6a78',
      '--text': '#f0f0f3',
      '--muted': '#888890',
      '--accent': '#ff375f',
      '--accent-dim': '#ff375f28',
      '--green': '#39ff14',
      '--red': '#ff375f',
      '--shadow-sm': '0 0 16px #ff375f16',
      '--shadow-md': '0 0 28px #ff375f22',
      '--scrollbar-thumb': '#2a2a30',
      '--scrollbar-thumb-hover': '#3d3d46',
      '--font': `Cascadia Code, Consolas, "Sora", ${FONT_UI}`,
      '--font-display': `"Orbitron", Cascadia Code, Consolas, ${FONT_UI}`,
    },
  },
  {
    id: 'ember',
    titleBar: { color: '#1a1008', symbolColor: '#ffd9a8' },
    vars: {
      '--bg': '#0c0906',
      '--surface': '#16100a',
      '--surface-elevated': '#22180f',
      '--border': '#4a3420',
      '--text': '#fff1e0',
      '--muted': '#a89078',
      '--accent': '#f59e0b',
      '--accent-dim': '#f59e0b24',
      '--green': '#4ade80',
      '--red': '#f87171',
      '--shadow-sm': '0 2px 16px #f59e0b14',
      '--shadow-md': '0 6px 28px #92400e22',
      '--scrollbar-thumb': '#5c4028',
      '--scrollbar-thumb-hover': '#7a5638',
      '--font': `"Outfit", ${FONT_UI}`,
      '--font-display': `"Outfit", ${FONT_UI}`,
    },
  },
  {
    id: 'aurora',
    titleBar: { color: '#120e1c', symbolColor: '#e9d5ff' },
    vars: {
      '--bg': '#08060f',
      '--surface': '#110e1c',
      '--surface-elevated': '#1a1528',
      '--border': '#3b2f5c',
      '--text': '#f3e8ff',
      '--muted': '#9b8bb8',
      '--accent': '#a855f7',
      '--accent-dim': '#a855f726',
      '--green': '#4ade80',
      '--red': '#f472b6',
      '--shadow-sm': '0 0 18px #a855f716',
      '--shadow-md': '0 0 32px #7c3aed22',
      '--scrollbar-thumb': '#3f3360',
      '--scrollbar-thumb-hover': '#5b4a82',
      '--font': `"Syne", ${FONT_UI}`,
      '--font-display': `"Syne", ${FONT_UI}`,
    },
  },
  {
    id: 'terminal',
    titleBar: { color: '#0a120a', symbolColor: '#86efac' },
    vars: {
      '--bg': '#050805',
      '--surface': '#0a120a',
      '--surface-elevated': '#101a10',
      '--border': '#1f3d24',
      '--text': '#d1fae5',
      '--muted': '#6b9b78',
      '--accent': '#22c55e',
      '--accent-dim': '#22c55e22',
      '--green': '#4ade80',
      '--red': '#f87171',
      '--shadow-sm': '0 0 14px #22c55e12',
      '--shadow-md': '0 0 24px #16a34a18',
      '--scrollbar-thumb': '#1e3d26',
      '--scrollbar-thumb-hover': '#2d5a38',
      '--font': `"JetBrains Mono", Cascadia Code, Consolas, monospace`,
      '--font-display': `"JetBrains Mono", monospace`,
    },
  },
  {
    id: 'slate',
    titleBar: { color: '#e8ecf1', symbolColor: '#1f2937' },
    vars: {
      '--bg': '#e4e9ef',
      '--surface': '#f1f4f8',
      '--surface-elevated': '#dde3ea',
      '--border': '#c5ced8',
      '--text': '#1e293b',
      '--muted': '#64748b',
      '--accent': '#2563eb',
      '--accent-dim': '#2563eb18',
      '--green': '#15803d',
      '--red': '#b91c1c',
      '--shadow-sm': '0 2px 10px #1e293b12',
      '--shadow-md': '0 4px 18px #1e293b18',
      '--scrollbar-thumb': '#a8b4c4',
      '--scrollbar-thumb-hover': '#7e8fa3',
      '--font': `"Sora", ${FONT_UI}`,
      '--font-display': `"Sora", ${FONT_UI}`,
    },
  },
  {
    id: 'light',
    titleBar: { color: '#ffffff', symbolColor: '#1f2328' },
    vars: {
      '--bg': '#f6f8fa',
      '--surface': '#ffffff',
      '--surface-elevated': '#eef1f4',
      '--border': '#d0d7de',
      '--text': '#1f2328',
      '--muted': '#656d76',
      '--accent': '#0969da',
      '--accent-dim': '#0969da1a',
      '--green': '#1a7f37',
      '--red': '#cf222e',
      '--shadow-sm': '0 2px 10px #1f232814',
      '--shadow-md': '0 4px 20px #1f23281f',
      '--scrollbar-thumb': '#c0c6ce',
      '--scrollbar-thumb-hover': '#8c959f',
      '--font': FONT_UI,
      '--font-display': FONT_UI,
    },
  },
  {
    id: 'ivory',
    titleBar: { color: '#f3f0ea', symbolColor: '#1a2332' },
    vars: {
      '--bg': '#ebe7e0',
      '--surface': '#f5f2ec',
      '--surface-elevated': '#e4e0d8',
      '--border': '#cfc8bc',
      '--text': '#1a2332',
      '--muted': '#5c6570',
      '--accent': '#1d4ed8',
      '--accent-dim': '#1d4ed816',
      '--green': '#166534',
      '--red': '#b91c1c',
      '--shadow-sm': '0 2px 12px #1a233214',
      '--shadow-md': '0 4px 20px #1a23321c',
      '--scrollbar-thumb': '#b8b2a6',
      '--scrollbar-thumb-hover': '#9a9488',
      '--font': `"Fraunces", Georgia, serif`,
      '--font-display': `"Fraunces", Georgia, serif`,
    },
  },
]

export const FEATURED_APPEARANCE_IDS: AppearanceId[] = [
  'midnight',
  'cyber',
  'crimson',
  'light',
]

const LIGHT_IDS = new Set<AppearanceId>(['light', 'slate', 'ivory'])

/** Resolve appearance from settings (migrates old uiMode). */
export function resolveAppearance(input: {
  appearance?: AppearanceId
  uiMode?: 'dark' | 'light'
}): AppearanceId {
  if (input.appearance && APPEARANCE_PRESETS.some((p) => p.id === input.appearance)) {
    return input.appearance
  }
  if (input.uiMode === 'light') return 'light'
  return 'midnight'
}

export function getAppearancePreset(id: AppearanceId | undefined): AppearancePreset {
  return APPEARANCE_PRESETS.find((p) => p.id === id) ?? APPEARANCE_PRESETS[0]
}

export function isLightAppearance(id: AppearanceId | undefined): boolean {
  return LIGHT_IDS.has(resolveAppearance({ appearance: id }))
}

export const PALETTE_KEYS: PaletteKey[] = [
  'bg',
  'surface',
  'surfaceElevated',
  'border',
  'text',
  'muted',
  'accent',
  'green',
  'red',
]

const PALETTE_VARS: Record<PaletteKey, string> = {
  bg: '--bg',
  surface: '--surface',
  surfaceElevated: '--surface-elevated',
  border: '--border',
  text: '--text',
  muted: '--muted',
  accent: '--accent',
  green: '--green',
  red: '--red',
}

/** #rgb or #rrggbb → #rrggbb. */
export function normalizeHex(raw: string): string | null {
  const v = raw.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v.split('').map((c) => c + c).join('').toLowerCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`
  return null
}

export function effectivePalette(id: AppearanceId | undefined, custom?: CustomPalette | null): Record<PaletteKey, string> {
  const preset = getAppearancePreset(id)
  const out = {} as Record<PaletteKey, string>
  for (const key of PALETTE_KEYS) {
    const override = custom?.[key] ? normalizeHex(custom[key]!) : null
    out[key] = override ?? preset.vars[PALETTE_VARS[key]] ?? '#000000'
  }
  return out
}

export function paletteIsCustom(custom?: CustomPalette | null): boolean {
  if (!custom) return false
  return PALETTE_KEYS.some((key) => custom[key] && normalizeHex(custom[key]!))
}

function applyPalette(root: HTMLElement, palette?: CustomPalette | null): void {
  if (!palette) return
  for (const key of PALETTE_KEYS) {
    const hex = palette[key] ? normalizeHex(palette[key]!) : null
    if (!hex) continue
    root.style.setProperty(PALETTE_VARS[key], hex)
  }
  const accent = palette.accent ? normalizeHex(palette.accent) : null
  if (accent) {
    root.style.setProperty('--accent-dim', `${accent}28`)
    root.style.setProperty('--shadow-sm', `0 0 16px ${accent}1c`)
    root.style.setProperty('--shadow-md', `0 0 28px ${accent}2e`)
  }
}

/** Apply full appearance pack to the document, then any user color overrides. */
export function applyAppearance(
  id: AppearanceId | undefined,
  palette?: CustomPalette | null,
): AppearancePreset {
  const preset = getAppearancePreset(id)
  const root = document.documentElement
  const isLight = LIGHT_IDS.has(preset.id)

  root.dataset.theme = preset.id
  root.dataset.appearance = preset.id
  root.style.colorScheme = isLight ? 'light' : 'dark'

  for (const [key, value] of Object.entries(preset.vars)) {
    root.style.setProperty(key, value)
  }
  applyPalette(root, palette)

  const font = preset.vars['--font']
  const display = preset.vars['--font-display']
  if (font) {
    root.style.fontFamily = font
    if (document.body) document.body.style.fontFamily = font
  }
  if (display) root.style.setProperty('--font-display', display)

  if (!paletteIsCustom(palette)) return preset
  const colors = effectivePalette(preset.id, palette)
  return {
    ...preset,
    titleBar: {
      color: colors.bg,
      symbolColor: colors.text,
    },
  }
}

/** @deprecated */
export function applyUiTheme(
  mode: 'dark' | 'light' | undefined,
  _accent?: string,
): void {
  applyAppearance(mode === 'light' ? 'light' : 'midnight')
}
