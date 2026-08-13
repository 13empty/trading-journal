import { useEffect, useState } from 'react'
import type { AppearanceId, AppSettings, CalendarPnlDisplay } from '../types/account'
import type { CashMovement } from '../types/account'
import type { Trade } from '../types/trade'
import type { DailyNote, TradeMeta } from '../types/journal'
import type { Translations } from '../i18n/types'
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../i18n/types'
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
  setTitleBarThemeDesktop,
  type DesktopAppInfo,
} from '../lib/desktop'
import { reloadBridgeFromDisk } from '../lib/mt5Bridge'
import { APP_VERSION } from '../lib/appVersion'
import { deriveProfitGoals } from '../lib/profitGoals'
import { APPEARANCE_PRESETS, applyAppearance, resolveAppearance } from '../lib/theme'

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
  tLang: Translations['language']
  tCalendar: Translations['calendar']
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
  tLang,
  tCalendar,
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

  const appearance = resolveAppearance(settings)

  const setAppearance = (id: AppearanceId) => {
    const preset = applyAppearance(id)
    void setTitleBarThemeDesktop(preset.titleBar)
    onSettingsChange({ ...settings, appearance: id, uiMode: id === 'light' || id === 'slate' ? 'light' : 'dark' })
  }

  return (
    <div className="settings-panel">
      <header className="settings-page-head">
        <h2>{t.pageTitle}</h2>
        <p className="hint-inline">{t.pageSubtitle}</p>
      </header>

      <section className="panel settings-section">
        <h3>{t.appearanceTitle}</h3>
        <label className="offset-field">
          {tLang.label}
          <select
            value={settings.language ?? 'es'}
            onChange={(e) =>
              onSettingsChange({ ...settings, language: e.target.value as AppLanguage })
            }
          >
            {SUPPORTED_LANGUAGES.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="accent-picker">
          <span className="label">{t.appearancePack}</span>
          <p className="hint-inline">{t.appearanceHint}</p>
          <div className="appearance-grid" role="group" aria-label={t.appearancePack}>
            {APPEARANCE_PRESETS.map((preset) => {
              const labelKey = `appearance_${preset.id}` as keyof typeof t
              const descKey = `appearance_${preset.id}_desc` as keyof typeof t
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`appearance-card${appearance === preset.id ? ' active' : ''}`}
                  aria-pressed={appearance === preset.id}
                  onClick={() => setAppearance(preset.id)}
                >
                  <div className="appearance-preview" aria-hidden>
                    <div
                      className="appearance-preview-bg"
                      style={{ background: preset.vars['--bg'] }}
                    />
                    <div
                      className="appearance-preview-surface"
                      style={{ background: preset.vars['--surface'] }}
                    >
                      <span
                        className="appearance-preview-accent"
                        style={{
                          background: preset.vars['--accent'],
                          color: preset.vars['--accent'],
                        }}
                      />
                    </div>
                  </div>
                  <span className="appearance-card-label">{t[labelKey] as string}</span>
                  <span className="appearance-card-desc">{t[descKey] as string}</span>
                </button>
              )
            })}
          </div>
        </div>
        <label className="offset-field">
          {tCalendar.displayModeLabel}
          <select
            value={settings.calendarPnlDisplay ?? 'dollar'}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                calendarPnlDisplay: e.target.value as CalendarPnlDisplay,
              })
            }
          >
            <option value="dollar">{tCalendar.displayDollar}</option>
            <option value="percent">{tCalendar.displayPercent}</option>
            <option value="both">{tCalendar.displayBoth}</option>
          </select>
        </label>
      </section>

      <section className="panel settings-section">
        <h3>{t.goalsTitle}</h3>
        <p className="hint-inline">{t.goalsHint}</p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.autoCalcProfitGoals === true}
            onChange={(e) =>
              onSettingsChange({ ...settings, autoCalcProfitGoals: e.target.checked })
            }
          />
          {t.autoCalcProfitGoals}
        </label>
        <p className="hint-inline">{t.autoCalcProfitGoalsHint}</p>
        <div className="goals-grid goals-grid-3">
          <label>
            {t.dailyProfitGoal}
            <input
              type="number"
              step="any"
              value={settings.dailyProfitGoal ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                if (settings.autoCalcProfitGoals) {
                  onSettingsChange({ ...settings, ...deriveProfitGoals('daily', raw) })
                  return
                }
                onSettingsChange({
                  ...settings,
                  dailyProfitGoal: parseFloat(raw) || undefined,
                })
              }}
            />
          </label>
          <label>
            {t.weeklyProfitGoal}
            <input
              type="number"
              step="any"
              value={settings.weeklyProfitGoal ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                if (settings.autoCalcProfitGoals) {
                  onSettingsChange({ ...settings, ...deriveProfitGoals('weekly', raw) })
                  return
                }
                onSettingsChange({
                  ...settings,
                  weeklyProfitGoal: parseFloat(raw) || undefined,
                })
              }}
            />
          </label>
          <label>
            {t.monthlyProfitGoal}
            <input
              type="number"
              step="any"
              value={settings.monthlyProfitGoal ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                if (settings.autoCalcProfitGoals) {
                  onSettingsChange({ ...settings, ...deriveProfitGoals('monthly', raw) })
                  return
                }
                onSettingsChange({
                  ...settings,
                  monthlyProfitGoal: parseFloat(raw) || undefined,
                })
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
            <label className="check-row settings-danger-toggle">
              <input
                type="checkbox"
                checked={settings.autoCloseOnDayRule === true}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    autoCloseOnDayRule: e.target.checked,
                  })
                }
              />
              {t.autoCloseOnDayRule}
            </label>
            <p className="hint-inline">{t.autoCloseOnDayRuleHint}</p>
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
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.showGoalReachedMessage !== false}
            onChange={(e) =>
              onSettingsChange({ ...settings, showGoalReachedMessage: e.target.checked })
            }
          />
          {t.showGoalReachedMessage}
        </label>
        <button type="button" className="btn-ghost-sm" onClick={testNotify}>
          {t.testNotification}
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
        <h3>{t.syncTitle}</h3>
        <p className="hint-inline">{t.syncHint}</p>
        <div className="settings-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={reloading}
            onClick={() => void handleReloadBridge()}
          >
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
            onChange={(e) =>
              onSettingsChange({ ...settings, updateFeedUrl: e.target.value || undefined })
            }
          />
        </label>
        <button type="button" className="btn-secondary" onClick={() => void checkForUpdatesDesktop()}>
          {t.checkUpdates}
        </button>
      </section>

      <section className="panel settings-section">
        <h3>{t.aboutTitle}</h3>
        <ul className="settings-list">
          <li>
            <span>{t.version}</span>
            <span>{info?.version ?? `${APP_VERSION} (web)`}</span>
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
        <button type="button" className="btn-ghost-sm" onClick={onShowWelcome}>
          {t.showWelcome}
        </button>
      </section>

      {msg && <p className="import-msg">{msg}</p>}
    </div>
  )
}
