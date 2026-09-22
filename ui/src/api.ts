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

export type RootsResponse = { roots: string[]; pickerSupported?: boolean; added?: string; cancelled?: boolean }
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

export class ApiError extends Error {
  constructor(public code: string, message?: string, public body?: Record<string, unknown>) {
    super(message ?? code)
  }
}

/** Unwrap the app-sdk error shape into a stable error code. */
function toApiError(err: unknown): ApiError {
  const anyErr = err as { body?: { error?: string; detail?: string }; message?: string }
  const code = anyErr?.body?.error ?? 'request_failed'
  return new ApiError(code, anyErr?.body?.detail ?? anyErr?.message, anyErr?.body as Record<string, unknown> | undefined)
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
    addRoot: (path?: string) => wrap(api.post<RootsResponse>(`${API}/roots/add`, path ? { path } : {})),
    removeRoot: (path: string) => wrap(api.post<RootsResponse>(`${API}/roots/remove`, { path })),
    decks: () => wrap(api.get<DecksResponse>(`${API}/decks`)),
    previewStart: (path: string) => wrap(api.post<PreviewInfo>(`${API}/preview/start`, { path })),
    previewStop: (path: string) => wrap(api.post<{ stopped: boolean }>(`${API}/preview/stop`, { path })),
    buildInfo: (path: string) => wrap(api.post<BuildInfo>(`${API}/build/info`, { path })),
    build: (path: string, trust = false) => wrap(api.post<BuildResult>(`${API}/build`, { path, trust })),
  }
}

export type Client = ReturnType<typeof makeClient>
