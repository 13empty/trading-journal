import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, startOfMonth } from 'date-fns'
import { parseLocalDateKey } from './lib/mt5Date'
import type { CashMovement, CashType } from './types/account'
import type { Trade } from './types/trade'
import { Calendar } from './components/Calendar'
import { SystemHealthPanel, type HealthCheck } from './components/SystemHealth'
import { AnalyticsPanel } from './components/AnalyticsPanel'
import { ProjectionPanel } from './components/ProjectionPanel'
import { DayHero } from './components/DayHero'
import { DayStatusChips } from './components/DayStatusChips'
import { SideNav, type MainTab } from './components/SideNav'
import { AccountStatsBar } from './components/AccountStatsBar'
import { SyncHubPanel } from './components/SyncHubPanel'
import { HomeRightPanel } from './components/HomeRightPanel'
import { ProgressDock } from './components/ProgressDock'
import { Mt5StatusButton } from './components/Mt5StatusButton'
import { DayNotesModal } from './components/DayNotesModal'
import { buildEquityCurve, effectiveRR, realizedR } from './lib/analytics'
import { SettingsPanel } from './components/SettingsPanel'
import { WelcomeModal } from './components/WelcomeModal'
import { BrokerWizardModal } from './components/BrokerWizardModal'
import { UpdateBanner } from './components/UpdateBanner'
import { DayTradeJournalBar } from './components/DayTradeJournalBar'
import { WeeklySummaryModal } from './components/WeeklySummaryModal'
import { SessionSummaryModal } from './components/SessionSummaryModal'
import { TradeMetaModal } from './components/TradeMetaModal'
import { TradeReviewModal } from './components/TradeReviewModal'
import { useMt5Sync } from './hooks/useMt5Sync'
import { useCalendarSplit, useNavSplit } from './hooks/useCalendarSplit'
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
  subscribeSettings,
} from './lib/storage'
import {
  loadDailyNotes,
  loadTradeMetaMap,
  loadWeeklyNotes,
  saveDailyNotes,
  saveTradeMetaMap,
  saveWeeklyNotes,
  tradeMetaKey as journalTradeKey,
} from './lib/journalStorage'
import type { DailyNote, TradeMeta, WeeklyNote, ThresholdRuleId } from './types/journal'
import {
  alertsEnabled,
  drawdownPeakWarning,
  evaluateThresholdRulesForDate,
  hasDayStopWarning,
  hasThresholdWarning,
  isTradingRulesEnabled,
  THRESHOLD_LABEL_KEYS,
} from './lib/thresholdRules'
import {
  evaluateProfitGoals,
  hasAnyProfitGoal,
  PROFIT_GOAL_LABEL_KEYS,
} from './lib/profitGoals'
import { notifyOnce, pruneNotifyKeys } from './lib/notifyOnce'
import { computeDayJournalStats, tradeHasJournalMeta } from './lib/tradeJournalStats'
import { buildWeeklySummary } from './lib/weeklySummary'
import { type BackupBundle } from './lib/backup'
import { desktopNotify, getDesktopInfo, setTitleBarThemeDesktop, readAppViewParam, openAppView, focusMainWindow, type AppWindowView } from './lib/desktop'
import { requestCloseAllPositions, waitForCloseAllResult } from './lib/mt5Bridge'
import { applyAppearance, resolveAppearance } from './lib/theme'
import {
  getDateLocale,
  getTranslations,
  interpolate,
  type AppLanguage,
} from './i18n'
import './App.css'

/** Day-only rules that can trigger auto-close (not revenge / drawdown peak). */
const DAY_CLOSE_RULES: ThresholdRuleId[] = ['daily_loss', 'max_trades']

const EMPTY_TRADE_META: TradeMeta = {}

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
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showCashForm, setShowCashForm] = useState(false)
  const [tradeForm, setTradeForm] = useState(() => emptyTrade(format(new Date(), 'yyyy-MM-dd')))
  const [cashForm, setCashForm] = useState({ type: 'deposit' as CashType, amount: 0, notes: '' })
  const windowView = useMemo(() => readAppViewParam(), [])
  const isHomeWindow = windowView === 'home'
  const [mainTab, setMainTab] = useState<MainTab>(() =>
    windowView === 'home' ? 'calendar' : windowView,
  )
  const [showWelcome, setShowWelcome] = useState(false)
  const [showBrokerWizard, setShowBrokerWizard] = useState(false)
  const [showSessionSummary, setShowSessionSummary] = useState(false)
  const [showWeeklySummary, setShowWeeklySummary] = useState(false)
  const [showDayNotes, setShowDayNotes] = useState(false)
  const [tradeMetaMap, setTradeMetaMap] = useState<Record<string, TradeMeta>>(() => loadTradeMetaMap())
  const [dailyNotesMap, setDailyNotesMap] = useState<Record<string, DailyNote>>(() => loadDailyNotes())
  const [weeklyNotesMap, setWeeklyNotesMap] = useState<Record<string, WeeklyNote>>(() => loadWeeklyNotes())
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [reviewingTrade, setReviewingTrade] = useState<Trade | null>(null)
  const [journalTipVisible, setJournalTipVisible] = useState(() => {
    try {
      return localStorage.getItem('tj-journal-tip-dismissed') !== '1'
    } catch {
      return true
    }
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const mt5ConnectedOnce = useRef(false)
  const {
    pct: calendarColPct,
    bodyRef: mainBodyRef,
    onPointerDown: onSplitDown,
    onPointerMove: onSplitMove,
    endDrag: onSplitEnd,
    nudge: nudgeCalendarSplit,
    min: splitMin,
    max: splitMax,
  } = useCalendarSplit()
  const {
    width: navRailWidth,
    shellRef: appShellRef,
    onPointerDown: onNavSplitDown,
    onPointerMove: onNavSplitMove,
    endDrag: onNavSplitEnd,
    nudge: nudgeNavSplit,
    min: navSplitMin,
    max: navSplitMax,
  } = useNavSplit()

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

  const persistWeeklyNotes = useCallback((map: Record<string, WeeklyNote>) => {
    setWeeklyNotesMap(map)
    saveWeeklyNotes(map)
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
    let latest = activeTrades[0].date
    for (let i = 1; i < activeTrades.length; i++) {
      if (activeTrades[i].date > latest) latest = activeTrades[i].date
    }
    return latest
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
  const dayWinRate = useMemo(() => winRate(dayTrades), [dayTrades])
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
  const selectedDayPnl = selectedDay?.pnl ?? 0
  const dayNote = dailyNotesMap[selectedDate] ?? { text: '', whatWorked: '', whatFailed: '' }
  const hasDayNoteContent = Boolean(dayNote.text.trim() || dayNote.whatWorked.trim() || dayNote.whatFailed.trim())

  const todayDay = dayMap.get(todayKey)
  const todayDayTrades = useMemo(
    () => tradesForView.filter((t) => t.date === todayKey),
    [tradesForView, todayKey],
  )

  const thresholdRulesForDay = useMemo(
    () =>
      evaluateThresholdRulesForDate({
        settings,
        date: selectedDate,
        todayKey,
        dayPnl: selectedDay?.pnl ?? 0,
        dayTrades,
        equityCurve,
        day: selectedDay,
      }),
    [settings, selectedDate, selectedDay, dayTrades, equityCurve, todayKey],
  )

  const todayThresholdRules = useMemo(
    () =>
      evaluateThresholdRulesForDate({
        settings,
        date: todayKey,
        todayKey,
        dayPnl: todayDay?.pnl ?? 0,
        dayTrades: todayDayTrades,
        equityCurve,
        day: todayDay,
      }),
    [settings, todayDay, todayDayTrades, equityCurve, todayKey],
  )

  const todayRuleBreach = isTradingRulesEnabled(settings) && hasThresholdWarning(todayThresholdRules)
  const profitGoalsForDay = useMemo(
    () => evaluateProfitGoals(settings, dayMap, selectedDate),
    [settings, dayMap, selectedDate],
  )
  const todayGoals = useMemo(
    () => evaluateProfitGoals(settings, dayMap, todayKey),
    [settings, dayMap, todayKey],
  )
  const dayJournalStats = useMemo(
    () => computeDayJournalStats(dayTrades, tradeMetaMap, journalTradeKey),
    [dayTrades, tradeMetaMap],
  )
  const weeklySummary = useMemo(
    () => buildWeeklySummary(dayMap, tradesForView, selectedDate),
    [dayMap, tradesForView, selectedDate],
  )
  const weekNoteKey = weeklySummary.weekStart
  const weekNote = weeklyNotesMap[weekNoteKey] ?? { repeat: '', avoid: '', focus: '' }
  const todayBreachedRules = useMemo(
    () => todayThresholdRules.filter((r) => r.status === 'warn'),
    [todayThresholdRules],
  )
  const todayHasDayStop = useMemo(
    () => hasDayStopWarning(todayThresholdRules),
    [todayThresholdRules],
  )
  const todayDrawdownWarn = useMemo(
    () => drawdownPeakWarning(todayThresholdRules),
    [todayThresholdRules],
  )
  const thresholdNotified = useRef<Set<string>>(new Set())
  const goalNotified = useRef<Set<string>>(new Set())
  /** Confirmed successful auto-close for a given day (retry allowed until then). */
  const dayCloseDone = useRef<Set<string>>(new Set())
  const dayCloseInFlight = useRef(false)
  const dayCloseLastAttempt = useRef(0)
  const mt5AlertNotified = useRef(false)
  const mt5WasConnected = useRef(false)
  const notifyEnabled = settings.desktopNotifications !== false

  useEffect(() => {
    const id = resolveAppearance(settings)
    const preset = applyAppearance(id)
    void setTitleBarThemeDesktop(preset.titleBar)
  }, [settings.appearance, settings.uiMode])

  // Keep appearance / language / etc in sync across secondary windows.
  useEffect(() => {
    return subscribeSettings((next) => {
      setSettings((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev
        return next
      })
    })
  }, [])

  useEffect(() => {
    const active = new Set(
      todayThresholdRules.filter((r) => r.status === 'warn').map((r) => `${todayKey}:${r.id}`),
    )
    pruneNotifyKeys(active, thresholdNotified.current)
    // Only keep confirmed closes for the current day — drop yesterday's keys
    const closeActive = new Set(
      [...dayCloseDone.current].filter((k) => k.startsWith(`${todayKey}:`)),
    )
    pruneNotifyKeys(closeActive, dayCloseDone.current)
  }, [todayThresholdRules, todayKey])

  useEffect(() => {
    // Keep notify keys while still reached on closed PnL — avoids float flicker spam
    const active = new Set(
      todayGoals.filter((g) => g.status === 'reached').map((g) => `${todayKey}:${g.id}`),
    )
    pruneNotifyKeys(active, goalNotified.current)
  }, [todayGoals, todayKey])

  useEffect(() => {
    if (!alertsEnabled(settings) || !todayRuleBreach) return
    for (const rule of todayThresholdRules) {
      if (rule.status !== 'warn') continue
      const key = `${todayKey}:${rule.id}`
      const label = t.thresholds[THRESHOLD_LABEL_KEYS[rule.id]]
      const msg =
        rule.id === 'drawdown_peak'
          ? tf(t.notifications.drawdownBreached, { detail: rule.detail ?? label })
          : tf(t.notifications.ruleBreached, { rule: label })
      notifyOnce(thresholdNotified.current, key, t.brand.title, msg, notifyEnabled)
    }
  }, [
    todayRuleBreach,
    todayThresholdRules,
    todayKey,
    settings,
    notifyEnabled,
    t.brand.title,
    t.notifications.ruleBreached,
    t.notifications.drawdownBreached,
    t.thresholds,
    tf,
  ])

  useEffect(() => {
    if (!isTradingRulesEnabled(settings) || settings.autoCloseOnDayRule !== true) return
    if (!bridgeOnline || !mt5Connected) return
    if (openPositions.length === 0) return

    const dayBreach = todayThresholdRules.filter(
      (r) => r.status === 'warn' && DAY_CLOSE_RULES.includes(r.id),
    )
    if (dayBreach.length === 0) return

    const key = `${todayKey}:auto-close`
    if (dayCloseDone.current.has(key) || dayCloseInFlight.current) return
    // Back off between retries (bridge/Python may still be working)
    if (Date.now() - dayCloseLastAttempt.current < 15_000) return

    dayCloseInFlight.current = true
    dayCloseLastAttempt.current = Date.now()

    const ruleLabels = dayBreach
      .map((r) => t.thresholds[THRESHOLD_LABEL_KEYS[r.id]])
      .join(' · ')

    void (async () => {
      try {
        const queued = await requestCloseAllPositions('day_rule')
        if (!queued.ok || !queued.commandId) return

        const result = await waitForCloseAllResult(queued.commandId, 45_000)
        const closed = result.closed ?? 0
        const failed = result.failed ?? 0
        const success = result.ok === true && failed === 0
        // Also treat "nothing left to close" as success (0 positions when agent ran)
        const done = success || (closed > 0 && failed === 0)

        if (done) {
          dayCloseDone.current.add(key)
          if (notifyEnabled) {
            void desktopNotify(
              t.brand.title,
              tf(t.notifications.positionsClosed, { rule: ruleLabels }),
              true,
            )
          }
        }
        // On timeout / partial failure: leave key unset so a later effect can retry
      } finally {
        dayCloseInFlight.current = false
      }
    })()
  }, [
    settings,
    todayThresholdRules,
    todayKey,
    bridgeOnline,
    mt5Connected,
    openPositions.length,
    t.brand.title,
    t.thresholds,
    t.notifications.positionsClosed,
    tf,
    notifyEnabled,
  ])

  useEffect(() => {
    if (!hasAnyProfitGoal(settings)) return
    if (settings.showGoalReachedMessage === false) return
    for (const goal of todayGoals) {
      if (goal.status !== 'reached') continue
      const key = `${todayKey}:${goal.id}`
      const label = t.profitGoals[PROFIT_GOAL_LABEL_KEYS[goal.id]]
      notifyOnce(
        goalNotified.current,
        key,
        t.brand.title,
        tf(t.notifications.goalReached, { goal: label, amount: formatMoney(goal.current) }),
        notifyEnabled,
      )
    }
  }, [
    todayGoals,
    todayKey,
    settings,
    t.brand.title,
    t.profitGoals,
    t.notifications.goalReached,
    tf,
    notifyEnabled,
  ])

  useEffect(() => {
    const connected = bridgeOnline && mt5Connected
    if (connected) {
      mt5WasConnected.current = true
      mt5AlertNotified.current = false
      return
    }
    if (!mt5WasConnected.current || !notifyEnabled) return
    if (mt5AlertNotified.current) return
    mt5AlertNotified.current = true
    const body = bridgeOnline ? t.notifications.mt5Disconnected : t.notifications.bridgeOffline
    void desktopNotify(t.brand.title, body, true)
  }, [
    bridgeOnline,
    mt5Connected,
    notifyEnabled,
    t.brand.title,
    t.notifications.mt5Disconnected,
    t.notifications.bridgeOffline,
  ])

  const saveWeekNote = (patch: Partial<WeeklyNote>) => {
    persistWeeklyNotes({
      ...weeklyNotesMap,
      [weekNoteKey]: { ...weekNote, ...patch },
    })
  }

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
    setReviewingTrade(null)
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
    setTradeForm(emptyTrade(date))
    setCalendarMonth(startOfMonth(parseLocalDateKey(date)))
    // Home keeps the mockup; secondary in-app flows still open Diario content.
    if (!isHomeWindow && mainTab !== 'day') setMainTab('day')
  }

  const handleNavChange = useCallback(
    (tab: MainTab) => {
      if (tab === 'calendar') {
        if (!isHomeWindow) void focusMainWindow()
        return
      }
      if (isHomeWindow || tab !== windowView) {
        void openAppView(tab as AppWindowView)
        return
      }
      setMainTab(tab)
    },
    [isHomeWindow, windowView],
  )

  useEffect(() => {
    if (isHomeWindow) {
      document.title = 'Trading Journal'
      return
    }
    document.title = `Trading Journal — ${t.nav[windowView]}`
  }, [isHomeWindow, windowView, t.nav])

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

  const financeMismatchHint =
    Math.abs(displayAccount.mt5NetProfit - displayAccount.accountProfit) > 1
      ? tf(t.finance.mismatchHint, {
          closed: formatMoney(displayAccount.mt5NetProfit),
          profit: formatMoney(displayAccount.accountProfit),
        })
      : undefined

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

  return (
    <>
    <div className="titlebar-drag-region" aria-hidden />
    <div
      className={`app-shell${isHomeWindow ? ' app-shell-home' : ' app-shell-view'}`}
      ref={appShellRef}
      style={{ ['--nav-rail-width' as string]: `${navRailWidth}px` }}
    >
      <SideNav
        active={isHomeWindow ? 'calendar' : mainTab}
        onChange={handleNavChange}
        t={t.nav}
        brandTitle={t.brand.title}
        footer={
          <Mt5StatusButton
            bridgeOnline={bridgeOnline}
            mt5Connected={mt5Connected}
            onOpenSync={() => void openAppView('sync')}
            label="MT5"
            titles={{
              connected: t.mt5.title,
              waiting: t.mt5.waiting,
              offline: t.mt5.bridgeOff,
            }}
          />
        }
      />

      <div
        className="split-resize-handle split-resize-handle-nav"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(navRailWidth)}
        aria-valuemin={navSplitMin}
        aria-valuemax={navSplitMax}
        aria-label="Resize navigation"
        tabIndex={0}
        onPointerDown={onNavSplitDown}
        onPointerMove={onNavSplitMove}
        onPointerUp={onNavSplitEnd}
        onPointerCancel={onNavSplitEnd}
        onLostPointerCapture={onNavSplitEnd}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            nudgeNavSplit(-4)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            nudgeNavSplit(4)
          }
        }}
      />

      <div className="app-main">
      <div
        className="app-main-body"
        ref={mainBodyRef}
        style={isHomeWindow ? { ['--cal-col-pct' as string]: `${calendarColPct}%` } : undefined}
      >
      {isHomeWindow && (
      <>
      <aside className="calendar-col">
        <div className="calendar-col-scroll">
          <Calendar
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            dayMap={dayMap}
            cash={cashForView}
            calendar={t.calendar}
            dateLocale={dateLocale}
            displayMode={settings.calendarPnlDisplay ?? 'both'}
            onDisplayModeChange={(mode) => persistSettings({ ...settings, calendarPnlDisplay: mode })}
            initialBalance={settings.initialBalance}
          />
          <AccountStatsBar
            balance={displayBalance}
            equity={mt5Status?.equity ?? settings.brokerEquity ?? null}
            netProfit={displayAccount.accountProfit ?? closedPnl}
            trades={tradesForView}
            equityCurve={equityCurve}
            t={t.statsBar}
          />
        </div>
      </aside>

      <div
        className="split-resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(calendarColPct)}
        aria-valuemin={splitMin}
        aria-valuemax={splitMax}
        aria-label="Resize calendar"
        tabIndex={0}
        onPointerDown={onSplitDown}
        onPointerMove={onSplitMove}
        onPointerUp={onSplitEnd}
        onPointerCancel={onSplitEnd}
        onLostPointerCapture={onSplitEnd}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            nudgeCalendarSplit(-2)
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            nudgeCalendarSplit(2)
          }
        }}
      />
      </>
      )}

      <div className="content">
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
        <div className="content-scroll">
        <header className={`app-topbar${mainTab === 'calendar' ? ' app-topbar-minimal' : ''}`}>
        {mainTab !== 'calendar' && (
        <SystemHealthPanel
          checks={healthChecks}
          onRefresh={() => void verifyAll()}
          refreshing={verifying}
          health={t.health}
        />
        )}
        <UpdateBanner t={t.updates} />
        </header>

        {todayRuleBreach && (
          <div
            className={`threshold-interrupt${todayHasDayStop ? '' : ' threshold-interrupt-dd'}`}
            role="alert"
          >
            {todayHasDayStop
              ? t.thresholds.interruptBanner
              : interpolate(t.thresholds.interruptBannerDrawdown, {
                  detail: todayDrawdownWarn?.detail ?? '—',
                })}
            {todayBreachedRules.length > 0 && (
              <span className="threshold-interrupt-rules">
                {' '}
                ({todayBreachedRules.map((r) => t.thresholds[THRESHOLD_LABEL_KEYS[r.id]]).join(' · ')})
              </span>
            )}
          </div>
        )}

        {mainTab === 'calendar' ? (
          <HomeRightPanel
            selectedDate={selectedDate}
            selectedDay={selectedDay}
            dayTradeCount={dayTrades.length}
            dayWinRate={dayWinRate}
            displayBalance={displayBalance}
            equityPoints={equityPoints}
            dateFormat={t.header.dateFormat}
            dateLocale={dateLocale}
            profitGoals={profitGoalsForDay}
            thresholdRules={thresholdRulesForDay}
            showGoals={hasAnyProfitGoal(settings)}
            showRules={isTradingRulesEnabled(settings)}
            tHero={t.dayHero}
            tGoals={t.profitGoals}
            tThresholds={t.thresholds}
            goalsTitle={t.settings.goalsTitle}
            rulesTitle={t.settings.thresholdsTitle}
          />
        ) : mainTab === 'settings' ? (
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
            tLang={t.language}
            profitGoals={todayGoals}
            thresholdRules={todayThresholdRules}
            tGoals={t.profitGoals}
            tThresholds={t.thresholds}
          />
        ) : mainTab === 'sync' ? (
          <SyncHubPanel
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
            onSessionSummary={() => setShowSessionSummary(true)}
            onWeeklySummary={() => setShowWeeklySummary(true)}
            onImportExcel={() => fileRef.current?.click()}
            onCashForm={() => setShowCashForm(true)}
            onProjection={() => void openAppView('projection')}
            projectionLabel={t.nav.projection}
            importMsg={importMsg}
            mt5={t.mt5}
            sessionButton={t.session.button}
            weeklyButton={t.weekly.button}
            importExcel={t.sidebar.importExcel}
            depositWithdraw={t.sidebar.depositWithdraw}
            dateLocale={dateLocale}
            t={t.syncHub}
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
            tRiskAdvice={t.riskAdvice}
            tFinance={t.finance}
            tSearch={t.search}
            tPeriod={t.period}
            sideLabels={t.side}
            displayAccount={displayAccount}
            displayBalance={displayBalance}
            mismatchHint={financeMismatchHint}
            onSelectDate={handleSelectDate}
            dateLocale={dateLocale}
          />
        ) : mainTab === 'projection' ? (
          <ProjectionPanel
            activities={[...dayMap.values()]}
            startBalance={displayBalance}
            asOfDate={todayKey}
            dateLocale={dateLocale}
            t={t.projection}
          />
        ) : (
          <div className="tab-panel-day">
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
              showChart={false}
              showRecentSummary
              hideChart={selectedDate === todayKey && todayRuleBreach}
              t={t.dayHero}
            />

            <DayStatusChips
              profitGoals={profitGoalsForDay}
              thresholdRules={thresholdRulesForDay}
              showGoals={hasAnyProfitGoal(settings)}
              showRules={isTradingRulesEnabled(settings)}
              showGoalReachedMessage={settings.showGoalReachedMessage !== false}
              t={t.dayTab}
              tGoals={t.profitGoals}
            />

            <main className="main-grid day-grid-clean">
              <section className="panel day-trades-panel">
                <div className="panel-head">
                  <h3>
                    {t.trades.dayTitle} ({dayTrades.length})
                  </h3>
                  <div className="panel-head-actions">
                    <button
                      type="button"
                      className={`btn-ghost-sm${hasDayNoteContent ? ' has-dot' : ''}`}
                      onClick={() => setShowDayNotes(true)}
                    >
                      {t.dayTab.notesBtn}
                    </button>
                    <button type="button" className="btn-ghost-sm" onClick={() => setShowImport(true)}>
                      {t.trades.importHelp}
                    </button>
                  </div>
                </div>
                {dayJournalStats && <DayTradeJournalBar stats={dayJournalStats} t={t.dayJournal} />}
                {journalTipVisible ? (
                  <div className="journal-tip-banner">
                    <p>{t.journal.journalTip}</p>
                    <button
                      type="button"
                      className="btn-ghost-sm tip-dismiss"
                      onClick={() => {
                        try {
                          localStorage.setItem('tj-journal-tip-dismissed', '1')
                        } catch {
                          /* ignore */
                        }
                        setJournalTipVisible(false)
                      }}
                    >
                      {t.journal.tipDismiss}
                    </button>
                  </div>
                ) : null}
                {selectedDay && (selectedDay.openCount ?? 0) > 0 && selectedDate === todayKey && (
                  <p className="day-open-hint">
                    {t.daySummary.openToday}: {selectedDay.openCount} ·{' '}
                    <span className={pnlClass(selectedDay.livePnl ?? 0)}>
                      {formatMoney(selectedDay.livePnl ?? 0)}
                    </span>
                  </p>
                )}
                {dayTrades.length === 0 ? (
                  <p className="empty">{t.trades.empty}</p>
                ) : (
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>{t.trades.symbol}</th>
                        <th>{t.trades.side}</th>
                        <th>{t.trades.netPnl}</th>
                        <th>{t.dayJournal.colR}</th>
                        <th>{t.dayJournal.colChecklist}</th>
                        <th>{t.trades.deductions}</th>
                        <th></th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayTrades.map((trade) => {
                        const meta = tradeMetaMap[journalTradeKey(trade)]
                        const rr = realizedR(trade, meta) ?? effectiveRR(trade, meta)
                        const hasJournal = tradeHasJournalMeta(meta)
                        const cl = meta?.checklist
                        const setupKey = meta?.setup
                          ? (`setup_${meta.setup}` as keyof typeof t.journal)
                          : null
                        const setupLabel =
                          setupKey && typeof t.journal[setupKey] === 'string'
                            ? (t.journal[setupKey] as string)
                            : meta?.setup
                        return (
                          <tr key={trade.id}>
                            <td>
                              {trade.symbol}
                              {setupLabel ? (
                                <span className="trade-tag-row">
                                  <span className="trade-tag setup-tag">
                                    {setupLabel}
                                    {meta?.setupQuality ? ` ${meta.setupQuality}` : ''}
                                    {meta?.timeframe ? ` · ${meta.timeframe}` : ''}
                                  </span>
                                </span>
                              ) : null}
                              {meta?.tags?.length ? (
                                <span className="trade-tag-row">
                                  {meta.tags.map((tag) => (
                                    <span key={tag} className="trade-tag">
                                      {tag}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </td>
                            <td>{t.side[trade.side]}</td>
                            <td className={pnlClass(trade.pnl)}>{formatMoney(trade.pnl)}</td>
                            <td className={`trade-rr-cell${rr != null ? ` ${pnlClass(rr)}` : ''}`}>
                              {rr != null ? `${rr >= 0 ? '+' : ''}${rr.toFixed(1)}R` : '—'}
                            </td>
                            <td className="trade-checklist-cell">
                              {cl || meta?.setup ? (
                                <span className="trade-checklist-badges">
                                  <span
                                    className={cl?.hadSetup || meta?.setup ? 'on' : 'off'}
                                    title={t.journal.hadSetup}
                                  >
                                    S
                                  </span>
                                  <span
                                    className={cl?.respectedRisk ? 'on' : 'off'}
                                    title={t.journal.respectedRisk}
                                  >
                                    R
                                  </span>
                                  <span
                                    className={cl?.inTradingHours ? 'on' : 'off'}
                                    title={t.journal.inTradingHours}
                                  >
                                    H
                                  </span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="negative">
                              {trade.fees > 0 ? `−$${trade.fees.toFixed(2)}` : '—'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`btn-ghost-sm${hasJournal ? ' has-dot' : ''}`}
                                onClick={() => setReviewingTrade(trade)}
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
                        )
                      })}
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
            </main>
          </div>
        )}
        </div>
      </div>
      </div>

      {!isHomeWindow && (
      <ProgressDock
        goals={profitGoalsForDay}
        rules={thresholdRulesForDay}
        showGoals={hasAnyProfitGoal(settings)}
        showRules={isTradingRulesEnabled(settings)}
        tGoals={t.profitGoals}
        tThresholds={t.thresholds}
      />
      )}
      </div>
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

      {showDayNotes && (
        <DayNotesModal
          dayNote={dayNote}
          onSave={saveDayNote}
          onClose={() => setShowDayNotes(false)}
          t={t.journal}
          tDay={t.dayTab}
        />
      )}

      {showWeeklySummary && (
        <WeeklySummaryModal
          summary={weeklySummary}
          weekNote={weekNote}
          dateLocale={dateLocale}
          t={t.weekly}
          onSaveNote={saveWeekNote}
          onClose={() => setShowWeeklySummary(false)}
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
            void openAppView('day')
          }}
        />
      )}

      {reviewingTrade && (
        <TradeReviewModal
          trade={reviewingTrade}
          meta={tradeMetaMap[journalTradeKey(reviewingTrade)] ?? EMPTY_TRADE_META}
          onSave={(meta) => saveTradeMeta(reviewingTrade, meta)}
          onClose={() => setReviewingTrade(null)}
          onEditDetails={() => {
            setEditingTrade(reviewingTrade)
            setReviewingTrade(null)
          }}
          t={t.journal}
          sideLabels={t.side}
          sessionLabels={{
            asia: t.analytics.sessionAsia,
            london: t.analytics.sessionLondon,
            ny: t.analytics.sessionNy,
            other: t.analytics.sessionOther,
          }}
        />
      )}

      {editingTrade && (
        <TradeMetaModal
          trade={editingTrade}
          meta={tradeMetaMap[journalTradeKey(editingTrade)] ?? EMPTY_TRADE_META}
          balanceAtTrade={
            (() => {
              const day = dayMap.get(editingTrade.date)
              if (!day) return displayBalance
              return day.endBalance - day.netCash - (day.grossPnl - day.fees)
            })()
          }
          onSave={(meta) => saveTradeMeta(editingTrade, meta)}
          onClose={() => setEditingTrade(null)}
          t={t.journal}
          sideLabels={t.side}
          sessionLabels={{
            asia: t.analytics.sessionAsia,
            london: t.analytics.sessionLondon,
            ny: t.analytics.sessionNy,
            other: t.analytics.sessionOther,
          }}
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
    </>
  )
}

export default App
