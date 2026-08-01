import type { DailyNote, TradeMeta, WeeklyNote } from '../types/journal'
import { tradePositionKey } from './mergeTrades'
import type { Trade } from '../types/trade'

const META_KEY = 'trading-journal-trade-meta'
const NOTES_KEY = 'trading-journal-daily-notes'
const WEEKLY_NOTES_KEY = 'trading-journal-weekly-notes'

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

export function loadWeeklyNotes(): Record<string, WeeklyNote> {
  try {
    const raw = localStorage.getItem(WEEKLY_NOTES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, WeeklyNote>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveWeeklyNotes(notes: Record<string, WeeklyNote>): void {
  try {
    localStorage.setItem(WEEKLY_NOTES_KEY, JSON.stringify(notes))
  } catch {
    console.warn('localStorage lleno: notas semanales no guardadas')
  }
}

export function weekNoteKey(weekStart: string): string {
  return weekStart
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
