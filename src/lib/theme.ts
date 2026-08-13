import type { AppearanceId } from '../types/account'

export interface AppearancePreset {
  id: AppearanceId
  /** CSS variables applied to :root */
  vars: Record<string, string>
  /** Windows titleBarOverlay colors */
  titleBar: { color: string; symbolColor: string }
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  {
    id: 'midnight',
    titleBar: { color: '#161b22', symbolColor: '#e6edf3' },
    vars: {
      '--bg': '#0d1117',
      '--surface': '#161b22',
      '--surface-elevated': '#1a212b',
      '--border': '#30363d',
      '--text': '#e6edf3',
      '--muted': '#8b949e',
      '--accent': '#58a6ff',
      '--accent-dim': '#58a6ff1f',
      '--green': '#3fb950',
      '--red': '#f85149',
      '--shadow-sm': '0 2px 12px #00000028',
      '--shadow-md': '0 4px 24px #00000035',
      '--scrollbar-thumb': '#3d444d',
      '--scrollbar-thumb-hover': '#586069',
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
    },
  },
]

const LIGHT_IDS = new Set<AppearanceId>(['light', 'slate'])

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

  return preset
}

/** @deprecated */
export function applyUiTheme(
  mode: 'dark' | 'light' | undefined,
  _accent?: string,
): void {
  applyAppearance(mode === 'light' ? 'light' : 'midnight')
}
