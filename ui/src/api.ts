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
    present: (path: string, slide?: number, mode?: 'presenter', language?: string) =>
      wrap(api.post<{ url: string; opened: boolean }>(`${API}/present`, { path, slide, mode, language })),
    pdfStart: (path: string) => wrap(api.post<PdfJob>(`${API}/pdf`, { path })),
    pdfStatus: (id: string) => wrap(api.get<PdfJob>(`${API}/pdf?id=${encodeURIComponent(id)}`)),
    reveal: (path: string, file: string) => wrap(api.post<{ revealed: string }>(`${API}/reveal`, { path, file })),
    notesIndex: (path: string) => wrap(api.get<NotesIndex>(`${API}/notes?path=${encodeURIComponent(path)}`)),
    noteGet: (path: string, slide: string) => wrap(api.get<Note>(`${API}/note?path=${encodeURIComponent(path)}&slide=${encodeURIComponent(slide)}`)),
    sourceGet: (path: string, slide: string) => wrap(api.get<SlideSource>(`${API}/source?path=${encodeURIComponent(path)}&slide=${encodeURIComponent(slide)}`)),
    sourceSave: (path: string, slide: string, text: string, mtime: number | null) =>
      wrap(api.post<SourceSaved>(`${API}/source`, mtime === null ? { path, slide, text } : { path, slide, text, mtime })),
    slidesReorder: (path: string, order: string[]) => wrap(api.post<Arranged & { order: string[] }>(`${API}/slides/reorder`, { path, order })),
    slidesAdd: (path: string, after: string | null, duplicate = false, layout?: string) =>
      wrap(api.post<Arranged & { name: string }>(`${API}/slides/add`, layout ? { path, after, duplicate, layout } : { path, after, duplicate })),
    layouts: () => wrap(api.get<{ items: Layout[] }>(`${API}/layouts`)),
    layoutSave: (path: string, slide: string, name: string) => wrap(api.post<Layout>(`${API}/layouts`, { path, slide, name })),
    layoutDelete: (id: string) => wrap(api.post<{ ok: true }>(`${API}/layouts/delete`, { id })),
    slidesArchive: (path: string, slide: string) => wrap(api.post<Arranged & { name: string; file: string }>(`${API}/slides/archive`, { path, slide })),
    slidesRestore: (path: string, name: string, after: string | null) => wrap(api.post<Arranged & { name: string }>(`${API}/slides/restore`, { path, name, after })),
    slidesArchiveList: (path: string) => wrap(api.get<{ items: ArchivedSlide[] }>(`${API}/slides/archive?path=${encodeURIComponent(path)}`)),
    noteSave: (path: string, slide: string, text: string) => wrap(api.post<{ slide: string; file: string; exists: boolean }>(`${API}/note`, { path, slide, text })),
    checkStart: (path: string) => wrap(api.post<CheckJob>(`${API}/check`, { path })),
    checkStatus: (id: string) => wrap(api.get<CheckJob>(`${API}/check?id=${encodeURIComponent(id)}`)),
    pinsSend: (path: string, pins: unknown[], language: string) => wrap(api.post<BatchSent>(`${API}/pins/send`, { path, pins, language })),
    pinsQueue: (path: string) => wrap(api.get<{ batches: Batch[] }>(`${API}/pins/queue?path=${encodeURIComponent(path)}`)),
    pinsReply: (path: string, id: string, cid: string, text: string) => wrap(api.post<{ ok: true }>(`${API}/pins/reply`, { path, id, cid, text })),
    pinsDismiss: (path: string, id: string) => wrap(api.post<{ dismissed: string }>(`${API}/pins/dismiss`, { path, id })),
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

export type BatchComment = {
  cid: string
  index: number
  pinId: string
  status: 'sent' | 'done' | 'question'
  comment: string
  slideIndex: number
  slideFile: string
  selector: string
  text: string
  thread: { role: 'agent' | 'user'; text: string; ts: number | null }[]
}
export type Batch = { id: string; deck: string; deckPath: string; createdAt: number; state: 'sent' | 'done'; comments: BatchComment[] }
export type BatchSent = { id: string; file: string; prompt: string; comments: BatchComment[] }

export type CheckSeverity = 'error' | 'warning' | 'info'
export type CheckIssue = {
  rule: string
  severity: CheckSeverity
  slideIndex: number
  slideFile: string
  selector: string
  tag: string
  classes: string[]
  text: string
  rect: { x: number; y: number; w: number; h: number } | null
  detail: string
  src?: string | null
  otherSelector?: string
}
export type CheckResult = { issues: CheckIssue[]; counts: Record<string, number>; slides: number; rules: Record<string, CheckSeverity>; disabled: string[] }
export type CheckJob = { id: string; state: 'running' | 'done' | 'error'; result?: CheckResult; error?: string; detail?: string }

export type NotesIndex = { withNotes: string[]; orphans: string[]; dir: string }
export type SlideSource = { slide: string; file: string; kind: 'file' | 'section'; text: string; mtime: number }
export type SourceSaved = { slide: string; file: string; mtime: number; rebuild?: BuildResult | { skipped: string } }
export type Layout = { id: string; name: string | null; builtin: boolean; created?: number }
export type Arranged = { slides: string[]; rebuild?: BuildResult | { skipped: string } }
export type ArchivedSlide = { name: string; file: string; mtime: number; hasNote: boolean }
export type Note = { slide: string; file: string; text: string }
