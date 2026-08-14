export interface DesktopAppInfo {
  isElectron: boolean
  version: string
  userDataPath: string
  bridgeDataPath: string
  syncLogPath: string
  platform?: string
  titleBarInset?: number
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message?: string }
  | { state: 'disabled' }

export interface ResyncResult {
  ok: boolean
  output?: string
  error?: string
  code?: number
}

declare global {
  interface Window {
    desktop?: {
      notify: (title: string, body: string) => Promise<void>
      getInfo: () => Promise<DesktopAppInfo>
      openUserData: () => Promise<void>
      readSyncLog: (maxLines?: number) => Promise<string>
      applyBroker: (payload: {
        preset: string
        offsetHours: number
        label: string
      }) => Promise<{ ok: boolean }>
      runFullResync: () => Promise<ResyncResult>
      setTitleBarTheme: (payload: {
        color: string
        symbolColor: string
      }) => Promise<{ ok: boolean }>
      captureScreen: () => Promise<{ ok: boolean; pngBase64?: string; error?: string }>
      saveTradeScreenshot: (payload: {
        tradeKey: string
        slot: 'before' | 'after' | 'close'
        pngBase64: string
      }) => Promise<{ ok: boolean; relativePath?: string; error?: string }>
      pickTradeScreenshot: (payload: {
        tradeKey: string
        slot: 'before' | 'after' | 'close'
      }) => Promise<{ ok: boolean; relativePath?: string; error?: string }>
      readTradeScreenshot: (
        relativePath: string,
      ) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>
      deleteTradeScreenshot: (
        relativePath: string,
      ) => Promise<{ ok: boolean; error?: string }>
      openScreenshotsFolder: (tradeKey: string) => Promise<{ ok: boolean; error?: string }>
      checkUpdates: () => Promise<{ state: string }>
      downloadUpdate: () => Promise<{ ok: boolean }>
      installUpdate: () => Promise<{ ok: boolean }>
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
    }
  }
}

export function isElectronApp(): boolean {
  return Boolean(window.desktop?.getInfo)
}

export async function getDesktopInfo(): Promise<DesktopAppInfo | null> {
  try {
    return (await window.desktop?.getInfo()) ?? null
  } catch {
    return null
  }
}

export async function desktopNotify(title: string, body: string, enabled: boolean): Promise<void> {
  if (!enabled) return
  try {
    if (window.desktop?.notify) {
      await window.desktop.notify(title, body)
      return
    }
  } catch {
    /* fallback */
  }
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if (Notification.permission !== 'denied') {
    const p = await Notification.requestPermission()
    if (p === 'granted') new Notification(title, { body })
  }
}

export async function openUserDataFolder(): Promise<void> {
  await window.desktop?.openUserData()
}

export async function readSyncLogTail(maxLines = 40): Promise<string> {
  try {
    return (await window.desktop?.readSyncLog(maxLines)) ?? ''
  } catch {
    return ''
  }
}

export async function applyBrokerDesktop(payload: {
  preset: string
  offsetHours: number
  label: string
}): Promise<boolean> {
  try {
    const r = await window.desktop?.applyBroker(payload)
    return Boolean(r?.ok)
  } catch {
    return false
  }
}

export async function runFullResyncDesktop(): Promise<ResyncResult> {
  try {
    return (await window.desktop?.runFullResync()) ?? { ok: false, error: 'no_desktop' }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function setTitleBarThemeDesktop(payload: {
  color: string
  symbolColor: string
}): Promise<void> {
  try {
    await window.desktop?.setTitleBarTheme(payload)
  } catch {
    /* ignore */
  }
}

export function subscribeUpdateStatus(callback: (status: UpdateStatus) => void): () => void {
  return window.desktop?.onUpdateStatus(callback) ?? (() => {})
}

export async function checkForUpdatesDesktop(): Promise<void> {
  await window.desktop?.checkUpdates()
}

export async function downloadUpdateDesktop(): Promise<void> {
  await window.desktop?.downloadUpdate()
}

export async function installUpdateDesktop(): Promise<void> {
  await window.desktop?.installUpdate()
}
