// Stand-in for the dashboard's `@kirocrew/app-sdk` module in the E2E harness.
// Mirrors the two behaviours the app depends on:
//  * useAppApi(): fetch wrapper that JSON-encodes bodies, throws on non-2xx
//    with the parsed body attached, and refuses paths the manifest's
//    permissions.api does not cover (the real SDK does the same client-side).
//  * everything else is a harmless stub.
import { useMemo } from 'react'

let allowed = null
async function loadAllowed() {
  if (allowed) return allowed
  const manifest = await (await fetch('/app.json')).json()
  allowed = manifest?.permissions?.api ?? []
  return allowed
}

function permitted(path, list) {
  return list.some((p) => (p.endsWith('/*') ? path.startsWith(p.slice(0, -1)) : path === p || path.startsWith(p + '/')))
}

async function request(path, init = {}) {
  if (/^https?:\/\//.test(path)) throw new Error('[app-sdk] absolute URLs are not allowed')
  const list = await loadAllowed()
  // Like the real SDK: the check is on the pathname, so "/api/chat?ws=1" is covered by "/api/chat".
  const pathname = new URL(path, 'http://localhost').pathname
  if (!permitted(pathname, list)) {
    throw new Error(`[app-sdk] App "html-studio" not permitted to access ${pathname}. Declared: [${list.join(', ')}]`)
  }
  const headers = { ...(init.headers || {}) }
  let body = init.body
  if (body !== undefined && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(body)
  }
  const res = await fetch(path, { ...init, headers, body })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    // Same shape as the dashboard SDK: a plain Error with "API <status>: <text>" and NO body.
    throw new Error(`API ${res.status}: ${text}`)
  }
  return data
}

const api = {
  get: (p, init) => request(p, { ...init, method: 'GET' }),
  post: (p, body) => request(p, { method: 'POST', body: body ?? {} }),
  put: (p, body) => request(p, { method: 'PUT', body: body ?? {} }),
  patch: (p, body) => request(p, { method: 'PATCH', body: body ?? {} }),
}

export function useAppApi() {
  return useMemo(() => api, [])
}
export function useAppEvents() {}
export function useTheme() {
  return { theme: 'light' }
}
export function useAppInfo() {
  return { name: 'html-studio' }
}
export function useNavigate() {
  // Records instead of navigating so a test can assert the target.
  return (to) => {
    ;(window.__hsNav ||= []).push(to)
  }
}
export function useNotify() {
  return () => {}
}
export function useChatLauncher() {
  return { openChat: () => {} }
}
export const AppApiProvider = ({ children }) => children
