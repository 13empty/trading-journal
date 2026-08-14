import type { ScreenshotSlot } from '../types/journal'
import { isElectronApp } from './desktop'

export const SCREENSHOT_SLOTS: ScreenshotSlot[] = ['before', 'after', 'close']

export function sanitizeTradeMediaKey(tradeKey: string): string {
  return tradeKey.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'trade'
}

export async function captureTradeScreenshot(
  tradeKey: string,
  slot: ScreenshotSlot,
): Promise<{ ok: boolean; relativePath?: string; error?: string }> {
  if (!isElectronApp() || !window.desktop?.captureScreen) {
    return { ok: false, error: 'desktop_only' }
  }
  try {
    const cap = await window.desktop.captureScreen()
    if (!cap?.ok || !cap.pngBase64) {
      return { ok: false, error: cap?.error || 'capture_failed' }
    }
    const saved = await window.desktop.saveTradeScreenshot({
      tradeKey,
      slot,
      pngBase64: cap.pngBase64,
    })
    if (!saved?.ok || !saved.relativePath) {
      return { ok: false, error: saved?.error || 'save_failed' }
    }
    return { ok: true, relativePath: saved.relativePath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function pickTradeScreenshot(
  tradeKey: string,
  slot: ScreenshotSlot,
): Promise<{ ok: boolean; relativePath?: string; error?: string }> {
  if (!isElectronApp() || !window.desktop?.pickTradeScreenshot) {
    return { ok: false, error: 'desktop_only' }
  }
  try {
    const r = await window.desktop.pickTradeScreenshot({ tradeKey, slot })
    if (!r?.ok) return { ok: false, error: r?.error || 'cancelled' }
    return { ok: true, relativePath: r.relativePath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function readTradeScreenshotDataUrl(
  relativePath: string | undefined,
): Promise<string | null> {
  if (!relativePath || !isElectronApp() || !window.desktop?.readTradeScreenshot) return null
  try {
    const r = await window.desktop.readTradeScreenshot(relativePath)
    return r?.ok && r.dataUrl ? r.dataUrl : null
  } catch {
    return null
  }
}

export async function deleteTradeScreenshotFile(
  relativePath: string | undefined,
): Promise<boolean> {
  if (!relativePath || !window.desktop?.deleteTradeScreenshot) return false
  try {
    const r = await window.desktop.deleteTradeScreenshot(relativePath)
    return Boolean(r?.ok)
  } catch {
    return false
  }
}
