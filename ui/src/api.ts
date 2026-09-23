import type { AppApi } from '@kirocrew/app-sdk'

export const API = '/apps/html-studio/api'

export type BackendStatus = { app: string; version: string; python: string; dataDir: string; pickerSupported: boolean }

export type Deck = {
  id: string
  name: string
  path: string
  root: string
  kind: 'slides' | 'single'
  entry: string | null
  slidesDir: string
  slideCount: number
  slides: string[]
  hasStudioJson: boolean
  hasDesignMd: boolean
  modifiedAt: number
}

export type RootsResponse = { roots: string[]; pickerSupported?: boolean; added?: string }
export type PickStatus = { id: string; state: 'pending' | 'added' | 'cancelled' | 'error'; roots?: string[]; added?: string; error?: string; detail?: string }
export type DecksResponse = { roots: string[]; decks: Deck[] }
export type PreviewInfo = {
  port: number
  baseUrl: string
  slides: string[]
  css: string | null
  stage: { width: number; height: number }
}

export type BuildInfo = {
  command: string | null
  output: string
  outputExists: boolean
  builtin: boolean
  buildable: boolean
  singleFile: boolean
  commandHash: string | null
  trusted: boolean
}
export type BuildIssue = { file: string; message: string }
export type BuildResult = {
  ok: boolean
  needsTrust?: boolean
  command?: string
  mode?: 'builtin' | 'external'
  exitCode?: number
  output?: string | null
  durationMs?: number
  issues?: BuildIssue[]
  stdout?: string
  stderr?: string
}

export type PdfJob = { id: string; state: 'running' | 'done' | 'error'; output?: string; bytes?: number; error?: string; detail?: string }

export class ApiError extends Error {
  constructor(public code: string, message?: string, public body?: Record<string, unknown>) {
    super(message ?? code)
  }
}

/** Unwrap the app-sdk error shape into a stable error code.
 *
 * The dashboard SDK throws `Error("API <status>: <response text>")` for any
 * non-2xx response (no structured body). Recover the backend's `{"error": ...}`
 * from that text so the UI can show the real reason instead of a generic one.
 */
function toApiError(err: unknown): ApiError {
  const anyErr = err as { body?: { error?: string; detail?: string }; message?: string; status?: number }
  if (anyErr?.body?.error) {
    return new ApiError(anyErr.body.error, anyErr.body.detail, anyErr.body as Record<string, unknown>)
  }
  const msg = String(anyErr?.message ?? '')
  const m = /^API (\d{3}): ([\s\S]*)$/.exec(msg)
  if (m) {
    const status = Number(m[1])
    let body: Record<string, unknown> | undefined
    try {
      body = JSON.parse(m[2])
    } catch {
      body = undefined
    }
    const code =
      (typeof body?.error === 'string' && body.error) ||
      (status === 502 || status === 503 || status === 504 ? 'backend_unavailable' : `http_${status}`)
    return new ApiError(code, typeof body?.detail === 'string' ? body.detail : msg, body)
  }
  return new ApiError('request_failed', msg || undefined)
}

export function makeClient(api: AppApi) {
  const wrap = async <T>(p: Promise<T>): Promise<T> => {
    try {
      return await p
    } catch (e) {
      throw toApiError(e)
    }
  }
  return {
    status: () => wrap(api.get<BackendStatus>(`${API}/status`)),
    roots: () => wrap(api.get<RootsResponse>(`${API}/roots`)),
    addRoot: (path: string) => wrap(api.post<RootsResponse>(`${API}/roots/add`, { path })),
    pickStart: () => wrap(api.post<PickStatus>(`${API}/roots/pick`, {})),
    pickStatus: (id: string) => wrap(api.get<PickStatus>(`${API}/roots/pick?id=${encodeURIComponent(id)}`)),
    removeRoot: (path: string) => wrap(api.post<RootsResponse>(`${API}/roots/remove`, { path })),
    decks: () => wrap(api.get<DecksResponse>(`${API}/decks`)),
    previewStart: (path: string) => wrap(api.post<PreviewInfo>(`${API}/preview/start`, { path })),
    previewStop: (path: string) => wrap(api.post<{ stopped: boolean }>(`${API}/preview/stop`, { path })),
    buildInfo: (path: string) => wrap(api.post<BuildInfo>(`${API}/build/info`, { path })),
    build: (path: string, trust = false) => wrap(api.post<BuildResult>(`${API}/build`, { path, trust })),
    present: (path: string, slide?: number) => wrap(api.post<{ url: string }>(`${API}/present`, { path, slide })),
    pdfStart: (path: string) => wrap(api.post<PdfJob>(`${API}/pdf`, { path })),
    pdfStatus: (id: string) => wrap(api.get<PdfJob>(`${API}/pdf?id=${encodeURIComponent(id)}`)),
    reveal: (path: string, file: string) => wrap(api.post<{ revealed: string }>(`${API}/reveal`, { path, file })),
    design: (path: string) => wrap(api.get<DesignInfo>(`${API}/design?path=${encodeURIComponent(path)}`)),
    writeTokens: (path: string) => wrap(api.post<DesignInfo>(`${API}/design/tokens`, { path })),
  }
}

export type DesignInfo = {
  present: boolean
  design: {
    name: string | null
    colors: Record<string, string>
    typography: Record<string, { size: string | null; weight: string | null; lineHeight: string | null; letterSpacing: string | null }>
    spacing: Record<string, string>
    rounded: Record<string, string>
    font: { family: string | null; fallback: string | null }
  } | null
  empty: boolean
  tokens: string
  tokensExists: boolean
  tokensStale: boolean
  css: string | null
}

export type Client = ReturnType<typeof makeClient>
