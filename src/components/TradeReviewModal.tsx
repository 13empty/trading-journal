import { useEffect, useState } from 'react'
import type { Trade } from '../types/trade'
import type {
  ScreenshotSlot,
  SetupQuality,
  TradeMeta,
  MistakeId,
  TradingSession,
} from '../types/journal'
import type { Translations } from '../i18n/types'
import {
  MISTAKE_PRESETS,
  SETUP_PRESETS,
  TIMEFRAME_PRESETS,
  effectiveMaeR,
  effectiveMfeR,
  effectiveRiskAmount,
  effectiveStopLoss,
  effectiveTakeProfit,
  netPnl,
  realizedR,
  tradeMetaKey,
  tradeSessionFromTrade,
} from '../lib/analytics'
import { formatMoney, pnlClass } from '../lib/aggregations'
import { isElectronApp } from '../lib/desktop'
import {
  captureTradeScreenshot,
  deleteTradeScreenshotFile,
  pickTradeScreenshot,
  readTradeScreenshotDataUrl,
  SCREENSHOT_SLOTS,
} from '../lib/tradeScreenshots'
import { excursionInsight } from '../lib/excursion'
import { interpolate } from '../i18n'

interface Props {
  trade: Trade
  meta: TradeMeta
  onSave: (meta: TradeMeta) => void
  onClose: () => void
  onEditDetails: () => void
  t: Translations['journal']
  sideLabels: Translations['side']
  sessionLabels: {
    asia: string
    london: string
    ny: string
    other: string
  }
}

function setupLabel(id: string, t: Translations['journal']): string {
  const key = `setup_${id}` as keyof Translations['journal']
  const label = t[key]
  return typeof label === 'string' ? label : id
}

function mistakeLabel(id: string, t: Translations['journal']): string {
  const key = `mistake_${id}` as keyof Translations['journal']
  const label = t[key]
  return typeof label === 'string' ? label : id
}

function slotTitle(slot: ScreenshotSlot, t: Translations['journal']): string {
  if (slot === 'before') return t.shotBefore
  if (slot === 'after') return t.shotAfter
  return t.shotClose
}

function numToStr(n: number | undefined): string {
  return n == null || Number.isNaN(n) ? '' : String(n)
}

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

function autoPlaceholder(
  auto: number | null | undefined,
  tag: string,
  suffix = '',
): string | undefined {
  if (auto == null || Number.isNaN(auto)) return undefined
  return `${tag}: ${auto}${suffix}`
}

function sourceTag(
  hasOverride: boolean,
  hasAuto: boolean,
  t: Translations['journal'],
): string | null {
  if (hasOverride) return t.manualOverride
  if (hasAuto) return t.autoFromMt5
  return null
}

export function TradeReviewModal({
  trade,
  meta,
  onSave,
  onClose,
  onEditDetails,
  t,
  sideLabels,
  sessionLabels,
}: Props) {
  const key = tradeMetaKey(trade)
  const tradeNum = trade.positionId || key.replace(/\D/g, '').slice(-6) || key.slice(0, 8)
  const desktop = isElectronApp()

  const [draft, setDraft] = useState<TradeMeta>({ ...meta })
  // Empty string = use MT5 auto; filled = manual override
  const [slStr, setSlStr] = useState(numToStr(meta.stopLoss))
  const [tpStr, setTpStr] = useState(numToStr(meta.takeProfit))
  const [riskStr, setRiskStr] = useState(numToStr(meta.riskAmount))
  const [mfeStr, setMfeStr] = useState(numToStr(meta.mfeR))
  const [maeStr, setMaeStr] = useState(numToStr(meta.maeR))
  const [busySlot, setBusySlot] = useState<ScreenshotSlot | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Partial<Record<ScreenshotSlot, string>>>({})

  useEffect(() => {
    setDraft({ ...meta })
    setSlStr(numToStr(meta.stopLoss))
    setTpStr(numToStr(meta.takeProfit))
    setRiskStr(numToStr(meta.riskAmount))
    setMfeStr(numToStr(meta.mfeR))
    setMaeStr(numToStr(meta.maeR))
    setMsg(null)
  }, [trade.id])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const next: Partial<Record<ScreenshotSlot, string>> = {}
      for (const slot of SCREENSHOT_SLOTS) {
        const rel = draft.screenshots?.[slot]
        if (!rel) continue
        const url = await readTradeScreenshotDataUrl(rel)
        if (url) next[slot] = url
      }
      if (!cancelled) setPreviews(next)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [draft.screenshots?.before, draft.screenshots?.after, draft.screenshots?.close, trade.id])

  const draftExcursion: TradeMeta = {
    ...draft,
    stopLoss: parseOptionalNumber(slStr),
    takeProfit: parseOptionalNumber(tpStr),
    riskAmount: parseOptionalNumber(riskStr),
    mfeR: parseOptionalNumber(mfeStr),
    maeR: parseOptionalNumber(maeStr),
  }

  const result = netPnl(trade)
  const sl = effectiveStopLoss(trade, draftExcursion)
  const tp = effectiveTakeProfit(trade, draftExcursion)
  const risk = effectiveRiskAmount(trade, draftExcursion)
  const mfe = effectiveMfeR(trade, draftExcursion)
  const mae = effectiveMaeR(trade, draftExcursion)
  const r = realizedR(trade, draftExcursion)
  const insight = excursionInsight(trade, draftExcursion)
  const autoSession = tradeSessionFromTrade(trade)

  const slTag = sourceTag(Boolean(parseOptionalNumber(slStr)), trade.stopLoss != null, t)
  const tpTag = sourceTag(Boolean(parseOptionalNumber(tpStr)), trade.takeProfit != null, t)
  const riskTag = sourceTag(Boolean(parseOptionalNumber(riskStr)), trade.riskAmount != null, t)
  const mfeTag = sourceTag(Boolean(parseOptionalNumber(mfeStr)), trade.mfeR != null, t)
  const maeTag = sourceTag(Boolean(parseOptionalNumber(maeStr)), trade.maeR != null, t)

  const setShotPath = (slot: ScreenshotSlot, relativePath: string | undefined) => {
    setDraft((prev) => {
      const shots = { ...(prev.screenshots ?? {}) }
      if (relativePath) shots[slot] = relativePath
      else delete shots[slot]
      return {
        ...prev,
        screenshots: Object.keys(shots).length ? shots : undefined,
      }
    })
  }

  const handleCapture = async (slot: ScreenshotSlot) => {
    if (!desktop) {
      setMsg(t.shotsDesktopOnly)
      return
    }
    setBusySlot(slot)
    setMsg(t.shotCapturing)
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement | null
    if (backdrop) backdrop.style.visibility = 'hidden'
    try {
      await new Promise((r) => setTimeout(r, 220))
      const res = await captureTradeScreenshot(key, slot)
      if (!res.ok || !res.relativePath) {
        setMsg(res.error === 'desktop_only' ? t.shotsDesktopOnly : t.shotCaptureFail)
        return
      }
      setShotPath(slot, res.relativePath)
      setMsg(t.shotCaptureOk)
    } finally {
      if (backdrop) backdrop.style.visibility = ''
      setBusySlot(null)
    }
  }

  const handlePick = async (slot: ScreenshotSlot) => {
    if (!desktop) {
      setMsg(t.shotsDesktopOnly)
      return
    }
    setBusySlot(slot)
    const res = await pickTradeScreenshot(key, slot)
    setBusySlot(null)
    if (!res.ok || !res.relativePath) {
      if (res.error !== 'cancelled') setMsg(t.shotCaptureFail)
      return
    }
    setShotPath(slot, res.relativePath)
    setMsg(t.shotCaptureOk)
  }

  const handleClear = async (slot: ScreenshotSlot) => {
    const rel = draft.screenshots?.[slot]
    await deleteTradeScreenshotFile(rel)
    setShotPath(slot, undefined)
    setPreviews((p) => {
      const n = { ...p }
      delete n[slot]
      return n
    })
  }

  const handleSave = () => {
    onSave({
      ...draft,
      stopLoss: parseOptionalNumber(slStr),
      takeProfit: parseOptionalNumber(tpStr),
      riskAmount: parseOptionalNumber(riskStr),
      mfeR: parseOptionalNumber(mfeStr),
      maeR: parseOptionalNumber(maeStr),
      checklist: draft.setup
        ? {
            ...(draft.checklist ?? {
              hadSetup: false,
              respectedRisk: false,
              inTradingHours: false,
            }),
            hadSetup: true,
          }
        : draft.checklist,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-review modal-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {t.reviewTitle} #{tradeNum} — {trade.symbol} {sideLabels[trade.side]}
          </h3>
        </div>

        <div className="modal-body">
          <div className="review-facts">
            <div className="review-fact">
              <span className="label">{t.setupType}</span>
              <select
                value={draft.setup ?? ''}
                onChange={(e) => setDraft({ ...draft, setup: e.target.value || undefined })}
              >
                <option value="">{t.setupNone}</option>
                {SETUP_PRESETS.map((id) => (
                  <option key={id} value={id}>
                    {setupLabel(id, t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="review-fact">
              <span className="label">{t.timeframe}</span>
              <select
                value={draft.timeframe ?? ''}
                onChange={(e) =>
                  setDraft({ ...draft, timeframe: e.target.value || undefined })
                }
              >
                <option value="">{t.setupNone}</option>
                {TIMEFRAME_PRESETS.map((tf) => (
                  <option key={tf} value={tf}>
                    {tf}
                  </option>
                ))}
              </select>
            </div>
            <div className="review-fact">
              <span className="label">{t.reviewEntry}</span>
              <strong>{trade.entryPrice || '—'}</strong>
            </div>
            <div className="review-fact">
              <span className="label">
                {t.reviewSl}
                {slTag ? <em className="auto-tag"> {slTag}</em> : null}
              </span>
              <input
                type="number"
                step="any"
                value={slStr}
                onChange={(e) => setSlStr(e.target.value)}
                placeholder={autoPlaceholder(trade.stopLoss, t.autoFromMt5) ?? '—'}
                title={
                  sl != null
                    ? `${t.effectiveValue}: ${sl}`
                    : t.autoOverrideHint
                }
              />
            </div>
            <div className="review-fact">
              <span className="label">
                {t.reviewTp}
                {tpTag ? <em className="auto-tag"> {tpTag}</em> : null}
              </span>
              <input
                type="number"
                step="any"
                value={tpStr}
                onChange={(e) => setTpStr(e.target.value)}
                placeholder={autoPlaceholder(trade.takeProfit, t.autoFromMt5) ?? '—'}
                title={tp != null ? `${t.effectiveValue}: ${tp}` : t.autoOverrideHint}
              />
            </div>
            <div className="review-fact">
              <span className="label">
                {t.riskAmount}
                {riskTag ? <em className="auto-tag"> {riskTag}</em> : null}
              </span>
              <input
                type="number"
                step="any"
                min={0}
                value={riskStr}
                onChange={(e) => setRiskStr(e.target.value)}
                placeholder={
                  autoPlaceholder(trade.riskAmount, t.autoFromMt5) ?? '—'
                }
                title={
                  risk != null
                    ? `${t.effectiveValue}: ${formatMoney(risk)}`
                    : t.autoOverrideHint
                }
              />
            </div>
            <div className="review-fact">
              <span className="label">{t.reviewResult}</span>
              <strong className={pnlClass(result)}>
                {formatMoney(result)}
                {r != null ? ` · ${r >= 0 ? '+' : ''}${r.toFixed(2)}R` : ''}
              </strong>
            </div>
            <div className="review-fact">
              <span className="label">
                {t.mfeLabel}
                {mfeTag ? <em className="auto-tag"> {mfeTag}</em> : null}
              </span>
              <input
                type="number"
                step="any"
                min={0}
                value={mfeStr}
                onChange={(e) => setMfeStr(e.target.value)}
                placeholder={
                  autoPlaceholder(trade.mfeR, t.autoFromMt5, 'R') ?? t.mfePlaceholder
                }
                title={mfe != null ? `${t.effectiveValue}: ${mfe}R` : t.autoOverrideHint}
              />
            </div>
            <div className="review-fact">
              <span className="label">
                {t.maeLabel}
                {maeTag ? <em className="auto-tag"> {maeTag}</em> : null}
              </span>
              <input
                type="number"
                step="any"
                min={0}
                value={maeStr}
                onChange={(e) => setMaeStr(e.target.value)}
                placeholder={
                  autoPlaceholder(trade.maeR, t.autoFromMt5, 'R') ?? t.maePlaceholder
                }
                title={mae != null ? `${t.effectiveValue}: ${mae}R` : t.autoOverrideHint}
              />
            </div>
            <div className="review-fact">
              <span className="label">{t.sessionOverride}</span>
              <select
                value={draft.session ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    session: (e.target.value || undefined) as TradingSession | undefined,
                  })
                }
              >
                <option value="">
                  {autoSession
                    ? `${t.sessionAuto} (${sessionLabels[autoSession]})`
                    : t.sessionAuto}
                </option>
                <option value="asia">{sessionLabels.asia}</option>
                <option value="london">{sessionLabels.london}</option>
                <option value="ny">{sessionLabels.ny}</option>
                <option value="other">{sessionLabels.other}</option>
              </select>
            </div>
            <div className="review-fact">
              <span className="label">{t.setupQuality}</span>
              <select
                value={draft.setupQuality ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    setupQuality: (e.target.value || undefined) as SetupQuality | undefined,
                  })
                }
              >
                <option value="">{t.setupNone}</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>

          {insight && insight.kind !== 'ok' ? (
            <div
              className={`excursion-insight${insight.kind === 'left_on_table' ? ' leave' : ' tight'}`}
              role="status"
            >
              {insight.kind === 'left_on_table' && insight.leftOnTableR != null
                ? interpolate(t.insightLeftOnTable, {
                    left: insight.leftOnTableR.toFixed(1),
                    mfe: (insight.mfeR ?? 0).toFixed(1),
                    closed: (insight.closedR ?? 0).toFixed(1),
                  })
                : interpolate(t.insightSlTight, {
                    mae: (insight.maeR ?? 0).toFixed(2),
                  })}
            </div>
          ) : null}

          <p className="hint-inline excursion-hint">{t.excursionHint}</p>

          <div className="review-shots">
            <div className="setup-block-head">
              <span className="label">{t.shotsTitle}</span>
              <span className="hint-inline">{t.shotsHint}</span>
            </div>
            <div className="review-shots-grid">
              {SCREENSHOT_SLOTS.map((slot) => (
                <div key={slot} className="review-shot-card">
                  <div className="review-shot-label">{slotTitle(slot, t)}</div>
                  <div className="review-shot-frame">
                    {previews[slot] ? (
                      <img src={previews[slot]} alt={slotTitle(slot, t)} />
                    ) : (
                      <span className="review-shot-empty">{t.shotEmpty}</span>
                    )}
                  </div>
                  <div className="review-shot-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busySlot === slot}
                      onClick={() => void handleCapture(slot)}
                    >
                      {busySlot === slot ? '…' : t.shotCapture}
                    </button>
                    <button
                      type="button"
                      disabled={busySlot === slot}
                      onClick={() => void handlePick(slot)}
                    >
                      {t.shotPick}
                    </button>
                    {draft.screenshots?.[slot] ? (
                      <button type="button" onClick={() => void handleClear(slot)}>
                        {t.shotClear}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mistake-tracker">
            <div className="setup-block-head">
              <span className="label">{t.mistakesTitle}</span>
              <span className="hint-inline">{t.mistakesHint}</span>
            </div>
            <div className="mistake-chips" role="group" aria-label={t.mistakesTitle}>
              {MISTAKE_PRESETS.map((id) => {
                const active = (draft.mistakes ?? []).includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    className={`mistake-chip${active ? ' active' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setDraft((prev) => {
                        const cur = prev.mistakes ?? []
                        const next = active
                          ? cur.filter((x) => x !== id)
                          : [...cur, id as MistakeId]
                        return {
                          ...prev,
                          mistakes: next.length ? next : undefined,
                        }
                      })
                    }}
                  >
                    {active ? '✕ ' : ''}
                    {mistakeLabel(id, t)}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="review-notes">
            {t.tradeNotes}
            <textarea
              rows={3}
              value={draft.journalNotes ?? ''}
              onChange={(e) => setDraft({ ...draft, journalNotes: e.target.value })}
            />
          </label>

          {msg ? <p className="hint-inline">{msg}</p> : null}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" onClick={onEditDetails}>
            {t.editDetails}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  )
}
