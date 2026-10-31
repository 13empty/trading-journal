/**
 * Shared secret for the local bridge.
 * Browsers cannot set WebSocket headers, so the handshake also accepts ?token=.
 * HTTP calls must send the X-TJ-Token header.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const TOKEN_HEADER = 'x-tj-token'
export const TOKEN_FILE_NAME = 'bridge-token'
export const MT5_COMMON_TOKEN_NAME = 'trading-journal-bridge-token.txt'

export function generateToken() {
  return crypto.randomBytes(32).toString('hex')
}

/** Origins the Electron window and the Vite dev/preview servers use. */
export function appOrigins() {
  const origins = new Set([
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
  ])
  const appPort = process.env.TJ_APP_PORT
  if (appPort) {
    origins.add(`http://127.0.0.1:${appPort}`)
    origins.add(`http://localhost:${appPort}`)
  }
  const extra = process.env.TJ_ALLOWED_ORIGINS || ''
  for (const origin of extra.split(',')) {
    const trimmed = origin.trim()
    if (trimmed) origins.add(trimmed)
  }
  return origins
}

/**
 * No Origin header: native clients (Python, MQL5, Electron main).
 * A present Origin must be the journal UI. Foreign pages are rejected.
 */
export function isOriginAllowed(origin) {
  if (origin == null || origin === '') return true
  return appOrigins().has(origin)
}

export function tokensEqual(expected, presented) {
  if (typeof expected !== 'string' || typeof presented !== 'string' || !expected || !presented) {
    return false
  }
  const a = Buffer.from(expected)
  const b = Buffer.from(presented)
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a)
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

export function headerToken(req) {
  const header = req.headers?.[TOKEN_HEADER]
  if (typeof header === 'string') return header.trim()
  if (Array.isArray(header) && typeof header[0] === 'string') return header[0].trim()
  return ''
}

export function writeTokenFile(dataDir, token) {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = path.join(dataDir, TOKEN_FILE_NAME)
  fs.writeFileSync(file, `${token}\n`, { encoding: 'utf8', mode: 0o600 })
  publishMt5CommonToken(token)
  return file
}

/** So the MQL5 EA can read the token from MetaTrader's common Files folder. */
function publishMt5CommonToken(token) {
  const appdata = process.env.APPDATA
  if (!appdata) return
  const terminal = path.join(appdata, 'MetaQuotes', 'Terminal')
  if (!fs.existsSync(terminal)) return
  const dir = path.join(terminal, 'Common', 'Files')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, MT5_COMMON_TOKEN_NAME), `${token}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    })
  } catch {
    /* MT5 common folder not writable */
  }
}

export function readTokenFile(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return ''
  }
}
