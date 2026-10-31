import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const APP_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
])

function readDevBridgeToken(): string {
  const candidates = []
  if (process.env.TJ_BRIDGE_DIR) {
    candidates.push(path.join(process.env.TJ_BRIDGE_DIR, 'bridge-token'))
  }
  candidates.push(path.resolve('bridge/bridge-token'))
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const token = fs.readFileSync(file, 'utf8').trim()
        if (token) return token
      }
    } catch {
      /* try the next file */
    }
  }
  return ''
}

/**
 * Browser dev (`npm run dev` / `npm run start`) has no Electron preload.
 * Serve the token only to the journal page itself. No CORS header, so a
 * foreign origin cannot read the body.
 */
function bridgeTokenPlugin(): Plugin {
  const serve = (
    req: { headers: { origin?: string; 'sec-fetch-site'?: string } },
    res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
  ) => {
    const origin = req.headers.origin
    const site = req.headers['sec-fetch-site']
    if (site === 'cross-site' || site === 'same-site' || (origin && !APP_ORIGINS.has(origin))) {
      res.statusCode = 403
      res.setHeader('Cache-Control', 'no-store')
      res.end()
      return
    }
    const token = readDevBridgeToken()
    res.statusCode = token ? 200 : 404
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(token ? { token } : { error: 'no_token' }))
  }

  return {
    name: 'tj-bridge-token',
    configureServer(server) {
      server.middlewares.use('/__tj/bridge-token', (req, res) => {
        serve(req, res)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__tj/bridge-token', (req, res) => {
        serve(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), bridgeTokenPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    cors: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    cors: false,
  },
})
