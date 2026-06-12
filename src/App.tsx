import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { parseLocalDateKey } from './lib/mt5Date'
import type { CashMovement, CashType } from './types/account'
import type { Trade } from './types/trade'
import { Calendar } from './components/Calendar'
import { Mt5StatusPanel } from './components/Mt5Status'
import { SystemHealthPanel, type HealthCheck } from './components/SystemHealth'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { ProjectionPanel } from './components/ProjectionPanel'
import { DayHero } from './components/DayHero'
import { ThresholdRulesPanel } from './components/ThresholdRulesPanel'
import { buildEquityCurve } from './lib/analytics'
import { SettingsPanel } from './components/SettingsPanel'
import { WelcomeModal } from './components/WelcomeModal'
import { BrokerWizardModal } from './components/BrokerWizardModal'
import { UpdateBanner } from './components/UpdateBanner'
import { TradeSearchPanel } from './components/TradeSearchPanel'
import { SessionSummaryModal } from './components/SessionSummaryModal'
import { TradeMetaModal } from './components/TradeMetaModal'
import { useMt5Sync } from './hooks/useMt5Sync'
import { formatOutflow, formatInflow, sumDayOutflow } from './lib/displayMoney'
import {
  buildAccountSummary,
  buildDayActivities,
  currentBalance,
  dayActivityMap,
  netTradePnl,
} from './lib/account'
import { mergeLiveDayMap } from './lib/dayMapLive'
import {
  formatMoney,
  groupByPeriod,
  pnlClass,
  winRate,
} from './lib/aggregations'
import { importFromFile } from './lib/excelImport'
import { mergeCashBySignature, mergeTrades } from './lib/mergeTrades'
import {
  createId,
  loadCashMovements,
  loadSettings,
  loadTrades,
  saveCashMovements,
  saveSettings,
  saveTrades,
} from './lib/storage'
import {
  loadDailyNotes,
  loadTradeMetaMap,
  saveDailyNotes,
  saveTradeMetaMap,
} from './lib/journalStorage'
import type { PeriodView } from './types/trade'
import type { DailyNote, TradeMeta } from './types/journal'
import {
  alertsEnabled,
  evaluateThresholdRules,
  hasThresholdWarning,
  isTradingRulesEnabled,
} from './lib/thresholdRules'
import { type BackupBundle } from './lib/backup'
import { desktopNotify, getDesktopInfo } from './lib/desktop'
import { tradeMetaKey as journalTradeKey } from './lib/journalStorage'
import {
  getDateLocale,
  getTranslations,
  interpolate,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from './i18n'
import './App.css'

const emptyTrade = (date: string): Omit<Trade, 'id'> => ({
  date,
  symbol: '',
  side: 'long',
  quantity: 1,
  entryPrice: 0,
  exitPrice: 0,
  pnl: 0,
  fees: 0,
  notes: '',
})

function App() {
  const [trades, setTrades] = useState<Trade[]>(() => loadTrades())
  const [cash, setCash] = useState<CashMovement[]>(() => loadCashMovements())
  const [settings, setSettings] = useState(() => loadSettings())
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [period, setPeriod] = useState<PeriodView>('month')
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showCashForm, setShowCashForm] = useState(false)
  const [tradeForm, setTradeForm] = useState(() => emptyTrade(format(new Date(), 'yyyy-MM-dd')))
  const [cashForm, setCashForm] = useState({ type: 'deposit' as CashType, amount: 0, notes: '' })
  const [mainTab, setMainTab] = useState<'day' | 'analytics' | 'projection' | 'settings'>('day')
  const [showWelcome, setShowWelcome] = useState(false)
  const [showBrokerWizard, setShowBrokerWizard] = useState(false)
  const [showSessionSummary, setShowSessionSummary] = useState(false)
  const [tradeMetaMap, setTradeMetaMap] = useState<Record<string, TradeMeta>>(() => loadTradeMetaMap())
  const [dailyNotesMap, setDailyNotesMap] = useState<Record<string, DailyNote>>(() => loadDailyNotes())
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const mt5ConnectedOnce = useRef(false)

  const persistTrades = useCallback((next: Trade[]) => {
    setTrades(next)
    saveTrades(next)
  }, [])

  const persistCash = useCallback((next: CashMovement[]) => {
    setCash(next)
    saveCashMovements(next)
  }, [])

  const persistSettings = useCallback((next: typeof settings) => {
    setSettings(next)
    saveSettings(next)
  }, [])

  const persistTradeMeta = useCallback((map: Record<string, TradeMeta>) => {
    setTradeMetaMap(map)
    saveTradeMetaMap(map)
  }, [])

  const persistDailyNotes = useCallback((map: Record<string, DailyNote>) => {
    setDailyNotesMap(map)
    saveDailyNotes(map)
  }, [])

  const lang: AppLanguage = settings.language ?? 'es'
  const t = useMemo(() => getTranslations(lang), [lang])
  const dateLocale = useMemo(() => getDateLocale(lang), [lang])
  const tf = interpolate

  const {
    mt5Status,
    bridgeOnline,
    mt5Connected,
    lastSyncAt,
    bridgeTradeCount,
    openPositions,
    floatingPnl,
    syncError,
    hasBridgeData,
    verifying,
    verifyAll,
  } = useMt5Sync({
    trades,
    cash,
    settings,
    onTrades: persistTrades,
    onCash: persistCash,
    onSettings: persistSettings,
    language: lang,
  })

  const usingLiveData = bridgeOnline && hasBridgeData
  /** Siempre usar estado persistido (actualizado por sync); bridgeTrades puede ir desfasado */
  const activeTrades = trades
  const activeCash = cash

  const todayKey = format(new Date(), 'yyyy-MM-dd')

  const tradesForView = useMemo(
    () => activeTrades.map((t) => ({ ...t, date: t.date.slice(0, 10) })),
    [activeTrades],
  )
  const cashForView = useMemo(
    () => activeCash.map((c) => ({ ...c, date: c.date.slice(0, 10) })),
    [activeCash],
  )

  useEffect(() => {
    if (!settings.welcomeDismissed) setShowWelcome(true)
    else if (!settings.brokerConfigured) setShowBrokerWizard(true)
  }, [settings.welcomeDismissed, settings.brokerConfigured])

  useEffect(() => {
    void getDesktopInfo().then((info) => {
      if (!info?.isElectron) return
      const root = document.documentElement
      root.classList.add('desktop-app')
      const inset = info.titleBarInset ?? 0
      if (inset > 0) {
        root.classList.add('desktop-win')
        root.style.setProperty('--titlebar-inset', `${inset}px`)
      }
    })
  }, [])

  useEffect(() => {
    if (!hasBridgeData && !mt5Connected) return
    if (mt5ConnectedOnce.current) return
    mt5ConnectedOnce.current = true
    setSelectedDate(todayKey)
    setCalendarMonth(startOfMonth(new Date()))
    setTradeForm(emptyTrade(todayKey))
  }, [hasBridgeData, mt5Connected, todayKey])

  const todayClosedCount = useMemo(
    () => tradesForView.filter((t) => t.date === todayKey).length,
    [tradesForView, todayKey],
  )

  const healthChecks = useMemo((): HealthCheck[] => {
    const todayDetail =
      todayClosedCount > 0
        ? tf(t.health.closedToday, { count: todayClosedCount, date: todayKey })
        : openPositions.length > 0
          ? tf(t.health.openToday, {
              count: openPositions.length,
              pnl: formatMoney(floatingPnl),
            })
          : tf(t.health.noActivityToday, { date: todayKey })

    return [
      {
        id: 'bridge',
        label: t.health.bridge,
        ok: bridgeOnline,
        detail: bridgeOnline ? t.health.bridgeOk : t.health.bridgeOff,
      },
      {
        id: 'mt5',
        label: t.health.mt5,
        ok: Boolean(mt5Connected),
        detail: mt5Connected
          ? tf(t.health.mt5Account, { account: mt5Status?.account ?? '—' })
          : t.health.openMt5,
      },
      {
        id: 'data',
        label: t.health.trades,
        ok: activeTrades.length > 0,
        detail: tf(t.health.tradesInCalendar, { count: activeTrades.length }),
      },
      {
        id: 'today',
        label: t.health.today,
        ok: true,
        detail: todayDetail,
      },
      {
        id: 'sync',
        label: t.health.sync,
        ok: Boolean(lastSyncAt && Date.now() - lastSyncAt < 30_000),
        detail: lastSyncAt
          ? tf(t.health.syncAgo, { seconds: Math.round((Date.now() - lastSyncAt) / 1000) })
          : t.health.syncPending,
      },
    ]
  }, [
    bridgeOnline,
    mt5Connected,
    mt5Status,
    activeTrades.length,
    todayClosedCount,
    todayKey,
    lastSyncAt,
    openPositions.length,
    floatingPnl,
    t,
    tf,
  ])

  const latestTradeDate = useMemo(() => {
    if (activeTrades.length === 0) return null
    return activeTrades.map((t) => t.date).sort().pop() ?? null
  }, [activeTrades])

  const activities = useMemo(
    () => buildDayActivities(tradesForView, cashForView, settings),
    [tradesForView, cashForView, settings],
  )
  const dayMap = useMemo(
    () => mergeLiveDayMap(dayActivityMap(activities), todayKey, openPositions),
    [activities, todayKey, openPositions],
  )
  const selectedDay = dayMap.get(selectedDate)
  const balance = useMemo(() => currentBalance(activities, settings), [activities, settings])
  const account = useMemo(
    () => buildAccountSummary(tradesForView, cashForView, settings),
    [tradesForView, cashForView, settings],
  )

  const liveBalance = mt5Status?.balance ?? settings.brokerBalance ?? null
  const closedPnl = useMemo(() => netTradePnl(tradesForView), [tradesForView])

  const displayAccount = useMemo(() => {
    const base = buildAccountSummary(tradesForView, cashForView, settings)
    if (liveBalance == null) return { ...base, mt5NetProfit: closedPnl }
    return {
      ...base,
      brokerBalance: liveBalance,
      accountProfit: liveBalance - base.netCashIn,
      mt5NetProfit: closedPnl,
    }
  }, [tradesForView, cashForView, settings, liveBalance, closedPnl])

  const displayBalance = liveBalance != null ? liveBalance : balance

  const dayTrades = useMemo(
    () => tradesForView.filter((t) => t.date === selectedDate).sort((a, b) => b.pnl - a.pnl),
    [tradesForView, selectedDate],
  )
  const dayWinRate = useMemo(
    () => (dayTrades.length ? (dayTrades.filter((t) => t.pnl >= 0).length / dayTrades.length) * 100 : 0),
    [dayTrades],
  )
  const equityCurve = useMemo(() => buildEquityCurve(activities), [activities])
  const equityPoints = useMemo(() => equityCurve.slice(-90), [equityCurve])
  const dayHeroSubtitle = useMemo(() => {
    if (latestTradeDate && latestTradeDate !== todayKey) {
      return tf(t.header.lastTrade, { last: latestTradeDate, today: todayKey })
    }
    return t.header.selectDay
  }, [latestTradeDate, todayKey, t, tf])
  const dayCash = useMemo(
    () => cashForView.filter((c) => c.date === selectedDate),
    [cashForView, selectedDate],
  )
  const summaries = useMemo(
    () => groupByPeriod(activeTrades, period, dateLocale),
    [activeTrades, period, dateLocale],
  )
  const wr = useMemo(() => winRate(activeTrades), [activeTrades])
  const selectedDayPnl = selectedDay?.pnl ?? 0
  const dayNote = dailyNotesMap[selectedDate] ?? { text: '', whatWorked: '', whatFailed: '' }

  const todayDay = dayMap.get(todayKey)
  const todayDayTrades = useMemo(
    () => tradesForView.filter((t) => t.date === todayKey),
    [tradesForView, todayKey],
  )

  const thresholdRulesForDay = useMemo(
    () =>
      evaluateThresholdRules({
        settings,
        dayPnl: selectedDay?.pnl ?? 0,
        dayTrades: dayTrades,
        equityCurve,
        liveBalance: selectedDate === todayKey ? displayBalance : null,
        openCount: selectedDate === todayKey ? (selectedDay?.openCount ?? 0) : 0,
      }),
    [
      settings,
      selectedDay,
      dayTrades,
      equityCurve,
      displayBalance,
      selectedDate,
      todayKey,
    ],
  )

  const todayThresholdRules = useMemo(
    () =>
      evaluateThresholdRules({
        settings,
        dayPnl: todayDay?.pnl ?? 0,
        dayTrades: todayDayTrades,
        equityCurve,
        liveBalance: displayBalance,
        openCount: todayDay?.openCount ?? 0,
      }),
    [settings, todayDay, todayDayTrades, equityCurve, displayBalance],
  )

  const todayRuleBreach = isTradingRulesEnabled(settings) && hasThresholdWarning(todayThresholdRules)
  const thresholdNotified = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!alertsEnabled(settings) || !todayRuleBreach) return
    for (const rule of todayThresholdRules) {
      if (rule.status !== 'warn') continue
      const key = `${todayKey}:${rule.id}`
      if (thresholdNotified.current.has(key)) continue
      thresholdNotified.current.add(key)
      void desktopNotify(
        'Trading Journal',
        t.thresholds.interruptBanner,
        settings.desktopNotifications !== false,
      )
    }
  }, [
    todayRuleBreach,
    todayThresholdRules,
    todayKey,
    settings,
    t.thresholds.interruptBanner,
  ])

  const saveDayNote = (patch: Partial<DailyNote>) => {
    const next = {
      ...dailyNotesMap,
      [selectedDate]: { ...dayNote, ...patch },
    }
    persistDailyNotes(next)
  }

  const saveTradeMeta = (trade: Trade, meta: TradeMeta) => {
    const key = journalTradeKey(trade)
    persistTradeMeta({ ...tradeMetaMap, [key]: meta })
    setEditingTrade(null)
  }

  const handleRestoreBackup = (bundle: BackupBundle) => {
    persistTrades(bundle.trades)
    persistCash(bundle.cash)
    persistSettings({ ...settings, ...bundle.settings })
    persistTradeMeta(bundle.tradeMeta)
    persistDailyNotes(bundle.dailyNotes)
    void verifyAll()
  }

  const handleBrokerComplete = (preset: string, offsetHours: number, label: string) => {
    persistSettings({
      ...settings,
      brokerConfigured: true,
      brokerPreset: preset,
      mt5ServerOffsetHours: offsetHours,
      accountLabel: label,
    })
    setShowBrokerWizard(false)
  }

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    setMainTab('day')
    setTradeForm(emptyTrade(date))
    setCalendarMonth(startOfMonth(parseLocalDateKey(date)))
  }

  const handleImport = async (file: File) => {
    setImportMsg(null)
    const result = await importFromFile(file)
    if (result.errors.length > 0) {
      setImportMsg(result.errors.join(' '))
      return
    }
    if (result.trades.length === 0 && result.cashMovements.length === 0) {
      setImportMsg(t.importModal.nothingImported)
      return
    }

    const mergedTrades = mergeTrades(trades, result.trades)
    const mergedCash = mergeCashBySignature(cash, result.cashMovements)
    persistTrades(mergedTrades)
    persistCash(mergedCash)

    if (result.brokerBalance != null) {
      const next = {
        ...settings,
        brokerBalance: result.brokerBalance,
        brokerBalanceDate: result.brokerBalanceDate,
        mt5NetProfit: result.mt5NetProfit,
        initialBalance: 0,
      }
      setSettings(next)
      saveSettings(next)
    }

    const dates = [...result.trades.map((t) => t.date), ...result.cashMovements.map((c) => c.date)]
    if (dates.length > 0) {
      const latest = dates.sort().at(-1)!
      handleSelectDate(latest)
    }

    const balNote =
      result.brokerBalance != null
        ? ` ${t.importModal.brokerBalance} $${result.brokerBalance.toFixed(2)}.`
        : ''
    setImportMsg(
      `${t.importModal.updated} ${result.trades.length} ${t.importModal.positions}, ${result.cashMovements.length} ${t.importModal.movements}` +
        (result.skipped > 0 ? ` · ${result.skipped} ${t.importModal.rowsSkipped}` : '') +
        `.${balNote}`,
    )
    setShowImport(false)
  }

  const handleTradeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tradeForm.symbol.trim()) return
    const trade: Trade = {
      ...tradeForm,
      id: createId(),
      symbol: tradeForm.symbol.trim().toUpperCase(),
    }
    persistTrades([trade, ...trades])
    setTradeForm(emptyTrade(selectedDate))
  }

  const handleCashSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (cashForm.amount <= 0) return
    const movement: CashMovement = {
      id: createId(),
      date: selectedDate,
      type: cashForm.type,
      category: cashForm.type,
      amount: cashForm.amount,
      notes: cashForm.notes.trim(),
    }
    persistCash([movement, ...cash])
    setCashForm({ type: 'deposit', amount: 0, notes: '' })
    setShowCashForm(false)
  }

  const periodLabels: Record<PeriodView, string> = {
    day: t.period.day,
    week: t.period.week,
    month: t.period.month,
    year: t.period.year,
  }

  const cashCategoryLabel = (category: CashMovement['category']) => {
    switch (category) {
      case 'deposit':
        return t.trades.categoryDeposit
      case 'withdraw':
        return t.trades.categoryWithdraw
      case 'transfer_in':
        return t.trades.categoryTransferIn
      case 'transfer_out':
        return t.trades.categoryTransferOut
      default:
        return t.trades.categoryFee
    }
  }

  const handleLanguageChange = (next: AppLanguage) => {
    persistSettings({ ...settings, language: next })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-scroll">
        <header className="sidebar-top">
          <div className="sidebar-brand">
            <span className="logo">TJ</span>
            <div>
              <h1>Trading Journal</h1>
              <p>{t.brand.subtitle}</p>
            </div>
          </div>
          <label className="lang-select lang-select-inline">
            <select
              value={lang}
              onChange={(e) => handleLanguageChange(e.target.value as AppLanguage)}
              aria-label={t.language.label}
            >
              {SUPPORTED_LANGUAGES.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        <Calendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          dayMap={dayMap}
          cash={cashForView}
          calendar={t.calendar}
          dateLocale={dateLocale}
          displayMode={settings.calendarPnlDisplay ?? 'dollar'}
          onDisplayModeChange={(mode) => persistSettings({ ...settings, calendarPnlDisplay: mode })}
          initialBalance={settings.initialBalance}
        />
        </div>

        <div className="sidebar-footer">
        <Mt5StatusPanel
          bridgeOnline={bridgeOnline}
          mt5Connected={mt5Connected}
          status={mt5Status}
          lastSyncAt={lastSyncAt}
          tradeCount={bridgeTradeCount || activeTrades.length}
          liveTradeCount={activeTrades.length || bridgeTradeCount}
          usingLiveTrades={usingLiveData}
          openPositions={openPositions}
          floatingPnl={floatingPnl}
          syncError={syncError}
          onSyncNow={() => void verifyAll()}
          mt5={t.mt5}
          dateLocale={dateLocale}
        />

        <div className="sidebar-actions">
          <button type="button" className="btn-primary full" onClick={() => setShowSessionSummary(true)}>
            {t.session.button}
          </button>
          <button type="button" className="btn-secondary full btn-sidebar-muted" onClick={() => fileRef.current?.click()}>
            {t.sidebar.importExcel}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImport(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn-secondary full" onClick={() => setShowCashForm((v) => !v)}>
            {t.sidebar.depositWithdraw}
          </button>
        </div>

        {importMsg && <p className="import-msg sidebar-msg">{importMsg}</p>}
        </div>
      </aside>

      <div className="content">
        <header className="app-topbar">
        <SystemHealthPanel
          checks={healthChecks}
          onRefresh={() => void verifyAll()}
          refreshing={verifying}
          health={t.health}
        />

        <UpdateBanner t={t.updates} />

        <nav className="main-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'day'}
            className={mainTab === 'day' ? 'active' : ''}
            onClick={() => setMainTab('day')}
          >
            {t.nav.day}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'analytics'}
            className={mainTab === 'analytics' ? 'active' : ''}
            onClick={() => setMainTab('analytics')}
          >
            {t.nav.analytics}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'projection'}
            className={mainTab === 'projection' ? 'active' : ''}
            onClick={() => setMainTab('projection')}
          >
            {t.nav.projection}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === 'settings'}
            className={mainTab === 'settings' ? 'active' : ''}
            onClick={() => setMainTab('settings')}
          >
            {t.nav.settings}
          </button>
        </nav>
        </header>

        {todayRuleBreach && (
          <div className="threshold-interrupt" role="alert">
            {t.thresholds.interruptBanner}
          </div>
        )}

        {mainTab === 'settings' ? (
          <SettingsPanel
            settings={settings}
            onSettingsChange={persistSettings}
            trades={tradesForView}
            cash={cashForView}
            tradeMeta={tradeMetaMap}
            dailyNotes={dailyNotesMap}
            onRestore={handleRestoreBackup}
            onShowWelcome={() => setShowWelcome(true)}
            onResyncDone={() => void verifyAll()}
            t={t.settings}
          />
        ) : mainTab === 'analytics' ? (
          <AnalyticsPanel
            trades={tradesForView}
            activities={activities}
            settings={settings}
            onSettingsChange={persistSettings}
            metaMap={tradeMetaMap}
            selectedDate={selectedDate}
            selectedDayPnl={selectedDayPnl}
            t={t.analytics}
            tJournal={t.journal}
            dateLocale={dateLocale}
          />
        ) : mainTab === 'projection' ? (
          <ProjectionPanel
            activities={[...dayMap.values()]}
            startBalance={displayBalance}
            asOfDate={todayKey}
            t={t.projection}
          />
        ) : (
          <div className="tab-panel-day">
        {isTradingRulesEnabled(settings) && (
          <ThresholdRulesPanel rules={thresholdRulesForDay} t={t.thresholds} />
        )}

        <DayHero
          selectedDate={selectedDate}
          selectedDay={selectedDay}
          dayTradeCount={dayTrades.length}
          dayWinRate={dayWinRate}
          displayBalance={displayBalance}
          equityPoints={equityPoints}
          dateFormat={t.header.dateFormat}
          dateLocale={dateLocale}
          subtitle={dayHeroSubtitle}
          hideChart={selectedDate === todayKey && todayRuleBreach}
          t={t.dayHero}
        />

        <main className="main-grid">
          <section className="panel day-panel">
            <h3>{t.daySummary.title}</h3>
            {selectedDay ? (
              <div className="day-stats day-stats-compact">
                {(selectedDay.openCount ?? 0) > 0 && selectedDate === todayKey && (
                  <div className="day-stat">
                    <span className="label">{t.daySummary.openToday}</span>
                    <span className={`val ${pnlClass(selectedDay.livePnl ?? 0)}`}>
                      {selectedDay.openCount} · {formatMoney(selectedDay.livePnl ?? 0)}
                    </span>
                  </div>
                )}
                <div className="day-stat">
                  <span className="label">{t.daySummary.deposits}</span>
                  <span className="val positive">
                    {formatInflow(
                      dayCash
                        .filter((c) => c.category === 'deposit' || c.category === 'transfer_in')
                        .reduce((s, c) => s + c.amount, 0) || selectedDay.deposits,
                    )}
                  </span>
                </div>
                <div className="day-stat" title={t.header.outflowHint}>
                  <span className="label">{t.daySummary.withdrawals}</span>
                  <span className="val cash-out">
                    {formatOutflow(sumDayOutflow(dayCash, selectedDay))}
                  </span>
                </div>
                {selectedDay.otherFees > 0 && (
                  <div className="day-stat">
                    <span className="label">{t.daySummary.divsAdjustments}</span>
                    <span className="val negative">{formatMoney(-selectedDay.otherFees)}</span>
                  </div>
                )}
                <div className="day-stat highlight">
                  <span className="label">{t.daySummary.estimatedBalance}</span>
                  <span className="val">{formatMoney(selectedDay.endBalance).replace('+', '')}</span>
                </div>
              </div>
            ) : (
              <p className="empty">{t.daySummary.noActivity}</p>
            )}

            <div className="daily-notes">
              <h4 className="sub-head">{t.journal.dailyNotes}</h4>
              <label>
                <textarea
                  rows={2}
                  value={dayNote.text}
                  onChange={(e) => saveDayNote({ text: e.target.value })}
                  placeholder="…"
                />
              </label>
              <div className="notes-row">
                <label>
                  {t.journal.whatWorked}
                  <input
                    type="text"
                    value={dayNote.whatWorked}
                    onChange={(e) => saveDayNote({ whatWorked: e.target.value })}
                  />
                </label>
                <label>
                  {t.journal.whatFailed}
                  <input
                    type="text"
                    value={dayNote.whatFailed}
                    onChange={(e) => saveDayNote({ whatFailed: e.target.value })}
                  />
                </label>
              </div>
            </div>

          </section>

          <section className="panel deductions-panel">
            <h3>{t.finance.title}</h3>
            <ul className="deductions-list">
              <li>
                <span>{t.finance.depositsIn}</span>
                <span className="positive">+${account.totalDeposits.toFixed(2)}</span>
              </li>
              <li>
                <span title={t.header.outflowHint}>{t.finance.withdrawalsOut}</span>
                <span className="cash-out">${account.totalWithdraws.toFixed(2)}</span>
              </li>
              <li>
                <span>{t.finance.netDeposits}</span>
                <span>{formatMoney(account.netCashIn).replace('+', '')}</span>
              </li>
              <li className="sep">
                <span>{t.finance.accountProfit}</span>
                <span className={pnlClass(displayAccount.accountProfit)}>
                  {formatMoney(displayAccount.accountProfit)}
                </span>
              </li>
              <li className="hint-row">
                <span className="hint-text">{t.finance.balanceFormula}</span>
              </li>
            </ul>
            <h4 className="sub-head">{t.finance.tradeDeductions}</h4>
            <ul className="deductions-list">
              <li>
                <span>{t.finance.swap}</span>
                <span className="negative">−${account.swap.toFixed(2)}</span>
              </li>
              <li>
                <span>{t.finance.transfersOut}</span>
                <span className="negative">−${account.transfersOut.toFixed(2)}</span>
              </li>
              <li>
                <span>{t.finance.closedPnlMt5}</span>
                <span className={pnlClass(displayAccount.mt5NetProfit)}>
                  {formatMoney(displayAccount.mt5NetProfit)}
                </span>
              </li>
            </ul>
            {Math.abs(displayAccount.mt5NetProfit - displayAccount.accountProfit) > 1 && (
              <p className="hint-inline">
                {tf(t.finance.mismatchHint, {
                  closed: formatMoney(displayAccount.mt5NetProfit),
                  profit: formatMoney(displayAccount.accountProfit),
                })}
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>
                {t.trades.dayTitle} ({dayTrades.length})
              </h3>
              <button type="button" className="btn-ghost-sm" onClick={() => setShowImport(true)}>
                {t.trades.importHelp}
              </button>
            </div>
            {dayTrades.length === 0 ? (
              <p className="empty">{t.trades.empty}</p>
            ) : (
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>{t.trades.symbol}</th>
                    <th>{t.trades.side}</th>
                    <th>{t.trades.netPnl}</th>
                    <th>{t.trades.deductions}</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dayTrades.map((trade) => {
                    const meta = tradeMetaMap[journalTradeKey(trade)]
                    return (
                    <tr key={trade.id}>
                      <td>
                        {trade.symbol}
                        {meta?.tags?.length ? (
                          <span className="hint-text"> · {meta.tags.join(', ')}</span>
                        ) : null}
                      </td>
                      <td>{t.side[trade.side]}</td>
                      <td className={pnlClass(trade.pnl)}>
                        {formatMoney(trade.pnl)}
                      </td>
                      <td className="negative">
                        {trade.fees > 0 ? `−$${trade.fees.toFixed(2)}` : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => setEditingTrade(trade)}
                        >
                          {t.journal.journalBtn}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => {
                            if (confirm(t.trades.deleteConfirm))
                              persistTrades(trades.filter((x) => x.id !== trade.id))
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            )}

            {dayCash.length > 0 && (
              <>
                <h4 className="sub-head">{t.trades.accountMovements}</h4>
                <ul className="cash-list">
                  {dayCash.map((c) => (
                    <li key={c.id} className={c.category}>
                      <span>{cashCategoryLabel(c.category)}</span>
                      <span className={c.type === 'deposit' ? 'positive' : 'negative'}>
                        {c.type === 'deposit' ? '+' : '-'}${c.amount.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          if (confirm(t.trades.deleteConfirm))
                            persistCash(cash.filter((x) => x.id !== c.id))
                        }}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <form onSubmit={handleTradeSubmit} className="inline-form">
              <input
                type="text"
                placeholder={t.trades.symbolPlaceholder}
                value={tradeForm.symbol}
                onChange={(e) => setTradeForm({ ...tradeForm, symbol: e.target.value })}
                required
              />
              <input
                type="number"
                step="any"
                placeholder={t.trades.pnlPlaceholder}
                value={tradeForm.pnl || ''}
                onChange={(e) => setTradeForm({ ...tradeForm, pnl: parseFloat(e.target.value) || 0 })}
              />
              <button type="submit" className="btn-primary">
                {t.trades.add}
              </button>
            </form>
          </section>

          <TradeSearchPanel
            trades={tradesForView}
            metaMap={tradeMetaMap}
            t={t.search}
            sideLabels={t.side}
            onSelectDate={handleSelectDate}
          />

          <section className="panel span-2">
            <div className="panel-head">
              <h3>
                {t.period.view} {periodLabels[period]}
              </h3>
              <div className="period-btns">
                {(Object.keys(periodLabels) as PeriodView[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={period === p ? 'active' : ''}
                    onClick={() => setPeriod(p)}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>
            </div>
            {summaries.length === 0 ? (
              <p className="empty">{t.period.empty}</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t.period.period}</th>
                    <th>{t.period.trades}</th>
                    <th>{t.period.pnl}</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.key}>
                      <td>{s.label}</td>
                      <td>{s.trades}</td>
                      <td className={pnlClass(s.pnl)}>{formatMoney(s.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="hint-inline">
              {t.period.winRate} {wr.toFixed(1)}% · {trades.length} {t.period.positions}
            </p>
          </section>
        </main>
          </div>
        )}
      </div>

      {showWelcome && (
        <WelcomeModal
          onClose={() => {
            setShowWelcome(false)
            if (!settings.brokerConfigured) setShowBrokerWizard(true)
          }}
          onDismissForever={() => {
            persistSettings({ ...settings, welcomeDismissed: true })
            setShowWelcome(false)
            if (!settings.brokerConfigured) setShowBrokerWizard(true)
          }}
          t={t.welcome}
        />
      )}

      {showBrokerWizard && (
        <BrokerWizardModal
          brokerNames={t.broker.names}
          t={t.broker}
          onComplete={handleBrokerComplete}
        />
      )}

      {showSessionSummary && (
        <SessionSummaryModal
          date={selectedDate}
          day={selectedDay}
          dayTrades={dayTrades}
          dayCash={dayCash}
          settings={settings}
          dayNote={dayNote}
          t={t.session}
          onClose={() => setShowSessionSummary(false)}
          onEditNotes={() => {
            setShowSessionSummary(false)
            setMainTab('day')
          }}
        />
      )}

      {editingTrade && (
        <TradeMetaModal
          trade={editingTrade}
          meta={tradeMetaMap[journalTradeKey(editingTrade)] ?? {}}
          onSave={(meta) => saveTradeMeta(editingTrade, meta)}
          onClose={() => setEditingTrade(null)}
          t={t.journal}
        />
      )}

      {showCashForm && (
        <div className="modal-backdrop" onClick={() => setShowCashForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {t.cashModal.title} — {selectedDate}
            </h3>
            <form onSubmit={handleCashSubmit} className="modal-form">
              <label>
                {t.cashModal.type}
                <select
                  value={cashForm.type}
                  onChange={(e) => setCashForm({ ...cashForm, type: e.target.value as CashType })}
                >
                  <option value="deposit">{t.cashModal.deposit}</option>
                  <option value="withdraw">{t.cashModal.withdraw}</option>
                </select>
              </label>
              <label>
                {t.cashModal.amount}
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={cashForm.amount || ''}
                  onChange={(e) => setCashForm({ ...cashForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </label>
              <label>
                {t.cashModal.notes}
                <input
                  type="text"
                  value={cashForm.notes}
                  onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowCashForm(false)}>
                  {t.cashModal.cancel}
                </button>
                <button type="submit" className="btn-primary">
                  {t.cashModal.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t.importModal.title}</h3>
            <p className="hint">{t.importModal.hint}</p>
            <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>
              {t.importModal.selectFile}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowImport(false)}>
              {t.importModal.close}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
