/**
 * Local bridge must ignore unauthenticated callers and foreign web origins.
 * Run: node --test bridge/auth.test.mjs
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { WebSocket } from 'ws'
import { startBridge } from './server.mjs'

const TOKEN = 'a'.repeat(64)
const ALLOWED_ORIGIN = 'http://127.0.0.1:5173'
const EVIL_ORIGIN = 'https://evil.example'

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
    server.on('error', reject)
  })
}

async function withBridge(fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-bridge-'))
  const port = await freePort()
  const bridge = await startBridge({ port, token: TOKEN, dataDir })
  try {
    await fn(bridge)
  } finally {
    await bridge.close()
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
}

function request({ port, method, pathname, token, origin, body }) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : JSON.stringify(body)
    const headers = {}
    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
    }
    if (token) headers['X-TJ-Token'] = token
    if (origin) headers.Origin = origin
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path: pathname, headers },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let parsed = null
          try {
            parsed = raw ? JSON.parse(raw) : null
          } catch {
            parsed = raw
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed })
        })
      },
    )
    req.on('error', reject)
    if (payload) req.end(payload)
    else req.end()
  })
}

test('POST /api/close-all without a token is rejected and does not queue a close', async () => {
  await withBridge(async (bridge) => {
    const denied = await request({
      port: bridge.port,
      method: 'POST',
      pathname: '/api/close-all',
      body: { reason: 'day_rule' },
    })
    assert.equal(denied.status, 401)
    assert.equal(denied.headers['access-control-allow-origin'], undefined)

    const queued = await request({
      port: bridge.port,
      method: 'GET',
      pathname: '/api/command',
      token: TOKEN,
    })
    assert.equal(queued.status, 200)
    assert.equal(queued.body.action, null)
  })
})

test('a token in the query string does not authorize HTTP', async () => {
  await withBridge(async (bridge) => {
    const denied = await request({
      port: bridge.port,
      method: 'POST',
      pathname: `/api/close-all?token=${TOKEN}`,
      body: { reason: 'day_rule' },
    })
    assert.equal(denied.status, 401)
  })
})

test('wrong token is rejected and a foreign Origin is forbidden even with the token', async () => {
  await withBridge(async (bridge) => {
    const wrong = await request({
      port: bridge.port,
      method: 'POST',
      pathname: '/api/close-all',
      token: 'not-the-token',
      body: { reason: 'day_rule' },
    })
    assert.equal(wrong.status, 401)

    const foreign = await request({
      port: bridge.port,
      method: 'POST',
      pathname: '/api/close-all',
      token: TOKEN,
      origin: EVIL_ORIGIN,
      body: { reason: 'day_rule' },
    })
    assert.equal(foreign.status, 403)
    assert.notEqual(foreign.headers['access-control-allow-origin'], '*')
    assert.equal(foreign.headers['access-control-allow-origin'], undefined)

    const preflight = await request({
      port: bridge.port,
      method: 'OPTIONS',
      pathname: '/api/close-all',
      origin: EVIL_ORIGIN,
    })
    assert.equal(preflight.status, 403)
    assert.equal(preflight.headers['access-control-allow-origin'], undefined)

    const stillIdle = await request({
      port: bridge.port,
      method: 'GET',
      pathname: '/api/command',
      token: TOKEN,
    })
    assert.equal(stillIdle.body.action, null)
  })
})

test('the app origin with the token can queue close-all and read CORS for that origin only', async () => {
  await withBridge(async (bridge) => {
    const preflight = await request({
      port: bridge.port,
      method: 'OPTIONS',
      pathname: '/api/close-all',
      origin: ALLOWED_ORIGIN,
    })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers['access-control-allow-origin'], ALLOWED_ORIGIN)
    assert.match(String(preflight.headers['access-control-allow-headers']), /x-tj-token/i)
    assert.notEqual(preflight.headers['access-control-allow-origin'], '*')

    const queued = await request({
      port: bridge.port,
      method: 'POST',
      pathname: '/api/close-all',
      token: TOKEN,
      origin: ALLOWED_ORIGIN,
      body: { reason: 'day_rule' },
    })
    assert.equal(queued.status, 200)
    assert.equal(queued.body.ok, true)
    assert.equal(queued.body.command.action, 'close_all')
    assert.equal(queued.headers['access-control-allow-origin'], ALLOWED_ORIGIN)

    const tokenFile = fs.readFileSync(path.join(bridge.dataDir, 'bridge-token'), 'utf8').trim()
    assert.equal(tokenFile, TOKEN)
  })
})

test('native clients with the token and no Origin can call the bridge', async () => {
  await withBridge(async (bridge) => {
    const status = await request({
      port: bridge.port,
      method: 'GET',
      pathname: '/api/status',
      token: TOKEN,
    })
    assert.equal(status.status, 200)
    assert.equal(status.headers['access-control-allow-origin'], undefined)

    const event = await request({
      port: bridge.port,
      method: 'POST',
      pathname: '/api/event',
      token: TOKEN,
      body: { type: 'heartbeat', balance: 1, equity: 1 },
    })
    assert.equal(event.status, 200)
    assert.equal(event.body.ok, true)
  })
})

test('websocket handshake requires the token and rejects a foreign Origin', async () => {
  await withBridge(async (bridge) => {
    const rejected = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/`)
      const timer = setTimeout(() => {
        ws.terminate()
        reject(new Error('websocket without token did not fail'))
      }, 3000)
      ws.on('open', () => {
        clearTimeout(timer)
        ws.close()
        resolve('open')
      })
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer)
        res.resume()
        resolve(res.statusCode)
      })
      ws.on('error', () => {})
    })
    assert.equal(rejected, 401)

    const foreign = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/?token=${TOKEN}`, {
        headers: { Origin: EVIL_ORIGIN },
      })
      const timer = setTimeout(() => {
        ws.terminate()
        reject(new Error('foreign websocket did not fail'))
      }, 3000)
      ws.on('open', () => {
        clearTimeout(timer)
        ws.close()
        resolve('open')
      })
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer)
        res.resume()
        resolve(res.statusCode)
      })
      ws.on('error', () => {})
    })
    assert.equal(foreign, 403)

    const message = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/?token=${encodeURIComponent(TOKEN)}`)
      const timer = setTimeout(() => {
        ws.terminate()
        reject(new Error('authenticated websocket timed out'))
      }, 3000)
      ws.on('message', (data) => {
        clearTimeout(timer)
        ws.close()
        resolve(JSON.parse(data.toString()))
      })
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer)
        res.resume()
        reject(new Error(`authenticated websocket rejected with ${res.statusCode}`))
      })
      ws.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
    assert.equal(message.type, 'sync')

    const fromApp = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${bridge.port}/?token=${encodeURIComponent(TOKEN)}`, {
        headers: { Origin: ALLOWED_ORIGIN },
      })
      const timer = setTimeout(() => {
        ws.terminate()
        reject(new Error('app-origin websocket timed out'))
      }, 3000)
      ws.on('message', (data) => {
        clearTimeout(timer)
        ws.close()
        resolve(JSON.parse(data.toString()))
      })
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer)
        res.resume()
        reject(new Error(`app-origin websocket rejected with ${res.statusCode}`))
      })
      ws.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
    assert.equal(fromApp.type, 'sync')
  })
})

test('reset, events and exchange routes also reject anonymous callers', async () => {
  await withBridge(async (bridge) => {
    for (const pathname of ['/api/reset', '/api/event', '/api/exchanges', '/api/exchanges/test']) {
      const denied = await request({
        port: bridge.port,
        method: 'POST',
        pathname,
        body: {},
      })
      assert.equal(denied.status, 401, pathname)
    }
  })
})
