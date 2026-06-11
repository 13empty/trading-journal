import { useState } from 'react'
import type { Translations } from '../i18n/types'
import { BROKER_PRESETS } from '../lib/brokerPresets'
import { applyBrokerDesktop } from '../lib/desktop'

interface Props {
  brokerNames: Translations['broker']['names']
  t: Translations['broker']
  onComplete: (preset: string, offsetHours: number, label: string) => void
}

export function BrokerWizardModal({ brokerNames, t, onComplete }: Props) {
  const [presetId, setPresetId] = useState(BROKER_PRESETS[0].id)
  const [offsetHours, setOffsetHours] = useState(BROKER_PRESETS[0].offsetHours)
  const [busy, setBusy] = useState(false)

  const selected = BROKER_PRESETS.find((p) => p.id === presetId) ?? BROKER_PRESETS[0]

  const handlePreset = (id: string) => {
    setPresetId(id)
    const p = BROKER_PRESETS.find((x) => x.id === id)
    if (p) setOffsetHours(p.offsetHours)
  }

  const handleSave = async () => {
    setBusy(true)
    const label = brokerNames[selected.nameKey as keyof typeof brokerNames] ?? selected.id
    await applyBrokerDesktop({ preset: presetId, offsetHours, label })
    onComplete(presetId, offsetHours, label)
    setBusy(false)
  }

  return (
    <div className="modal-backdrop welcome-backdrop">
      <div className="modal modal-wide welcome-modal">
        <h2>{t.title}</h2>
        <p className="welcome-lead">{t.lead}</p>

        <div className="broker-grid">
          {BROKER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`broker-card ${presetId === p.id ? 'active' : ''}`}
              onClick={() => handlePreset(p.id)}
            >
              {brokerNames[p.nameKey as keyof typeof brokerNames]}
            </button>
          ))}
        </div>

        <label className="offset-field">
          {t.offsetLabel}
          <input
            type="number"
            min={0}
            max={12}
            value={offsetHours}
            onChange={(e) => setOffsetHours(parseInt(e.target.value, 10) || 0)}
          />
          <span className="hint-text">{t.offsetHint}</span>
        </label>

        <div className="modal-actions">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void handleSave()}>
            {busy ? t.saving : t.continue}
          </button>
        </div>
      </div>
    </div>
  )
}
