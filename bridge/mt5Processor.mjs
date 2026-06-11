/** Convierte eventos del EA MT5 en trades y movimientos de cuenta */

export function createEmptyState() {
  return {
    lastSeen: null,
    account: null,
    server: null,
    balance: null,
    equity: null,
    trades: [],
    cashMovements: [],
    openPositions: {},
    events: [],
  }
}

function id() {
  return crypto.randomUUID()
}

const BROKER_OFFSET_HOURS = Number(process.env.TJ_MT5_SERVER_OFFSET_HOURS ?? 6)

function dateFromUnixBroker(seconds) {
  const d = new Date(seconds * 1000 + BROKER_OFFSET_HOURS * 3600 * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Solo dia yyyy-MM-dd; nunca convierte hora con zona del PC. */
function formatDate(isoOrUnix) {
  if (typeof isoOrUnix === 'number') {
    return dateFromUnixBroker(isoOrUnix)
  }
  const s = String(isoOrUnix).trim()
  const mt5 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/)
  if (mt5) return `${mt5[1]}-${mt5[2]}-${mt5[3]}`
  const dashed = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`
  return s.slice(0, 10)
}

function classifyBalance(comment, amount, accountId) {
  const c = (comment || '').toLowerCase()
  if (c.includes('divs') || c.includes('fee')) return { category: 'fee', type: 'withdraw' }
  if (c.includes('solidpayments')) return { category: 'deposit', type: 'deposit' }
  if (c.includes('/to ') || c.includes(' to ')) {
    if (accountId && c.includes(`to ${accountId}`)) return { category: 'transfer_in', type: 'deposit' }
    return { category: 'transfer_out', type: 'withdraw' }
  }
  if (c.includes('/fr ') || c.includes(' fr ')) return { category: 'transfer_in', type: 'deposit' }
  return amount >= 0
    ? { category: 'deposit', type: 'deposit' }
    : { category: 'withdraw', type: 'withdraw' }
}

function tradeExtras(p, account) {
  const extra = {}
  if (p.openTime) extra.openTime = String(p.openTime)
  if (p.closeTime) extra.closeTime = String(p.closeTime)
  if (p.swap != null) extra.swap = Math.abs(Number(p.swap) || 0)
  if (p.commission != null) extra.commission = Math.abs(Number(p.commission) || 0)
  if (account) extra.accountId = String(account)
  return extra
}

function buildTrade(base, p, account) {
  return { ...base, ...tradeExtras(p, account) }
}

function upsertTrade(trades, trade) {
  const key = trade.positionId
  if (!key) return [trade, ...trades]
  const idx = trades.findIndex((t) => t.positionId === key)
  if (idx >= 0) {
    const next = [...trades]
    next[idx] = { ...next[idx], ...trade, id: next[idx].id }
    return next
  }
  return [trade, ...trades]
}

function cashDedupeKey(movement, ticket) {
  const notes = String(movement.notes || '')
  const mt5 = notes.match(/MT5\s*#(\d+)/i)?.[1]
  if (mt5) return `ticket:${mt5}`
  const autotrf = notes.match(/AutoTrf\s+(\d+)/i)?.[1]
  if (autotrf) return `autotrf:${autotrf}`
  const t = ticket || notes.match(/MT5\s*#(\d+)/i)?.[1]
  if (t) return `ticket:${t}`
  return `sig:${movement.date}|${movement.category}|${movement.amount}|${notes}`
}

function upsertCash(cash, movement, ticket) {
  const key = cashDedupeKey(movement, ticket)
  const idx = cash.findIndex((c) => cashDedupeKey(c) === key)
  if (idx >= 0) {
    const next = [...cash]
    next[idx] = { ...next[idx], ...movement, id: next[idx].id }
    return next
  }
  return [movement, ...cash]
}

export function processMt5Event(state, event) {
  const patch = { trades: [], cashMovements: [], balance: state.balance, equity: state.equity }
  const next = { ...state, events: [...(state.events || []).slice(-100), event] }
  next.lastSeen = Date.now()

  if (event.account != null) next.account = String(event.account)
  if (event.server) next.server = event.server
  if (event.balance != null) {
    next.balance = Number(event.balance)
    patch.balance = next.balance
  }
  if (event.equity != null) {
    next.equity = Number(event.equity)
    patch.equity = next.equity
  }

  if (Array.isArray(event.openPositions)) {
    const map = {}
    for (const p of event.openPositions) {
      map[String(p.id)] = p
    }
    next.openPositions = map
    patch.openPositions = event.openPositions
  }

  const type = event.type || 'heartbeat'

  if (type === 'balance_sync' && Array.isArray(event.movements)) {
    const merged = []
    const seen = new Set()
    for (const m of event.movements) {
      const movement = {
        id: m.id || id(),
        date: formatDate(m.date || m.time || Date.now()),
        type: m.type || 'deposit',
        category: m.category || m.type || 'deposit',
        amount: Math.abs(Number(m.amount) || 0),
        notes: m.notes || 'MT5 balance',
      }
      const key = cashDedupeKey(movement, m.ticket)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(movement)
    }
    merged.sort((a, b) => b.date.localeCompare(a.date))
    next.cashMovements = merged
    patch.cashMovements = merged
    return { state: next, patch }
  }

  if (type === 'balance' && event.amount != null) {
    const amount = Number(event.amount)
    const classified = classifyBalance(event.comment || '', amount, next.account)
    if (classified) {
      const movement = {
        id: id(),
        date: formatDate(event.time || Date.now()),
        type: classified.type,
        category: classified.category,
        amount: Math.abs(amount),
        notes: event.ticket
          ? `MT5 #${event.ticket} ${event.comment || ''}`.trim()
          : event.comment || 'MT5 balance',
      }
      next.cashMovements = upsertCash(next.cashMovements, movement, event.ticket)
      patch.cashMovements = [movement]
    }
    return { state: next, patch }
  }

  if (type === 'position_closed' && event.position) {
    const p = event.position
    const positionId = String(p.id || p.positionId || '')
    const side = (p.side || p.type || '').toLowerCase() === 'sell' ? 'short' : 'long'
    const trade = buildTrade({
      id: id(),
      date: formatDate(p.closeDate || p.closeTime || p.time || Date.now()),
      symbol: String(p.symbol || '').toUpperCase(),
      side,
      quantity: Number(p.volume) || 1,
      entryPrice: Number(p.openPrice) || 0,
      exitPrice: Number(p.closePrice) || Number(p.price) || 0,
      pnl: Number(p.profit) || 0,
      fees: Math.abs(Number(p.commission) || 0) + Math.abs(Number(p.swap) || 0),
      notes: `MT5 #${positionId}`,
      positionId,
    }, p, next.account)
    next.trades = upsertTrade(next.trades, trade)
    delete next.openPositions[positionId]
    patch.trades = [trade]
    return { state: next, patch }
  }

  if (type === 'deal' && event.deal) {
    const d = event.deal
    const entry = String(d.entry || '').toLowerCase()
    const positionId = String(d.positionId || d.position || '')

    if (entry === 'in' || entry === '0') {
      next.openPositions[positionId] = {
        symbol: d.symbol,
        side: String(d.dealType || d.type || '').toLowerCase() === 'sell' ? 'short' : 'long',
        openPrice: Number(d.price),
        volume: Number(d.volume),
        openTime: d.time,
      }
      return { state: next, patch }
    }

    if (entry === 'out' || entry === '1') {
      const open = next.openPositions[positionId] || {}
      const trade = buildTrade({
        id: id(),
        date: formatDate(d.time || Date.now()),
        symbol: String(d.symbol || open.symbol || '').toUpperCase(),
        side: open.side || (String(d.dealType || '').toLowerCase() === 'sell' ? 'short' : 'long'),
        quantity: Number(d.volume) || open.volume || 1,
        entryPrice: Number(open.openPrice) || 0,
        exitPrice: Number(d.price) || 0,
        pnl: Number(d.profit) || 0,
        fees: Math.abs(Number(d.commission) || 0) + Math.abs(Number(d.swap) || 0),
        notes: `MT5 #${positionId}`,
        positionId,
      }, { ...d, openTime: open.openTime, closeTime: d.time }, next.account)
      next.trades = upsertTrade(next.trades, trade)
      delete next.openPositions[positionId]
      patch.trades = [trade]
    }
    return { state: next, patch }
  }

  if (type === 'history_sync' && Array.isArray(event.positions)) {
    let trades = [...next.trades]
    for (const p of event.positions) {
      const positionId = String(p.id || p.positionId || '')
      const side = (p.side || p.type || '').toLowerCase() === 'sell' ? 'short' : 'long'
      const trade = buildTrade({
        id: id(),
        date: formatDate(p.closeDate || p.closeTime || p.time),
        symbol: String(p.symbol || '').toUpperCase(),
        side,
        quantity: Number(p.volume) || 1,
        entryPrice: Number(p.openPrice) || 0,
        exitPrice: Number(p.closePrice) || 0,
        pnl: Number(p.profit) || 0,
        fees: Math.abs(Number(p.commission) || 0) + Math.abs(Number(p.swap) || 0),
        notes: `MT5 #${positionId}`,
        positionId,
      }, p, next.account)
      trades = upsertTrade(trades, trade)
    }
    next.trades = trades
    patch.trades = event.positions
    return { state: next, patch }
  }

  if (type === 'heartbeat') {
    patch.openPositions = Object.values(next.openPositions || {})
    return { state: next, patch }
  }

  return { state: next, patch }
}
