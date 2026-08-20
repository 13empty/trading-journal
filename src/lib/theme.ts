import type { AppearanceId } from '../types/account'

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
    titleBar: { color: '#12141a', symbolColor: '#f0e8ea' },
    vars: {
      '--bg': '#0b0d12',
      '--surface': '#141820',
      '--surface-elevated': '#1a1f2a',
      '--border': '#2a303c',
      '--text': '#ebe6e8',
      '--muted': '#8b8790',
      '--accent': '#e11d48',
      '--accent-dim': '#e11d4820',
      '--green': '#3dd68c',
      '--red': '#f43f5e',
      '--shadow-sm': '0 0 14px #e11d4816',
      '--shadow-md': '0 0 26px #e11d4822',
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
    titleBar: { color: '#0a0a0a', symbolColor: '#e8e8e8' },
    vars: {
      '--bg': '#030303',
      '--surface': '#0c0c0c',
      '--surface-elevated': '#141414',
      '--border': '#262026',
      '--text': '#ececec',
      '--muted': '#8a8588',
      '--accent': '#c4122e',
      '--accent-dim': '#c4122e1a',
      // Same neon green as Cyber so the day PnL marker pops equally
      '--green': '#39ff14',
      '--red': '#ff2d55',
      '--shadow-sm': '0 0 16px #c4122e16',
      '--shadow-md': '0 0 28px #c4122e22',
      '--scrollbar-thumb': '#2a2a2a',
      '--scrollbar-thumb-hover': '#3d3d3d',
      // Same futuristic stack as Cyber (Cascadia first = visible on Windows even offline)
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

/** Apply full appearance pack to the document. */
export function applyAppearance(id: AppearanceId | undefined): AppearancePreset {
  const preset = getAppearancePreset(id)
  const root = document.documentElement
  const isLight = LIGHT_IDS.has(preset.id)

  root.dataset.theme = preset.id
  root.dataset.appearance = preset.id
  root.style.colorScheme = isLight ? 'light' : 'dark'

  for (const [key, value] of Object.entries(preset.vars)) {
    root.style.setProperty(key, value)
  }

  // Force typography onto root + body (stylesheet :root defaults otherwise stick visually)
  const font = preset.vars['--font']
  const display = preset.vars['--font-display']
  if (font) {
    root.style.fontFamily = font
    if (document.body) document.body.style.fontFamily = font
  }
  if (display) root.style.setProperty('--font-display', display)

  return preset
}

/** @deprecated */
export function applyUiTheme(
  mode: 'dark' | 'light' | undefined,
  _accent?: string,
): void {
  applyAppearance(mode === 'light' ? 'light' : 'midnight')
}
