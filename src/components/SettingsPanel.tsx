import { useEffect, useState } from 'react'
import type { AppSettings } from '../types/account'
import type { CashMovement } from '../types/account'
import type { Trade } from '../types/trade'
import type { DailyNote, TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import { buildBackup, downloadBackup, parseBackup } from '../lib/backup'
import type { BackupBundle } from '../lib/backup'
import {
  checkForUpdatesDesktop,
  desktopNotify,
  getDesktopInfo,
  isElectronApp,
  openUserDataFolder,
  readSyncLogTail,
  runFullResyncDesktop,
  type DesktopAppInfo,
} from '../lib/desktop'
import { reloadBridgeFromDisk } from '../lib/mt5Bridge'

interface Props {
  settings: AppSettings
  onSettingsChange: (s: AppSettings) => void
  trades: Trade[]
  cash: CashMovement[]
  tradeMeta: Record<string, TradeMeta>
  dailyNotes: Record<string, DailyNote>
  onRestore: (bundle: BackupBundle) => void
  onShowWelcome: () => void
  onResyncDone: () => void
  t: Translations['settings']
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  trades,
  cash,
  tradeMeta,
  dailyNotes,
  onRestore,
  onShowWelcome,
  onResyncDone,
  t,
}: Props) {
  const [info, setInfo] = useState<DesktopAppInfo | null>(null)
  const [logTail, setLogTail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [reloading, setReloading] = useState(false)
  const [fullResyncing, setFullResyncing] = useState(false)

  useEffect(() => {
    void getDesktopInfo().then(setInfo)
    void readSyncLogTail(35).then(setLogTail)
  }, [])

  const handleExport = () => {
    downloadBackup(buildBackup({ trades, cash, settings, tradeMeta, dailyNotes }))
    setMsg(t.exportOk)
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const bundle = parseBackup(String(reader.result))
        if (!confirm(t.restoreConfirm)) return
        onRestore(bundle)
        setMsg(t.restoreOk)
      } catch {
        setMsg(t.restoreError)
      }
    }
    reader.readAsText(file)
  }

  const handleReloadBridge = async () => {
    setReloading(true)
    const ok = await reloadBridgeFromDisk()
    setMsg(ok ? t.reloadOk : t.reloadFail)
    setReloading(false)
    void readSyncLogTail(35).then(setLogTail)
  }

  const testNotify = () => {
    void desktopNotify('Trading Journal', t.testNotifyBody, true)
  }

  const handleFullResync = async () => {
    if (!isElectronApp()) {
      setMsg(t.fullResyncNeedDesktop)
      return
    }
    setFullResyncing(true)
    setMsg(t.fullResyncRunning)
    const result = await runFullResyncDesktop()
    if (result.ok) {
      await reloadBridgeFromDisk()
      onResyncDone()
      setMsg(t.fullResyncOk)
    } else {
      setMsg(`${t.fullResyncFail}${result.output ? `\n${result.output.slice(-200)}` : ''}`)
    }
    setFullResyncing(false)
    void readSyncLogTail(35).then(setLogTail)
  }

  return (
    <div className="settings-panel">
      <section className="panel settings-section">
        <h3>{t.aboutTitle}</h3>
        <ul className="settings-list">
          <li>
            <span>{t.version}</span>
            <span>{info?.version ?? '1.1.0 (web)'}</span>
          </li>
          <li>
            <span>{t.mode}</span>
            <span>{info?.isElectron ? t.modeDesktop : t.modeBrowser}</span>
          </li>
          {info?.userDataPath && (
            <li className="path-row">
              <span>{t.dataFolder}</span>
              <code>{info.userDataPath}</code>
            </li>
          )}
        </ul>
        {info?.isElectron && (
          <button type="button" className="btn-secondary" onClick={() => void openUserDataFolder()}>
            {t.openDataFolder}
          </button>
        )}
      </section>

      <section className="panel settings-section">
        <h3>{t.quickStartTitle}</h3>
        <ol className="steps-list">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
          <li>{t.step4}</li>
        </ol>
        <button type="button" className="btn-ghost-sm" onClick={onShowWelcome}>
          {t.showWelcome}
        </button>
      </section>

      <section className="panel settings-section">
        <h3>{t.backupTitle}</h3>
        <p className="hint-inline">{t.backupHint}</p>
        <div className="settings-actions">
          <button type="button" className="btn-primary" onClick={handleExport}>
            {t.exportBackup}
          </button>
          <label className="btn-secondary file-btn">
            {t.importBackup}
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleImport(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </section>

      <section className="panel settings-section">
        <h3>{t.thresholdsTitle}</h3>
        <p className="hint-inline">{t.thresholdsHint}</p>
        <label className="check-row settings-master-toggle">
          <input
            type="checkbox"
            checked={settings.tradingRulesEnabled === true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                tradingRulesEnabled: e.target.checked,
              })
            }
          />
          {t.enableTradingRules}
        </label>
        {settings.tradingRulesEnabled && (
        <div className="threshold-settings-fields">
        <div className="goals-grid">
          <label>
            {t.dailyLossLimit}
            <input
              type="number"
              step="any"
              value={settings.dailyLossLimit ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  dailyLossLimit: parseFloat(e.target.value) || undefined,
                  alertOnLossLimit: settings.alertOnLossLimit ?? true,
                })
              }
            />
          </label>
          <label>
            {t.maxTradesPerDay}
            <input
              type="number"
              min={1}
              step={1}
              value={settings.maxTradesPerDay ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  maxTradesPerDay: parseInt(e.target.value, 10) || undefined,
                })
              }
            />
          </label>
          <label>
            {t.revengeCooldown}
            <input
              type="number"
              min={0}
              step={1}
              placeholder="30"
              value={settings.revengeCooldownMinutes ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  revengeCooldownMinutes: parseInt(e.target.value, 10) || undefined,
                })
              }
            />
          </label>
          <label>
            {t.maxDrawdownPct}
            <input
              type="number"
              min={0}
              step="any"
              placeholder="10"
              value={settings.maxDrawdownFromPeakPct ?? ''}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  maxDrawdownFromPeakPct: parseFloat(e.target.value) || undefined,
                })
              }
            />
          </label>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.alertOnThresholds !== false}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                alertOnThresholds: e.target.checked,
                alertOnLossLimit: e.target.checked,
              })
            }
          />
          {t.alertOnThresholds}
        </label>
        </div>
        )}
      </section>

      <section className="panel settings-section">
        <h3>{t.notificationsTitle}</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.desktopNotifications ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, desktopNotifications: e.target.checked })
            }
          />
          {t.notificationsEnable}
        </label>
        <button type="button" className="btn-ghost-sm" onClick={testNotify}>
          {t.testNotification}
        </button>
      </section>

      <section className="panel settings-section">
        <h3>{t.syncTitle}</h3>
        <p className="hint-inline">{t.syncHint}</p>
        <div className="settings-actions">
          <button type="button" className="btn-secondary" disabled={reloading} onClick={() => void handleReloadBridge()}>
            {reloading ? t.reloading : t.reloadBridge}
          </button>
        </div>
        <h4 className="sub-head">{t.fullResyncTitle}</h4>
        <p className="hint-inline">{t.fullResyncHint}</p>
        <button
          type="button"
          className="btn-primary"
          disabled={fullResyncing}
          onClick={() => void handleFullResync()}
        >
          {fullResyncing ? t.fullResyncRunning : t.fullResyncBtn}
        </button>
        {logTail ? (
          <pre className="sync-log-preview">{logTail}</pre>
        ) : (
          <p className="hint-inline">{t.logOnlyDesktop}</p>
        )}
      </section>

      <section className="panel settings-section">
        <h3>{t.updatesTitle}</h3>
        <p className="hint-inline">{t.updateFeedHint}</p>
        <label className="offset-field">
          {t.updateFeedUrl}
          <input
            type="url"
            value={settings.updateFeedUrl ?? ''}
            placeholder="https://…/releases/"
            onChange={(e) => onSettingsChange({ ...settings, updateFeedUrl: e.target.value || undefined })}
          />
        </label>
        <button type="button" className="btn-secondary" onClick={() => void checkForUpdatesDesktop()}>
          {t.checkUpdates}
        </button>
      </section>

      {msg && <p className="import-msg">{msg}</p>}
    </div>
  )
}
