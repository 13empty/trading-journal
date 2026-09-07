import crypto from 'node:crypto'

const HISTORY_MS = 90 * 24 * 60 * 60 * 1000
const FETCH_MS = 25_000

function hmacHex(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function hmacB64(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64')
}

function dayKey(ms) {
  const d = new Date(Number(ms))
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function sideOf(raw) {
  const s = String(raw || '').toLowerCase()
  if (s === 'sell' || s === 'short') return 'short'
  return 'long'
}

async function readJson(url, headers = {}, method = 'GET', body = null) {
  const res = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(text.slice(0, 180) || `HTTP ${res.status}`)
  }
  if (!res.ok) {
    const msg = data.msg || data.retMsg || data.message || data.error || `HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return data
}

function emptyResult(account) {
  return { trades: [], cash: [], balance: null, equity: null, openPositions: [], account }
}

function tradeRow({ source, id, date, symbol, side, qty, entry, exit, pnl, fees, notes, account }) {
  return {
    id,
    date,
    symbol: String(symbol || '').toUpperCase(),
    side,
    quantity: Math.abs(num(qty, 1)) || 1,
    entryPrice: Math.abs(num(entry)),
    exitPrice: Math.abs(num(exit)),
    pnl: num(pnl),
    fees: Math.abs(num(fees)),
    notes,
    source,
    positionId: id,
    accountId: account,
  }
}

function cashRow({ id, date, amount, notes, category = 'fee' }) {
  const amt = Math.abs(num(amount))
  return {
    id,
    date,
    type: num(amount) >= 0 ? 'deposit' : 'withdraw',
    category,
    amount: amt,
    notes,
  }
}

function openRow({ id, symbol, side, volume, openPrice, profit }) {
  return {
    id: Number.parseInt(String(id).replace(/\D/g, '').slice(-9), 10) || Date.now() % 1_000_000_000,
    symbol: String(symbol || '').toUpperCase(),
    side: sideOf(side) === 'short' ? 'sell' : 'buy',
    volume: Math.abs(num(volume)),
    openPrice: Math.abs(num(openPrice)),
    profit: num(profit),
  }
}

/* ---- Binance USD-M ---- */

async function binanceGet(conn, pathname, params = {}) {
  const timestamp = Date.now()
  const search = new URLSearchParams({ ...params, timestamp: String(timestamp), recvWindow: '5000' })
  const query = search.toString()
  const signature = hmacHex(conn.apiSecret, query)
  const url = `https://fapi.binance.com${pathname}?${query}&signature=${signature}`
  return readJson(url, { 'X-MBX-APIKEY': conn.apiKey })
}

async function syncBinance(conn) {
  const account = conn.label || 'Binance'
  const acc = await binanceGet(conn, '/fapi/v2/account')
  const balance = num(acc.totalWalletBalance, null)
  const equity = num(acc.totalMarginBalance, balance)

  const trades = []
  const cash = []
  const end = Date.now()
  const start = end - HISTORY_MS
  const chunk = 7 * 24 * 60 * 60 * 1000
  for (let from = start; from < end; from += chunk) {
    const to = Math.min(from + chunk - 1, end)
    const income = await binanceGet(conn, '/fapi/v1/income', {
      startTime: String(from),
      endTime: String(to),
      limit: '1000',
    })
    const rows = Array.isArray(income) ? income : []
    for (const row of rows) {
      const kind = String(row.incomeType || '')
      const when = dayKey(row.time)
      const amt = num(row.income)
      const tid = String(row.tranId || row.tradeId || `${row.time}-${row.symbol}`)
      if (kind === 'REALIZED_PNL') {
        trades.push(
          tradeRow({
            source: 'binance',
            id: `binance:${tid}`,
            date: when,
            symbol: row.symbol,
            side: amt >= 0 ? 'long' : 'short',
            qty: 1,
            entry: 0,
            exit: 0,
            pnl: amt,
            fees: 0,
            notes: `Binance ${row.symbol}`,
            account,
          }),
        )
      } else if (kind === 'COMMISSION' || kind === 'FUNDING_FEE' || kind === 'INSURANCE_CLEAR') {
        cash.push(
          cashRow({
            id: `binance-cash:${tid}`,
            date: when,
            amount: amt,
            notes: `Binance ${kind} ${row.symbol || ''}`.trim(),
            category: 'fee',
          }),
        )
      }
    }
  }

  const risk = await binanceGet(conn, '/fapi/v2/positionRisk')
  const openPositions = (Array.isArray(risk) ? risk : [])
    .filter((p) => Math.abs(num(p.positionAmt)) > 0)
    .map((p) =>
      openRow({
        id: `${p.symbol}${p.positionAmt}`,
        symbol: p.symbol,
        side: num(p.positionAmt) < 0 ? 'short' : 'long',
        volume: p.positionAmt,
        openPrice: p.entryPrice,
        profit: p.unRealizedProfit,
      }),
    )

  return { trades, cash, balance, equity, openPositions, account }
}

/* ---- Bybit linear ---- */

async function bybitGet(conn, pathname, params = {}) {
  const timestamp = String(Date.now())
  const recvWindow = '5000'
  const query = new URLSearchParams(params).toString()
  const payload = timestamp + conn.apiKey + recvWindow + query
  const sign = hmacHex(conn.apiSecret, payload)
  const url = `https://api.bybit.com${pathname}${query ? `?${query}` : ''}`
  const data = await readJson(url, {
    'X-BAPI-API-KEY': conn.apiKey,
    'X-BAPI-TIMESTAMP': timestamp,
    'X-BAPI-SIGN': sign,
    'X-BAPI-RECV-WINDOW': recvWindow,
  })
  if (data.retCode != null && Number(data.retCode) !== 0) {
    throw new Error(data.retMsg || `bybit ${data.retCode}`)
  }
  return data
}

async function syncBybit(conn) {
  const account = conn.label || 'Bybit'
  const wallet = await bybitGet(conn, '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
  const coin = wallet.result?.list?.[0]
  const balance = num(coin?.totalWalletBalance ?? coin?.totalEquity, null)
  const equity = num(coin?.totalEquity, balance)

  const trades = []
  let cursor = ''
  for (let page = 0; page < 15; page++) {
    const params = { category: 'linear', limit: '100' }
    if (cursor) params.cursor = cursor
    const data = await bybitGet(conn, '/v5/position/closed-pnl', params)
    const list = data.result?.list || []
    for (const row of list) {
      const updated = Number(row.updatedTime || row.createdTime)
      if (updated && Date.now() - updated > HISTORY_MS) continue
      trades.push(
        tradeRow({
          source: 'bybit',
          id: `bybit:${row.orderId || row.execId || `${row.symbol}-${row.updatedTime}`}`,
          date: dayKey(row.updatedTime || row.createdTime),
          symbol: row.symbol,
          side: row.side,
          qty: row.qty || row.closedSize,
          entry: row.avgEntryPrice,
          exit: row.avgExitPrice,
          pnl: row.closedPnl,
          fees: row.openFee || 0,
          notes: `Bybit ${row.symbol}`,
          account,
        }),
      )
    }
    cursor = data.result?.nextPageCursor || ''
    if (!cursor || list.length === 0) break
  }

  const pos = await bybitGet(conn, '/v5/position/list', { category: 'linear', settleCoin: 'USDT' })
  const openPositions = (pos.result?.list || [])
    .filter((p) => Math.abs(num(p.size)) > 0)
    .map((p) =>
      openRow({
        id: p.positionIdx != null ? `${p.symbol}${p.positionIdx}` : p.symbol,
        symbol: p.symbol,
        side: p.side,
        volume: p.size,
        openPrice: p.avgPrice,
        profit: p.unrealisedPnl,
      }),
    )

  return { trades, cash: [], balance, equity, openPositions, account }
}

/* ---- OKX SWAP ---- */

async function okxGet(conn, pathname, params = {}) {
  const query = new URLSearchParams(params).toString()
  const path = query ? `${pathname}?${query}` : pathname
  const timestamp = new Date().toISOString()
  const sign = hmacB64(conn.apiSecret, timestamp + 'GET' + path)
  const data = await readJson(`https://www.okx.com${path}`, {
    'OK-ACCESS-KEY': conn.apiKey,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': conn.passphrase || '',
    'Content-Type': 'application/json',
  })
  if (data.code != null && String(data.code) !== '0') {
    throw new Error(data.msg || `okx ${data.code}`)
  }
  return data
}

async function syncOkx(conn) {
  const account = conn.label || 'OKX'
  const bal = await okxGet(conn, '/api/v5/account/balance')
  const details = bal.data?.[0]
  const balance = num(details?.totalEq, null)
  const equity = balance

  const hist = await okxGet(conn, '/api/v5/account/positions-history', { instType: 'SWAP', limit: '100' })
  const trades = (hist.data || []).map((row) =>
    tradeRow({
      source: 'okx',
      id: `okx:${row.posId || `${row.instId}-${row.uTime}`}`,
      date: dayKey(row.uTime || row.cTime),
      symbol: row.instId,
      side: row.direction,
      qty: row.closeTotalPos,
      entry: row.openAvgPx,
      exit: row.closeAvgPx,
      pnl: row.pnl,
      fees: row.fee,
      notes: `OKX ${row.instId}`,
      account,
    }),
  )

  const pos = await okxGet(conn, '/api/v5/account/positions', { instType: 'SWAP' })
  const openPositions = (pos.data || [])
    .filter((p) => Math.abs(num(p.pos)) > 0)
    .map((p) =>
      openRow({
        id: p.posId || p.instId,
        symbol: p.instId,
        side: p.posSide === 'net' ? (num(p.pos) < 0 ? 'short' : 'long') : p.posSide,
        volume: p.pos,
        openPrice: p.avgPx,
        profit: p.upl,
      }),
    )

  return { trades, cash: [], balance, equity, openPositions, account }
}

/* ---- Bitget USDT-M ---- */

async function bitgetGet(conn, pathname, params = {}) {
  const query = new URLSearchParams(params).toString()
  const path = query ? `${pathname}?${query}` : pathname
  const timestamp = String(Date.now())
  const sign = hmacB64(conn.apiSecret, timestamp + 'GET' + path)
  const data = await readJson(`https://api.bitget.com${path}`, {
    'ACCESS-KEY': conn.apiKey,
    'ACCESS-SIGN': sign,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': conn.passphrase || '',
    locale: 'en-US',
    'Content-Type': 'application/json',
  })
  if (data.code != null && String(data.code) !== '00000') {
    throw new Error(data.msg || `bitget ${data.code}`)
  }
  return data
}

async function syncBitget(conn) {
  const account = conn.label || 'Bitget'
  const acc = await bitgetGet(conn, '/api/v2/mix/account/accounts', { productType: 'USDT-FUTURES' })
  const list = Array.isArray(acc.data) ? acc.data : []
  const usdt = list.find((a) => String(a.marginCoin || a.marginCoinName || '').toUpperCase() === 'USDT') || list[0]
  const balance = num(usdt?.accountEquity ?? usdt?.usdtEquity ?? usdt?.available, null)
  const equity = num(usdt?.accountEquity, balance)

  const hist = await bitgetGet(conn, '/api/v2/mix/position/history-position', {
    productType: 'USDT-FUTURES',
    pageSize: '100',
  })
  const rows = hist.data?.list || hist.data || []
  const trades = (Array.isArray(rows) ? rows : []).map((row) =>
    tradeRow({
      source: 'bitget',
      id: `bitget:${row.symbol}-${row.cTime || row.ctime}`,
      date: dayKey(row.cTime || row.ctime || row.uTime),
      symbol: row.symbol,
      side: row.holdSide || row.side,
      qty: row.closeTotalPos || row.openTotalPos,
      entry: row.openAvgPrice || row.openPriceAvg,
      exit: row.closeAvgPrice || row.closePriceAvg,
      pnl: row.pnl || row.netProfit,
      fees: row.fee || 0,
      notes: `Bitget ${row.symbol}`,
      account,
    }),
  )

  const pos = await bitgetGet(conn, '/api/v2/mix/position/all-position', {
    productType: 'USDT-FUTURES',
    marginCoin: 'USDT',
  })
  const openList = Array.isArray(pos.data) ? pos.data : []
  const openPositions = openList
    .filter((p) => Math.abs(num(p.total || p.available)) > 0)
    .map((p) =>
      openRow({
        id: `${p.symbol}${p.holdSide}`,
        symbol: p.symbol,
        side: p.holdSide,
        volume: p.total || p.available,
        openPrice: p.openPriceAvg,
        profit: p.unrealizedPL || p.unrealisedPnl,
      }),
    )

  return { trades, cash: [], balance, equity, openPositions, account }
}

export async function syncConnection(conn) {
  if (!conn?.exchange) return emptyResult('exchange')
  if (conn.exchange === 'binance') return syncBinance(conn)
  if (conn.exchange === 'bybit') return syncBybit(conn)
  if (conn.exchange === 'okx') return syncOkx(conn)
  if (conn.exchange === 'bitget') return syncBitget(conn)
  throw new Error(`unsupported_exchange:${conn.exchange}`)
}

export async function testConnection(conn) {
  const result = await syncConnection(conn)
  return {
    ok: true,
    balance: result.balance,
    equity: result.equity,
    tradeCount: result.trades.length,
    openCount: result.openPositions.length,
    account: result.account,
  }
}
