import { APP_VERSION } from './appVersion'
import type { UpdateStatus } from './desktop'

const REPO = '13empty/trading-journal'
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`

type Listener = (status: UpdateStatus) => void

let current: UpdateStatus = { state: 'idle' }
const listeners = new Set<Listener>()

function emit(status: UpdateStatus) {
  current = status
  for (const listener of listeners) listener(status)
}

export function subscribeAppUpdates(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}

function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => {
      const n = Number.parseInt(part, 10)
      return Number.isFinite(n) ? n : 0
    })
}

export function isNewerVersion(remote: string, local: string): boolean {
  const a = parseVersion(remote)
  const b = parseVersion(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff > 0) return true
    if (diff < 0) return false
  }
  return false
}

interface GithubAsset {
  name?: string
  browser_download_url?: string
}

interface GithubRelease {
  tag_name?: string
  body?: string
  html_url?: string
  assets?: GithubAsset[]
}

export async function checkAppUpdates(manual = false): Promise<UpdateStatus> {
  emit({ state: 'checking' })
  try {
    const response = await fetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) {
      const status: UpdateStatus = manual
        ? { state: 'error', message: `HTTP ${response.status}` }
        : { state: 'idle' }
      emit(status)
      return status
    }
    const data = (await response.json()) as GithubRelease
    const version = String(data.tag_name ?? '').replace(/^v/i, '')
    if (!version || !isNewerVersion(version, APP_VERSION)) {
      const status: UpdateStatus = manual ? { state: 'current' } : { state: 'idle' }
      emit(status)
      return status
    }
    const asset = (data.assets ?? []).find((item) => item.name === 'Trading-Journal.exe')
    const status: UpdateStatus = {
      state: 'available',
      version,
      notes: (data.body ?? '').trim(),
      url: data.html_url,
      downloadUrl: asset?.browser_download_url || data.html_url,
    }
    emit(status)
    return status
  } catch (err) {
    const status: UpdateStatus = manual
      ? { state: 'error', message: err instanceof Error ? err.message : String(err) }
      : { state: 'idle' }
    emit(status)
    return status
  }
}
