import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type Client, type Deck, type PreviewInfo } from '../api'
import type { Drafts } from '../components/CodeEditor'

export type ViewMode = 'slides' | 'output' | 'code'

type Args = {
  client: Client
  selected: Deck | null
  setDecks: React.Dispatch<React.SetStateAction<Deck[]>>
  /** Called when the deck changed on disk outside the studio (slides or files). */
  onExternalChange: () => void
}

/**
 * The preview server for the selected deck and everything that follows it:
 * the current slide, the reload key that makes frames re-fetch, the view mode,
 * the code editor's drafts, and the 2.5-second poll that notices edits made
 * outside the studio (the agent writing slides, an editor saving).
 */
export function usePreview({ client, selected, setDecks, onExternalChange }: Args) {
  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), [])
  const [viewMode, setViewMode] = useState<ViewMode>('slides')
  // Code editor drafts (unsaved text per slide), kept across slide and view switches.
  const draftsRef = useRef<Drafts>(new Map())
  // Output view: the frame follows `current` through its hash (src={url#N}); the
  // built-in runtime also reports its own navigation back, so the strip follows.
  const outputFrameRef = useRef<HTMLIFrameElement>(null)

  // Start a preview server for the selected deck; stop the previous one.
  useEffect(() => {
    if (!selected) {
      setPreview(null)
      return
    }
    let alive = true
    const path = selected.path
    setPreview(null)
    setPreviewError(null)
    setCurrent(0)
    client
      .previewStart(path)
      .then((info) => alive && setPreview(info))
      .catch((e) => alive && setPreviewError(e instanceof ApiError ? e.code : 'request_failed'))
    return () => {
      alive = false
      void client.previewStop(path).catch(() => undefined)
    }
  }, [client, selected?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string; index?: number } | null
      if (!m || m.type !== 'hs-slide' || typeof m.index !== 'number') return
      if (e.source === outputFrameRef.current?.contentWindow) setCurrent(m.index)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    setViewMode('slides')
  }, [selected?.path])

  // preview/start is idempotent and reports the slide list and the newest
  // mtime, so a light poll keeps the strip and the viewer in step without a
  // file watcher.
  const syncDeck = useCallback(async () => {
    if (!selected || !preview) return
    try {
      const p = await client.previewStart(selected.path)
      const slidesChanged = p.slides.length !== preview.slides.length || p.slides.some((s, i) => s !== preview.slides[i])
      const touched = p.modifiedAt !== undefined && preview.modifiedAt !== undefined && p.modifiedAt > preview.modifiedAt
      if (slidesChanged || touched || p.css !== preview.css) {
        setPreview(p)
        setReloadKey((k) => k + 1)
        onExternalChange()
        if (slidesChanged) {
          setDecks((ds) => ds.map((d) => (d.id === selected.id ? { ...d, slideCount: p.slides.length, slides: p.slides } : d)))
          setCurrent((c) => Math.min(c, Math.max(0, p.slides.length - 1)))
        }
      }
    } catch {
      /* preview restarting or backend away: the next tick tries again */
    }
  }, [client, selected, preview, setDecks, onExternalChange])
  useEffect(() => {
    if (!selected || !preview) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void syncDeck()
    }, 2500)
    return () => clearInterval(id)
  }, [selected, preview, syncDeck])

  return {
    preview,
    setPreview,
    previewError,
    setPreviewError,
    current,
    setCurrent,
    reloadKey,
    bumpReload,
    viewMode,
    setViewMode,
    draftsRef,
    outputFrameRef,
    syncDeck,
  }
}
