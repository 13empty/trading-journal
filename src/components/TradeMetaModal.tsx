import { useEffect, useState } from 'react'
import type { Trade } from '../types/trade'
import type { TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import { TRADE_TAG_PRESETS } from '../lib/journalStorage'
import { tradeMetaKey } from '../lib/analytics'

interface Props {
  trade: Trade
  meta: TradeMeta
  onSave: (meta: TradeMeta) => void
  onClose: () => void
  t: Translations['journal']
}

const emptyChecklist = () => ({
  hadSetup: false,
  respectedRisk: false,
  inTradingHours: false,
})

export function TradeMetaModal({ trade, meta, onSave, onClose, t }: Props) {
  const [draft, setDraft] = useState<TradeMeta>({ ...meta, checklist: meta.checklist ?? emptyChecklist() })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    setDraft({ ...meta, checklist: meta.checklist ?? emptyChecklist() })
  }, [meta, trade.id])

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>
          {t.editTrade} — {trade.symbol} #{tradeMetaKey(trade).slice(0, 8)}
        </h3>

        <div className="journal-form-grid">
          <label>
            {t.riskAmount}
            <input
              type="number"
              step="any"
              min={0}
              value={draft.riskAmount ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, riskAmount: parseFloat(e.target.value) || undefined })
              }
            />
          </label>
          <label>
            {t.riskPercent}
            <input
              type="number"
              step="any"
              min={0}
              value={draft.riskPercent ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, riskPercent: parseFloat(e.target.value) || undefined })
              }
            />
          </label>
          <label>
            {t.rewardAmount}
            <input
              type="number"
              step="any"
              min={0}
              value={draft.rewardAmount ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, rewardAmount: parseFloat(e.target.value) || undefined })
              }
            />
          </label>
          <label>
            {t.rrRatio}
            <input
              type="number"
              step="any"
              min={0}
              value={draft.rrRatio ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, rrRatio: parseFloat(e.target.value) || undefined })
              }
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

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className="btn-primary" onClick={() => onSave(draft)}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  )
}
