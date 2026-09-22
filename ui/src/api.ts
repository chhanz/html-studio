import type { AppApi } from '@kirocrew/app-sdk'

export const API = '/apps/html-studio/api'

export type BackendStatus = { app: string; version: string; python: string; dataDir: string; pickerSupported: boolean }

export type Deck = {
  id: string
  name: string
  path: string
  root: string
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

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code)
  }
}

/** Unwrap the app-sdk error shape into a stable error code. */
function toApiError(err: unknown): ApiError {
  const anyErr = err as { body?: { error?: string; detail?: string }; message?: string }
  const code = anyErr?.body?.error ?? 'request_failed'
  return new ApiError(code, anyErr?.body?.detail ?? anyErr?.message)
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
  }
}

export type Client = ReturnType<typeof makeClient>
