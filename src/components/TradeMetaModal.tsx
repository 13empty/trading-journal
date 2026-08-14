import { useEffect, useMemo, useState } from 'react'
import type { Trade } from '../types/trade'
import type { SetupQuality, TradeMeta, TradingSession } from '../types/journal'
import type { Translations } from '../i18n/types'
import { TRADE_TAG_PRESETS } from '../lib/journalStorage'
import {
  SETUP_PRESETS,
  TIMEFRAME_PRESETS,
  netPnl,
  realizedR,
  resultPct,
  tradeSessionFromTrade,
} from '../lib/analytics'
import { formatMoney, pnlClass } from '../lib/aggregations'

interface Props {
  trade: Trade
  meta: TradeMeta
  balanceAtTrade?: number
  onSave: (meta: TradeMeta) => void
  onClose: () => void
  t: Translations['journal']
  sideLabels: Translations['side']
  sessionLabels: {
    asia: string
    london: string
    ny: string
    other: string
  }
}

const emptyChecklist = () => ({
  hadSetup: false,
  respectedRisk: false,
  inTradingHours: false,
})

function setupLabel(id: string, t: Translations['journal']): string {
  const key = `setup_${id}` as keyof Translations['journal']
  const label = t[key]
  return typeof label === 'string' ? label : id
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

export function TradeMetaModal({
  trade,
  meta,
  balanceAtTrade = 0,
  onSave,
  onClose,
  t,
  sideLabels,
  sessionLabels,
}: Props) {
  const [draft, setDraft] = useState<TradeMeta>({ ...meta, checklist: meta.checklist ?? emptyChecklist() })
  const [tagInput, setTagInput] = useState('')
  const [riskAmountStr, setRiskAmountStr] = useState(numToStr(meta.riskAmount))
  const [riskPercentStr, setRiskPercentStr] = useState(numToStr(meta.riskPercent))
  const [rewardAmountStr, setRewardAmountStr] = useState(numToStr(meta.rewardAmount))
  const [rrRatioStr, setRrRatioStr] = useState(numToStr(meta.rrRatio))
  const [slStr, setSlStr] = useState(numToStr(meta.stopLoss))
  const [tpStr, setTpStr] = useState(numToStr(meta.takeProfit))
  const [mfeStr, setMfeStr] = useState(numToStr(meta.mfeR))
  const [maeStr, setMaeStr] = useState(numToStr(meta.maeR))

  useEffect(() => {
    setDraft({ ...meta, checklist: meta.checklist ?? emptyChecklist() })
    setRiskAmountStr(numToStr(meta.riskAmount))
    setRiskPercentStr(numToStr(meta.riskPercent))
    setRewardAmountStr(numToStr(meta.rewardAmount))
    setRrRatioStr(numToStr(meta.rrRatio))
    setSlStr(numToStr(meta.stopLoss))
    setTpStr(numToStr(meta.takeProfit))
    setMfeStr(numToStr(meta.mfeR))
    setMaeStr(numToStr(meta.maeR))
    setTagInput('')
    // Only re-sync when opening/switching trades — not on every parent re-render
    // (parent may pass a new `{}` each time when meta is missing).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: meta snapshot on trade change
  }, [trade.id])

  const draftForCalc: TradeMeta = {
    ...draft,
    riskAmount: parseOptionalNumber(riskAmountStr),
    riskPercent: parseOptionalNumber(riskPercentStr),
    rewardAmount: parseOptionalNumber(rewardAmountStr),
    rrRatio: parseOptionalNumber(rrRatioStr),
    stopLoss: parseOptionalNumber(slStr),
    takeProfit: parseOptionalNumber(tpStr),
    mfeR: parseOptionalNumber(mfeStr),
    maeR: parseOptionalNumber(maeStr),
  }

  const addTag = (tag: string) => {
    const v = tag.trim().toLowerCase()
    if (!v) return
    const tags = [...(draft.tags ?? [])]
    if (!tags.includes(v)) tags.push(v)
    setDraft({ ...draft, tags })
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setDraft({ ...draft, tags: (draft.tags ?? []).filter((x) => x !== tag) })
  }

  const checklist = draft.checklist ?? emptyChecklist()
  const autoSession = tradeSessionFromTrade(trade)
  const sessionValue = draft.session ?? ''
  const r = realizedR(trade, draftForCalc)
  const pct = resultPct(trade, balanceAtTrade)
  const dollar = netPnl(trade)

  const setSetup = (setup: string) => {
    const next = setup || undefined
    setDraft({
      ...draft,
      setup: next,
      checklist: { ...checklist, hadSetup: Boolean(next) },
    })
  }

  const handleSave = () => {
    onSave({
      ...draft,
      riskAmount: parseOptionalNumber(riskAmountStr),
      riskPercent: parseOptionalNumber(riskPercentStr),
      rewardAmount: parseOptionalNumber(rewardAmountStr),
      rrRatio: parseOptionalNumber(rrRatioStr),
      stopLoss: parseOptionalNumber(slStr),
      takeProfit: parseOptionalNumber(tpStr),
      mfeR: parseOptionalNumber(mfeStr),
      maeR: parseOptionalNumber(maeStr),
    })
  }

  const mt5Ph = (n: number | undefined, suffix = '') =>
    n != null ? `${t.autoFromMt5}: ${n}${suffix}` : undefined

  const resultsHint = useMemo(() => {
    const parts: string[] = []
    if (r != null) parts.push(`${r >= 0 ? '+' : ''}${r.toFixed(2)}R`)
    parts.push(formatMoney(dollar))
    if (pct != null) parts.push(`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`)
    return parts.join(' · ')
  }, [r, dollar, pct])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide modal-scrollable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>
            {t.editTrade} — {trade.symbol} {sideLabels[trade.side]}
          </h3>
        </div>

        <div className="modal-body">
          <div className="setup-analytics-block">
            <div className="setup-block-head">
              <span className="label">{t.setupSection}</span>
              <span className={`setup-result-inline ${pnlClass(dollar)}`}>{resultsHint}</span>
            </div>
            <div className="journal-form-grid journal-form-grid-3">
              <label>
                {t.setupType}
                <select
                  value={draft.setup ?? ''}
                  onChange={(e) => setSetup(e.target.value)}
                >
                  <option value="">{t.setupNone}</option>
                  {SETUP_PRESETS.map((id) => (
                    <option key={id} value={id}>
                      {setupLabel(id, t)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.timeframe}
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
              </label>
              <label>
                {t.setupQuality}
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
              </label>
              <label>
                {t.sessionOverride}
                <select
                  value={sessionValue}
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
              </label>
              <label>
                {t.direction}
                <input type="text" value={sideLabels[trade.side]} disabled readOnly />
              </label>
              <label>
                {t.market}
                <input type="text" value={trade.symbol} disabled readOnly />
              </label>
            </div>
          </div>

          <p className="hint-inline">{t.autoOverrideHint}</p>
          <div className="journal-form-grid">
            <label>
              {t.reviewSl}
              <input
                type="number"
                step="any"
                value={slStr}
                onChange={(e) => setSlStr(e.target.value)}
                placeholder={mt5Ph(trade.stopLoss)}
              />
            </label>
            <label>
              {t.reviewTp}
              <input
                type="number"
                step="any"
                value={tpStr}
                onChange={(e) => setTpStr(e.target.value)}
                placeholder={mt5Ph(trade.takeProfit)}
              />
            </label>
            <label>
              {t.mfeLabel}
              <input
                type="number"
                step="any"
                min={0}
                value={mfeStr}
                onChange={(e) => setMfeStr(e.target.value)}
                placeholder={mt5Ph(trade.mfeR, 'R') ?? t.mfePlaceholder}
              />
            </label>
            <label>
              {t.maeLabel}
              <input
                type="number"
                step="any"
                min={0}
                value={maeStr}
                onChange={(e) => setMaeStr(e.target.value)}
                placeholder={mt5Ph(trade.maeR, 'R') ?? t.maePlaceholder}
              />
            </label>
            <label>
              {t.riskAmount}
              <input
                type="number"
                step="any"
                min={0}
                value={riskAmountStr}
                onChange={(e) => setRiskAmountStr(e.target.value)}
                placeholder={mt5Ph(trade.riskAmount)}
              />
            </label>
            <label>
              {t.riskPercent}
              <input
                type="number"
                step="any"
                min={0}
                value={riskPercentStr}
                onChange={(e) => setRiskPercentStr(e.target.value)}
              />
            </label>
            <label>
              {t.rewardAmount}
              <input
                type="number"
                step="any"
                min={0}
                value={rewardAmountStr}
                onChange={(e) => setRewardAmountStr(e.target.value)}
              />
            </label>
            <label>
              {t.rrRatio}
              <input
                type="number"
                step="any"
                min={0}
                value={rrRatioStr}
                onChange={(e) => setRrRatioStr(e.target.value)}
              />
            </label>
            <label className="span-2">
              {t.chartLink}
              <input
                type="url"
                value={draft.chartLink ?? ''}
                onChange={(e) => setDraft({ ...draft, chartLink: e.target.value })}
                placeholder="https://..."
              />
            </label>
            <label className="span-2">
              {t.screenshotUrl}
              <input
                type="url"
                value={draft.screenshotUrl ?? ''}
                onChange={(e) => setDraft({ ...draft, screenshotUrl: e.target.value })}
                placeholder="https://..."
              />
            </label>
            <label className="span-2">
              {t.tradeNotes}
              <textarea
                rows={2}
                value={draft.journalNotes ?? ''}
                onChange={(e) => setDraft({ ...draft, journalNotes: e.target.value })}
              />
            </label>
          </div>

          <div className="tag-section">
            <span className="label">{t.tags}</span>
            <div className="tag-row">
              {(draft.tags ?? []).map((tag) => (
                <button key={tag} type="button" className="tag-chip active" onClick={() => removeTag(tag)}>
                  {tag} ×
                </button>
              ))}
            </div>
            <div className="tag-row">
              {TRADE_TAG_PRESETS.map((p) => (
                <button key={p} type="button" className="tag-chip" onClick={() => addTag(p)}>
                  + {p}
                </button>
              ))}
              <input
                className="tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(tagInput)
                  }
                }}
                placeholder={t.tagPlaceholder}
              />
            </div>
          </div>

          <fieldset className="checklist-field">
            <legend>{t.checklist}</legend>
            <label className="check-row">
              <input
                type="checkbox"
                checked={checklist.hadSetup}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    checklist: { ...checklist, hadSetup: e.target.checked },
                  })
                }
              />
              {t.hadSetup}
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={checklist.respectedRisk}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    checklist: { ...checklist, respectedRisk: e.target.checked },
                  })
                }
              />
              {t.respectedRisk}
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={checklist.inTradingHours}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    checklist: { ...checklist, inTradingHours: e.target.checked },
                  })
                }
              />
              {t.inTradingHours}
            </label>
          </fieldset>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  )
}
