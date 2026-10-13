import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, type Client, type Deck, type PreviewInfo } from '../api'
import { MAX_BATCH } from '../components/CheckPanel'
import { type Capture, type Pin, loadPins, newPin, savePins } from '../pins'
import type { ViewMode } from './usePreview'

type Args = {
  client: Client
  selected: Deck | null
  preview: PreviewInfo | null
  current: number
  locale: string
  setCurrent: (i: number) => void
  setViewMode: (m: ViewMode) => void
  bumpReload: () => void
  /** Open the deck chat and post a message (from useDeckChat). */
  postToChat: (deck: Deck, message: string) => Promise<string>
  /** The chat pane may have looked up before the session existed: make it look again. */
  bumpChat: () => void
}

/** Deck-relative source path the agent will open (single-file decks: the entry itself). */
export function slideFileFor(deck: Deck | null, preview: PreviewInfo, slideIndex: number): string {
  const name = preview.slides[slideIndex] ?? String(slideIndex + 1)
  return deck?.kind === 'single' ? deck.entry ?? name : `${deck?.slidesDir ?? 'slides'}/${name}`
}

/**
 * Select-to-edit. The viewer frame runs the overlay (backend/inject/select.js)
 * and reports clicks; pins live here (persisted per deck) and are pushed back
 * to the frame so it can draw and re-anchor the markers. Pins are sent to the
 * deck's chat as one batch, then the agent's per-pin reports (report.py, via
 * the queue) are followed until every pin is done.
 */
export function usePins({ client, selected, preview, current, locale, setCurrent, setViewMode, bumpReload, postToChat, bumpChat }: Args) {
  const [selectMode, setSelectMode] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [activePin, setActivePin] = useState<string | null>(null)
  const viewerFrame = useRef<HTMLIFrameElement | null>(null)
  const setViewerFrame = useCallback((el: HTMLIFrameElement | null) => {
    viewerFrame.current = el
  }, [])
  useEffect(() => {
    setSelectMode(false)
    setActivePin(null)
    setPins(selected ? loadPins(selected.path) : [])
  }, [selected?.path]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selected) savePins(selected.path, pins)
  }, [pins, selected?.path]) // eslint-disable-line react-hooks/exhaustive-deps
  const pushPins = useCallback(() => {
    const w = viewerFrame.current?.contentWindow
    if (!w) return
    const forSlide = pins
      .filter((p) => p.slideIndex === current)
      .map((p) => ({ id: p.id, index: p.index, status: p.status, cid: p.cid, selector: p.selector, rect: p.rect, comment: p.comment }))
    w.postMessage({ type: 'hs-pins', pins: forSlide }, '*')
  }, [pins, current])
  useEffect(() => {
    if (selectMode) pushPins()
  }, [pushPins, selectMode])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== viewerFrame.current?.contentWindow) return
      const m = e.data as { type?: string } & Partial<Capture> & { pins?: { id: string; how: Pin['how'] }[] }
      if (!m || typeof m.type !== 'string') return
      if (m.type === 'hs-select-ready') {
        pushPins()
      } else if (m.type === 'hs-capture' && typeof m.selector === 'string' && preview) {
        const cap = m as unknown as Capture
        const slideFile = slideFileFor(selected, preview, cap.slideIndex)
        setPins((prev) => {
          const nextIndex = prev.reduce((max, p) => Math.max(max, p.index), 0) + 1
          const pin = newPin(cap, slideFile, nextIndex)
          setActivePin(pin.id)
          return [...prev, pin]
        })
      } else if (m.type === 'hs-anchored' && Array.isArray(m.pins)) {
        const how = new Map(m.pins.map((a) => [a.id, a.how]))
        setPins((prev) => (prev.some((p) => how.has(p.id) && p.how !== how.get(p.id)) ? prev.map((p) => (how.has(p.id) ? { ...p, how: how.get(p.id) } : p)) : prev))
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [preview, pushPins, selected?.kind, selected?.entry, selected?.slidesDir]) // eslint-disable-line react-hooks/exhaustive-deps
  const updatePinComment = useCallback((id: string, comment: string) => setPins((prev) => prev.map((p) => (p.id === id ? { ...p, comment } : p))), [])
  const removePin = useCallback((id: string) => setPins((prev) => prev.filter((p) => p.id !== id)), [])
  const jumpToPin = useCallback(
    (slideIndex: number, id: string) => {
      setCurrent(slideIndex)
      setActivePin(id)
      setViewMode('slides')
    },
    [setCurrent, setViewMode],
  )

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // Drafts left behind by the last send because a batch holds at most MAX_BATCH pins.
  const [sendLeft, setSendLeft] = useState(0)
  const sendPins = useCallback(async () => {
    if (!selected || sending) return
    const ready = pins.filter((p) => p.status === 'new' && p.comment.trim())
    if (!ready.length) return
    const drafts = ready.slice(0, MAX_BATCH)
    setSending(true)
    setSendError(null)
    try {
      const batch = await client.pinsSend(selected.path, drafts, locale)
      await postToChat(selected, batch.prompt)
      const cidByPin = new Map(batch.comments.map((c) => [c.pinId, c.cid]))
      setPins((prev) => prev.map((p) => (cidByPin.has(p.id) ? { ...p, status: 'sent', batchId: batch.id, batchCid: cidByPin.get(p.id), thread: [] } : p)))
      setSendLeft(ready.length - drafts.length)
      bumpChat()
    } catch (e) {
      setSendError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'request_failed')
    } finally {
      setSending(false)
    }
  }, [client, selected, pins, sending, locale, postToChat, bumpChat])
  useEffect(() => setSendLeft(0), [selected?.path])

  // Poll the queue while any pin is out with the agent; a finished batch reloads the preview.
  const outstanding = pins.some((p) => p.status === 'sent')
  useEffect(() => {
    if (!selected || !outstanding) return
    let alive = true
    const tick = async () => {
      try {
        const { batches } = await client.pinsQueue(selected.path)
        if (!alive) return
        const byCid = new Map(batches.flatMap((b) => b.comments.map((c) => [c.cid, { c, state: b.state }] as const)))
        let completed = false
        setPins((prev) => {
          let changed = false
          const next = prev.map((p) => {
            const hit = p.batchCid ? byCid.get(p.batchCid) : undefined
            if (!hit || hit.c.status === p.status) return p
            changed = true
            if (hit.c.status === 'done' || hit.c.status === 'question') completed = completed || hit.state === 'done'
            return { ...p, status: hit.c.status, thread: hit.c.thread }
          })
          return changed ? next : prev
        })
        if (completed) bumpReload()
      } catch (e) {
        console.warn('[html-studio] pins/queue failed', e)
      }
    }
    void tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [client, selected?.path, outstanding]) // eslint-disable-line react-hooks/exhaustive-deps

  const replyToPin = useCallback(
    async (id: string, text: string) => {
      const pin = pins.find((p) => p.id === id)
      if (!selected || !pin?.batchCid || !pin.batchId) return
      try {
        await client.pinsReply(selected.path, pin.batchId, pin.batchCid, text)
        const msg = `Re pin [${pin.batchCid}] (${pin.slideFile} > ${pin.selector}): ${text}\nContinue with that comment and report again with report.py (--cid ${pin.batchCid}).`
        await postToChat(selected, msg)
        setPins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'sent', thread: [...(p.thread ?? []), { role: 'user', text, ts: Date.now() }] } : p)))
      } catch (e) {
        setSendError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'request_failed')
      }
    },
    [client, selected, pins, postToChat],
  )
  const dismissDone = useCallback(() => {
    const doneBatches = new Set(pins.filter((p) => p.status === 'done' && p.batchId).map((p) => p.batchId as string))
    setPins((prev) => prev.filter((p) => p.status !== 'done'))
    // Batch files whose every pin is gone from the panel can be removed.
    if (selected) {
      for (const b of doneBatches) {
        if (!pins.some((p) => p.batchId === b && p.status !== 'done')) void client.pinsDismiss(selected.path, b).catch(() => undefined)
      }
    }
  }, [pins, selected, client])

  const pinnedIssues = useMemo(() => new Set(pins.map((p) => p.issueKey).filter((k): k is string => !!k)), [pins])

  return {
    selectMode,
    setSelectMode,
    pins,
    setPins,
    activePin,
    setViewerFrame,
    updatePinComment,
    removePin,
    jumpToPin,
    sending,
    sendError,
    sendLeft,
    sendPins,
    replyToPin,
    dismissDone,
    pinnedIssues,
  }
}
