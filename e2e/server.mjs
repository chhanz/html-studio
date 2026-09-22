// E2E harness server.
//
// Plays the part of the Kiro Crew gateway for the html-studio app:
//   * spawns backend/server.py on a free port with an isolated KIROCREW_HOME
//     and a fake HOME that contains the fixture decks (roots must be under HOME)
//   * serves the harness page, the built UI bundle and the SDK shim
//   * forwards /apps/html-studio/api/<path> to the backend as /api/<path>,
//     signed exactly like apps/routes.py::handle_app_api_proxy does
//   * exposes /__ctl/* so tests can stop/start the backend (late-start scenario)
//
// Usage: node server.mjs            (PORT env, default 4173)
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, cpSync, rmSync } from 'node:fs'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const PORT = Number(process.env.PORT || 4173)
const SECRET = randomBytes(16).toString('hex')

// Isolated state: fake HOME (fixture decks live here) + fake KIROCREW_HOME.
const runDir = process.env.E2E_RUN_DIR || join(here, '.run')
rmSync(runDir, { recursive: true, force: true })
const fakeHome = join(runDir, 'home')
const crewHome = join(runDir, 'crew')
mkdirSync(fakeHome, { recursive: true })
mkdirSync(crewHome, { recursive: true })
cpSync(join(here, 'fixtures', 'decks'), join(fakeHome, 'decks'), { recursive: true })

// ---------------------------------------------------------------- backend
let backend = null
let backendPort = 0

function freePort() {
  return new Promise((res) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => res(p))
    })
  })
}

async function startBackend() {
  if (backend) return
  backendPort = await freePort()
  backend = spawn(process.env.PYTHON || 'python3', [join(repo, 'backend', 'server.py')], {
    env: {
      PATH: process.env.PATH,
      HOME: fakeHome,
      LANG: 'en_US.UTF-8',
      PORT: String(backendPort),
      KIROCREW_APP_NAME: 'html-studio',
      KIROCREW_HOME: crewHome,
      KIROCREW_PROXY_SECRET: SECRET,
      HTML_STUDIO_NO_PICKER: '1',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  backend.on('exit', () => {
    backend = null
  })
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${backendPort}/health`)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('backend did not start')
}

function stopBackend() {
  return new Promise((res) => {
    if (!backend) return res()
    backend.once('exit', () => res())
    backend.kill('SIGTERM')
  })
}

// ------------------------------------------------------------------ proxy
function sign(method, target, body) {
  const ts = Math.floor(Date.now() / 1000)
  const bodyHash = createHash('sha256').update(body).digest('hex')
  const sig = createHmac('sha256', SECRET).update(`${ts}:${method}:${target}:${bodyHash}`).digest('hex')
  return `${ts}:${sig}`
}

async function proxy(req, res, body) {
  if (!backend) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: 'no_backend' }))
  }
  const target = '/api/' + req.url.slice('/apps/html-studio/api/'.length)
  const method = req.method
  const upstream = await fetch(`http://127.0.0.1:${backendPort}${target}`, {
    method,
    headers: { 'Content-Type': req.headers['content-type'] || 'application/json', 'X-KiroCrew-Proxy': sign(method, target, body) },
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' })
  res.end(buf)
}

// ----------------------------------------------------------------- static
const MIME = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
function serveFile(res, root, rel) {
  const path = normalize(join(root, rel))
  if (!path.startsWith(root) || !existsSync(path)) {
    res.writeHead(404)
    return res.end('not found')
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
  res.end(readFileSync(path))
}

const server = createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks)
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  try {
    if (p === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, backend: !!backend, backendPort, home: fakeHome }))
    }
    if (p === '/__ctl/backend/stop') {
      await stopBackend()
      res.writeHead(200)
      return res.end('stopped')
    }
    if (p === '/__ctl/backend/start') {
      await startBackend()
      res.writeHead(200)
      return res.end('started')
    }
    if (p === '/__ctl/reset') {
      await stopBackend()
      rmSync(crewHome, { recursive: true, force: true })
      mkdirSync(crewHome, { recursive: true })
      await startBackend()
      res.writeHead(200)
      return res.end('reset')
    }
    if (p.startsWith('/apps/html-studio/api/')) return await proxy(req, res, body)
    if (p === '/' || p === '/index.html') return serveFile(res, here, 'harness.html')
    if (p === '/app.json') return serveFile(res, repo, 'app.json')
    if (p.startsWith('/ui/')) return serveFile(res, join(repo, 'ui', 'dist'), p.slice(4))
    if (p.startsWith('/shim/')) return serveFile(res, join(here, 'shim', 'dist'), p.slice(6))
    res.writeHead(404)
    res.end('not found')
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end(String(e?.stack || e))
  }
})

await startBackend()
server.listen(PORT, '127.0.0.1', () => {
  console.log(`harness http://127.0.0.1:${PORT}  backend :${backendPort}  HOME=${fakeHome}`)
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => {
  await stopBackend()
  process.exit(0)
})
