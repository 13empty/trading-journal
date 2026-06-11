import * as XLSX from 'xlsx'
import type { CashMovement } from '../types/account'
import type { Trade } from '../types/trade'
import { classifyMt5Balance, detectCashType, isTradeTransaction } from './account'
import { createId } from './storage'

const DATE_ALIASES = ['fecha', 'date', 'dia', 'day', 'datetime', 'fecha/hora', 'date time']
const SYMBOL_ALIASES = ['simbolo', 'symbol', 'ticker', 'instrumento', 'activo', 'pair', 'par']
const PNL_ALIASES = ['pnl', 'p&l', 'profit', 'ganancia', 'resultado', 'pl', 'net', 'neto', 'beneficio', 'perdida']
const SIDE_ALIASES = ['lado', 'side', 'direccion', 'direction', 'tipo', 'type', 'transaction']
const QTY_ALIASES = ['cantidad', 'quantity', 'qty', 'size', 'volumen', 'lots', 'contratos', 'volume']
const ENTRY_ALIASES = ['entrada', 'entry', 'open', 'precio entrada', 'entry price', 'buy', 'open price']
const EXIT_ALIASES = ['salida', 'exit', 'close', 'precio salida', 'exit price', 'sell']
const FEES_ALIASES = ['comision', 'fees', 'fee', 'commission', 'costos']
const NOTES_ALIASES = ['notas', 'notes', 'comentario', 'comment', 'descripcion']

function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalized = headers.map(norm)
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h === alias || h.includes(alias))
    if (idx >= 0) return idx
  }
  return -1
}

function parseNumber(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  const s = String(val ?? '')
    .replace(/[$€£,\s]/g, '')
    .replace(/\((.+)\)/, '-$1')
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

/** Parsea M/D/YYYY, D/M/YYYY y variantes con hora */
function parseSlashDate(a: number, b: number, y: number, hh = 0, mm = 0, ss = 0): Date | null {
  let month: number
  let day: number
  if (a > 12) {
    day = a
    month = b
  } else if (b > 12) {
    month = a
    day = b
  } else {
    month = a
    day = b
  }
  const date = new Date(y, month - 1, day, hh, mm, ss)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseBrokerDateTime(val: unknown): Date | null {
  if (val == null || val === '') return null
  if (val instanceof Date && !Number.isNaN(val.getTime())) return val
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0)
  }

  const s = String(val).trim()

  // MT5: 2026.03.25 18:06:41
  const mt5 = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (mt5) {
    const [, y, m, d, hh, mm, ss] = mt5
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10), parseInt(ss, 10))
    if (!Number.isNaN(date.getTime())) return date
  }

  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (dmY) {
    const [, p1, p2, y, hh = '0', mm = '0', ss = '0'] = dmY
    return parseSlashDate(
      parseInt(p1, 10),
      parseInt(p2, 10),
      parseInt(y, 10),
      parseInt(hh, 10),
      parseInt(mm, 10),
      parseInt(ss, 10),
    )
  }

  const iso = parseDate(val)
  return iso ? new Date(iso + 'T12:00:00') : null
}

function parseDate(val: unknown): string | null {
  if (val == null || val === '') return null
  const broker = parseBrokerDateTime(val)
  if (broker) return formatDate(broker)

  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) {
      const d = new Date(parsed.y, parsed.m - 1, parsed.d)
      return formatDate(d)
    }
  }
  if (val instanceof Date) return formatDate(val)
  const s = String(val).trim()
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return formatDate(d)
  return null
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseSide(val: unknown): 'long' | 'short' {
  const s = norm(val)
  if (s.includes('short') || s.includes('sell') || s.includes('venta') || s === 's') return 'short'
  return 'long'
}

function sideFromTransactionType(val: unknown): 'long' | 'short' | null {
  const s = norm(val)
  if (s.includes('buy in') || s.includes('sell out')) return 'long'
  if (s.includes('sell in') || s.includes('buy out')) return 'short'
  return null
}

function inferSide(entryPrice: number, exitPrice: number): 'long' | 'short' {
  if (entryPrice === exitPrice) return 'long'
  return exitPrice >= entryPrice ? 'long' : 'short'
}

export interface ImportResult {
  trades: Trade[]
  cashMovements: CashMovement[]
  skipped: number
  errors: string[]
  format?: 'broker' | 'generic' | 'mt5-history'
  brokerBalance?: number
  brokerBalanceDate?: string
  mt5NetProfit?: number
}

interface BrokerColumns {
  symbol: number
  account: number
  position: number
  time: number
  lots: number
  price: number
  profit: number
  transactionType: number
}

function findBrokerColumns(headers: string[]): BrokerColumns | null {
  const h = headers.map(norm)
  const position = h.findIndex((x) => x === 'position')
  const profit = h.findIndex((x) => x === 'profit')
  const symbol = h.findIndex((x) => x === 'symbol')
  const time = h.findIndex(
    (x) => x === 'time' || x === 'date time' || (x.includes('date') && x.includes('time')),
  )

  if (position < 0 || time < 0 || profit < 0) return null

  const lots = h.findIndex((x) => x.includes('volume') || x.includes('lots'))
  const price = h.findIndex(
    (x) => x === 'price' || x === 'open price' || (x.includes('open') && x.includes('price')),
  )
  const account = h.findIndex((x) => x.includes('account') && x.includes('number'))
  const transactionType = h.findIndex((x) => x.includes('transaction'))

  return {
    symbol,
    account,
    position,
    time,
    lots,
    price,
    profit,
    transactionType,
  }
}

function isMetadataRow(row: unknown[]): boolean {
  const cells = row.map((c) => norm(c)).filter(Boolean)
  if (cells.length === 0) return true
  const joined = cells.join(' ')
  if (joined === 'report') return true
  if (joined.startsWith('name:') || joined.includes('produced at')) return true
  if (cells.length === 1 && !findBrokerColumns(row.map((c) => String(c ?? '')))) {
    const only = cells[0]
    if (only === 'report' || only.startsWith('name:')) return true
  }
  return false
}

/** Salta filas como "Report" y "Name: Mt Produced At: ..." hasta encontrar encabezados reales */
function findHeaderRowIndex(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]
    if (!row) continue
    const headers = row.map((c) => String(c ?? ''))
    if (findBrokerColumns(headers)) return i
  }
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i]
    if (!row || isMetadataRow(row)) continue
    const headers = row.map((c) => String(c ?? ''))
    if (findColumn(headers, DATE_ALIASES) >= 0 && findColumn(headers, PNL_ALIASES) >= 0) return i
  }
  return 0
}

interface BrokerLeg {
  symbol: string
  account: string
  position: string
  at: Date
  lots: number
  price: number
  profit: number
  transactionType: string
}

function importBrokerHistory(
  rows: unknown[][],
  headerRowIndex: number,
  cols: BrokerColumns,
): { trades: Trade[]; cashMovements: CashMovement[]; skipped: number } {
  const legsByPosition = new Map<string, BrokerLeg[]>()
  const cashMovements: CashMovement[] = []
  let skipped = 0

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === '' || c == null)) continue
    if (isMetadataRow(row)) continue

    const at = parseBrokerDateTime(row[cols.time])
    if (!at) {
      skipped++
      continue
    }

    const symbol = cols.symbol >= 0 ? String(row[cols.symbol] ?? '').trim() : ''
    const transactionType =
      cols.transactionType >= 0 ? String(row[cols.transactionType] ?? '').trim() : ''
    const profit = parseNumber(row[cols.profit])
    const cashType = detectCashType(transactionType, symbol)

    if (cashType || (!isTradeTransaction(transactionType) && transactionType && profit !== 0)) {
      const type = cashType ?? (profit >= 0 ? 'deposit' : 'withdraw')
      const amount = Math.abs(profit)
      if (amount > 0) {
        cashMovements.push({
          id: createId(),
          date: formatDate(at),
          type,
          category: type,
          amount,
          notes: transactionType || symbol || type,
        })
      }
      continue
    }

    const position = String(row[cols.position] ?? '').trim()
    if (!position) {
      skipped++
      continue
    }

    const leg: BrokerLeg = {
      symbol: symbol || 'N/A',
      account: cols.account >= 0 ? String(row[cols.account] ?? '').trim() : '',
      position,
      at,
      lots: cols.lots >= 0 ? parseNumber(row[cols.lots]) : 1,
      price: cols.price >= 0 ? parseNumber(row[cols.price]) : 0,
      profit,
      transactionType,
    }

    const list = legsByPosition.get(position) ?? []
    list.push(leg)
    legsByPosition.set(position, list)
  }

  const trades: Trade[] = []

  for (const legs of legsByPosition.values()) {
    legs.sort((a, b) => a.at.getTime() - b.at.getTime())
    const first = legs[0]
    const last = legs[legs.length - 1]
    const pnl = legs.reduce((s, l) => s + l.profit, 0)
    const entryPrice = first.price
    const exitPrice = last.price
    const sideFromTxn =
      sideFromTransactionType(first.transactionType) ??
      sideFromTransactionType(last.transactionType)
    const side = sideFromTxn ?? inferSide(entryPrice, exitPrice)
    const accountPart = first.account ? ` · Cuenta ${first.account}` : ''

    trades.push({
      id: createId(),
      date: formatDate(last.at),
      symbol: first.symbol.toUpperCase(),
      side,
      quantity: first.lots,
      entryPrice,
      exitPrice,
      pnl,
      fees: 0,
      notes: `Posición #${first.position}${accountPart}`,
      positionId: first.position,
    })
  }

  trades.sort((a, b) => b.date.localeCompare(a.date))
  return { trades, cashMovements, skipped }
}

function importGeneric(
  rows: unknown[][],
  headerRowIndex: number,
): { trades: Trade[]; skipped: number; errors: string[]; cashMovements: CashMovement[] } {
  const headers = rows[headerRowIndex].map((h) => String(h ?? ''))
  const dateCol = findColumn(headers, [...DATE_ALIASES, 'time'])
  const symbolCol = findColumn(headers, SYMBOL_ALIASES)
  const pnlCol = findColumn(headers, PNL_ALIASES)
  const sideCol = findColumn(headers, SIDE_ALIASES)
  const qtyCol = findColumn(headers, QTY_ALIASES)
  const entryCol = findColumn(headers, ENTRY_ALIASES)
  const exitCol = findColumn(headers, EXIT_ALIASES)
  const feesCol = findColumn(headers, FEES_ALIASES)
  const notesCol = findColumn(headers, NOTES_ALIASES)

  const errors: string[] = []
  if (dateCol < 0) errors.push('No se encontró columna de fecha (Date Time, TIME, fecha, etc.).')
  if (pnlCol < 0 && (entryCol < 0 || exitCol < 0)) {
    errors.push('Se necesita columna Profit/PnL o columnas de entrada/salida.')
  }
  if (errors.length > 0) return { trades: [], skipped: 0, errors, cashMovements: [] }

  const trades: Trade[] = []
  let skipped = 0

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === '' || c == null)) continue
    if (isMetadataRow(row)) continue

    const date = parseDate(row[dateCol])
    if (!date) {
      skipped++
      continue
    }

    const symbol = symbolCol >= 0 ? String(row[symbolCol] ?? 'N/A').trim() || 'N/A' : 'N/A'
    const side = sideCol >= 0 ? parseSide(row[sideCol]) : 'long'
    const quantity = qtyCol >= 0 ? parseNumber(row[qtyCol]) : 1
    const entryPrice = entryCol >= 0 ? parseNumber(row[entryCol]) : 0
    const exitPrice = exitCol >= 0 ? parseNumber(row[exitCol]) : 0
    const fees = feesCol >= 0 ? parseNumber(row[feesCol]) : 0
    const notes = notesCol >= 0 ? String(row[notesCol] ?? '').trim() : ''

    let pnl = pnlCol >= 0 ? parseNumber(row[pnlCol]) : 0
    if (pnlCol < 0 && entryCol >= 0 && exitCol >= 0) {
      const diff = side === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
      pnl = diff * quantity - fees
    }

    trades.push({
      id: createId(),
      date,
      symbol: symbol.toUpperCase(),
      side,
      quantity,
      entryPrice,
      exitPrice,
      pnl,
      fees,
      notes,
    })
  }

  return { trades, skipped, errors: [], cashMovements: [] }
}

function isMt5HistoryReport(rows: unknown[][]): boolean {
  const title = norm(rows[0]?.[0])
  return title.includes('trade history report')
}

function extractMt5NetProfit(rows: unknown[][]): number | undefined {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    if (!row) continue
    if (norm(row[0]) === 'total net profit:') {
      const v = parseNumber(row[3])
      return Number.isNaN(v) ? undefined : v
    }
  }
  return undefined
}

function extractMt5BrokerBalance(rows: unknown[][]): { balance: number; date?: string } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    if (!row) continue
    if (norm(row[0]) === 'balance:') {
      const balance = parseNumber(row[3])
      let date: string | undefined
      for (let j = 0; j < 10; j++) {
        if (norm(rows[j]?.[0]) === 'date:' && rows[j][3]) {
          const d = parseBrokerDateTime(rows[j][3])
          if (d) date = formatDate(d)
        }
      }
      return { balance, date }
    }
  }
  return null
}

function extractMt5AccountId(rows: unknown[][]): string | undefined {
  for (let i = 0; i < 10; i++) {
    const row = rows[i]
    if (!row) continue
    if (norm(row[0]) === 'account:' && row[3]) {
      const m = String(row[3]).match(/(\d+)/)
      return m?.[1]
    }
  }
  return undefined
}

function findMt5Section(rows: unknown[][], sectionName: string): number | null {
  for (let i = 0; i < rows.length; i++) {
    if (norm(rows[i]?.[0]) === norm(sectionName)) return i
  }
  return null
}

function isMt5SectionBoundary(row: unknown[]): boolean {
  const first = norm(row?.[0])
  return ['positions', 'orders', 'deals', 'results', 'balance drawdown:'].includes(first)
}

function importMt5History(rows: unknown[][]): {
  trades: Trade[]
  cashMovements: CashMovement[]
  skipped: number
} {
  const trades: Trade[] = []
  const cashMovements: CashMovement[] = []
  let skipped = 0
  const accountId = extractMt5AccountId(rows)

  const posSection = findMt5Section(rows, 'Positions')
  if (posSection !== null) {
    const headerRow = posSection + 1
    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || isMt5SectionBoundary(row)) break
      if (typeof row[1] !== 'number' || !row[2]) {
        skipped++
        continue
      }

      const closeAt = parseBrokerDateTime(row[8] ?? row[0])
      if (!closeAt) {
        skipped++
        continue
      }

      const openType = norm(row[3])
      const side: 'long' | 'short' = openType === 'sell' ? 'short' : 'long'
      const commission = parseNumber(row[10])
      const swap = parseNumber(row[11])
      const profit = parseNumber(row[12])

      trades.push({
        id: createId(),
        date: formatDate(closeAt),
        symbol: String(row[2]).trim().toUpperCase(),
        side,
        quantity: parseNumber(row[4]),
        entryPrice: parseNumber(row[5]),
        exitPrice: parseNumber(row[9]),
        pnl: profit,
        fees: Math.abs(commission) + Math.abs(swap),
        notes: `Posición #${row[1]}`,
        positionId: String(row[1]),
      })
    }
  }

  const dealsSection = findMt5Section(rows, 'Deals')
  if (dealsSection !== null) {
    let headerRow = dealsSection + 1
    while (headerRow < rows.length && norm(rows[headerRow]?.[0]) !== 'time') {
      headerRow++
    }

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || isMt5SectionBoundary(row)) break
      if (norm(row[0]) === 'time') continue
      if (norm(row[3]) !== 'balance') continue

      const at = parseBrokerDateTime(row[0])
      const delta = parseNumber(row[11])
      const comment = String(row[13] ?? '').trim()
      if (!at || delta === 0) continue

      const classified = classifyMt5Balance(comment, delta, accountId)
      if (!classified) continue

      cashMovements.push({
        id: createId(),
        date: formatDate(at),
        type: classified.type,
        category: classified.category,
        amount: Math.abs(delta),
        notes: comment || classified.category,
      })
    }
  }

  trades.sort((a, b) => b.date.localeCompare(a.date))
  return { trades, cashMovements, skipped }
}

export async function importFromFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]

  if (rows.length < 2) {
    return { trades: [], cashMovements: [], skipped: 0, errors: ['El archivo está vacío o no tiene filas de datos.'] }
  }

  if (isMt5HistoryReport(rows)) {
    const { trades, cashMovements, skipped } = importMt5History(rows)
    const broker = extractMt5BrokerBalance(rows)
    const mt5NetProfit = extractMt5NetProfit(rows)
    if (trades.length === 0 && cashMovements.length === 0) {
      return {
        trades: [],
        cashMovements: [],
        skipped,
        errors: ['Reporte MT5 reconocido pero sin posiciones ni movimientos de balance.'],
        format: 'mt5-history',
      }
    }
    return {
      trades,
      cashMovements,
      skipped,
      errors: [],
      format: 'mt5-history',
      brokerBalance: broker?.balance,
      brokerBalanceDate: broker?.date,
      mt5NetProfit,
    }
  }

  const headerRowIndex = findHeaderRowIndex(rows)
  const headers = rows[headerRowIndex].map((h) => String(h ?? ''))
  const brokerCols = findBrokerColumns(headers)

  if (brokerCols) {
    const { trades, cashMovements, skipped } = importBrokerHistory(rows, headerRowIndex, brokerCols)
    if (trades.length === 0 && cashMovements.length === 0) {
      return {
        trades: [],
        cashMovements: [],
        skipped,
        errors: [
          'No se pudieron leer posiciones. Verifica que la fila de encabezados tenga Symbol, Position, Date Time y Profit.',
        ],
        format: 'broker',
      }
    }
    return { trades, cashMovements, skipped, errors: [], format: 'broker' }
  }

  const generic = importGeneric(rows, headerRowIndex)
  return { ...generic, cashMovements: [], format: 'generic' }
}
