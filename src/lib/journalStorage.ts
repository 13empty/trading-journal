import type { DailyNote, TradeMeta } from '../types/journal'
import { tradePositionKey } from './mergeTrades'
import type { Trade } from '../types/trade'

const META_KEY = 'trading-journal-trade-meta'
const NOTES_KEY = 'trading-journal-daily-notes'

export function tradeMetaKey(trade: Trade): string {
  return tradePositionKey(trade) ?? trade.id
}

export function loadTradeMetaMap(): Record<string, TradeMeta> {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, TradeMeta>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveTradeMetaMap(map: Record<string, TradeMeta>): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(map))
  } catch {
    console.warn('localStorage lleno: meta de trades no guardada')
  }
}

export function loadDailyNotes(): Record<string, DailyNote> {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, DailyNote>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveDailyNotes(notes: Record<string, DailyNote>): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {
    console.warn('localStorage lleno: notas diarias no guardadas')
  }
}

export const TRADE_TAG_PRESETS = [
  'plan A',
  'FOMO',
  'revenge',
  'noticia',
  'breakout',
  'scalp',
  'swing',
] as const
