import { useState } from 'react'
import type { Translations } from '../i18n/types'
import type { ExchangeCatalogItem, ExchangeConnectionPublic } from '../lib/exchangeBridge'
import { formatBalance } from '../lib/aggregations'

interface Props {
  catalog: ExchangeCatalogItem[]
  connections: ExchangeConnectionPublic[]
  syncing: boolean
  error: string | null
  onSave: (payload: {
    exchange: string
    apiKey: string
    apiSecret: string
    passphrase?: string
    label?: string
  }) => Promise<{ ok: boolean; error?: string }>
  onDelete: (id: string) => Promise<boolean>
  onTest: (id: string) => Promise<{ ok: boolean; error?: string; balance?: number | null; tradeCount?: number }>
  onSync: (id?: string) => Promise<unknown>
  t: Translations['exchanges']
}

const FALLBACK_CATALOG: ExchangeCatalogItem[] = [
  { id: 'binance', name: 'Binance', needsPassphrase: false, market: 'USDT-M Futures' },
  { id: 'bybit', name: 'Bybit', needsPassphrase: false, market: 'USDT Perp' },
  { id: 'okx', name: 'OKX', needsPassphrase: true, market: 'SWAP' },
  { id: 'bitget', name: 'Bitget', needsPassphrase: true, market: 'USDT-M' },
]

export function ExchangeConnectPanel({
  catalog,
  connections,
  syncing,
  error,
  onSave,
  onDelete,
  onTest,
  onSync,
  t,
}: Props) {
  const exchanges = catalog.length ? catalog : FALLBACK_CATALOG
  const [exchange, setExchange] = useState(exchanges[0]?.id || 'binance')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [formMsg, setFormMsg] = useState<string | null>(null)
  const selected = exchanges.find((x) => x.id === exchange) ?? exchanges[0]

  const handleSave = async () => {
    setBusy(true)
    setFormMsg(null)
    const result = await onSave({
      exchange,
      apiKey,
      apiSecret,
      passphrase: selected?.needsPassphrase ? passphrase : undefined,
      label: selected?.name,
    })
    setBusy(false)
    if (!result.ok) {
      setFormMsg(result.error || t.saveFail)
      return
    }
    setApiKey('')
    setApiSecret('')
    setPassphrase('')
    setFormMsg(t.saveOk)
    void onSync()
  }

  return (
    <section className="panel exchange-panel">
      <div className="panel-head">
        <h3>{t.title}</h3>
      </div>
      <p className="exchange-lead">{t.subtitle}</p>
      <p className="exchange-hint">{t.readOnlyHint}</p>

      <div className="exchange-grid">
        {exchanges.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`broker-card${exchange === item.id ? ' active' : ''}`}
            onClick={() => setExchange(item.id)}
          >
            {item.name}
            <span className="exchange-market">{item.market}</span>
          </button>
        ))}
      </div>

      <label className="offset-field">
        {t.apiKey}
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <label className="offset-field">
        {t.apiSecret}
        <input
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {selected?.needsPassphrase && (
        <label className="offset-field">
          {t.passphrase}
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      )}

      <div className="exchange-actions">
        <button type="button" className="btn-primary" disabled={busy || !apiKey || !apiSecret} onClick={() => void handleSave()}>
          {busy ? t.saving : t.connect}
        </button>
        {connections.length > 0 && (
          <button type="button" className="btn-secondary" disabled={syncing} onClick={() => void onSync()}>
            {syncing ? t.syncing : t.syncAll}
          </button>
        )}
      </div>
      {formMsg && <p className="exchange-msg">{formMsg}</p>}
      {error && <p className="exchange-msg err">{error}</p>}

      {connections.length > 0 && (
        <ul className="exchange-list">
          {connections.map((c) => (
            <li key={c.id} className="exchange-row">
              <div>
                <strong>{c.label}</strong>
                <span className="muted-hint">
                  {c.apiKeyMasked}
                  {c.balance != null ? ` · ${formatBalance(c.balance)}` : ''}
                  {c.lastTradeCount ? ` · ${c.lastTradeCount} trades` : ''}
                </span>
                {c.lastError && <span className="exchange-msg err">{c.lastError}</span>}
              </div>
              <div className="exchange-row-actions">
                <button type="button" className="btn-secondary btn-sm" disabled={syncing} onClick={() => void onTest(c.id)}>
                  {t.test}
                </button>
                <button type="button" className="btn-secondary btn-sm" disabled={syncing} onClick={() => void onSync(c.id)}>
                  {t.sync}
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => void onDelete(c.id)}>
                  {t.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
