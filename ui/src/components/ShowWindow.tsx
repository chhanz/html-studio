import { useMemo } from 'react'
import { useAppApi } from '@kirocrew/app-sdk'
import { makeClient } from '../api'
import { useI18n } from '../i18n'
import { Presenter } from './Presenter'

/** Query parameters the dashboard puts on the pop-out URL (see App.present). */
export type ShowParams = {
  deck: string
  url: string
  base: string
  slide: number
  count: number
}

export const SHOW_PARAM = 'hsShow'

export function readShowParams(search: string): ShowParams | null {
  const q = new URLSearchParams(search)
  if (!q.has(SHOW_PARAM)) return null
  const deck = q.get('deck') ?? ''
  const url = q.get('url') ?? ''
  const base = q.get('base') ?? ''
  const slide = Number(q.get('slide') ?? '1')
  const count = Number(q.get('count') ?? '0')
  if (!deck || !url || !base || !Number.isFinite(slide) || !Number.isFinite(count)) return null
  return { deck, url, base, slide: Math.max(1, slide), count: Math.max(0, count) }
}

export function showWindowUrl(p: ShowParams): string {
  const q = new URLSearchParams({ [SHOW_PARAM]: '1', deck: p.deck, url: p.url, base: p.base, slide: String(p.slide), count: String(p.count) })
  return `${location.origin}${location.pathname}?${q.toString()}`
}

/**
 * The show in its own window. This app's page is opened a second time by the
 * dashboard (same origin, so Electron gives it a real window and grants the
 * Fullscreen API; a blob: wrapper is silently refused) and renders only the
 * presentation, covering the dashboard chrome underneath. Closing the window
 * ends the show; the dashboard notices through the window handle it kept.
 */
export function ShowWindow({ params }: { params: ShowParams }) {
  const api = useAppApi()
  const client = useMemo(() => makeClient(api), [api])
  const { t, locale } = useI18n()
  return (
    <Presenter
      t={t}
      mode="window"
      url={params.url}
      baseUrl={params.base}
      startSlide={params.slide}
      slideCount={params.count}
      onClose={() => window.close()}
      openPresenter={async (slide) => {
        await client.present(params.deck, slide, 'presenter', locale)
      }}
    />
  )
}
