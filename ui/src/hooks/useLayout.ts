import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, type Client, type Deck, type PdfJob } from '../api'

/** PDF export: a polled job; the banner shows the result until dismissed. */
export function usePdf(client: Client, selected: Deck | null) {
  const [pdf, setPdf] = useState<PdfJob | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  useEffect(() => {
    setPdf(null)
    setPdfError(null)
  }, [selected?.path])
  const exportPdf = useCallback(async () => {
    if (!selected) return
    setPdfError(null)
    try {
      let job = await client.pdfStart(selected.path)
      setPdf(job)
      while (job.state === 'running') {
        await new Promise((r) => setTimeout(r, 1000))
        job = await client.pdfStatus(job.id)
        setPdf(job)
      }
      if (job.state === 'error') setPdfError(job.error ?? 'pdf_failed')
    } catch (e) {
      setPdf(null)
      setPdfError(e instanceof ApiError ? e.code : 'request_failed')
    }
  }, [client, selected])
  const dismiss = useCallback(() => {
    setPdf(null)
    setPdfError(null)
  }, [])
  return { pdf, pdfError, exportPdf, dismiss }
}

type Ratio = { key: string; initial: number; min: number; max: number; fromPointer: (ev: PointerEvent, rect: DOMRect) => number }

/**
 * A draggable split ratio, persisted in localStorage. `boxRef` is the element
 * whose bounds the pointer position is measured against; the returned handler
 * goes on the separator's onPointerDown.
 */
export function useSplitRatio<E extends HTMLElement>({ key, initial, min, max, fromPointer }: Ratio) {
  const [ratio, setRatio] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(key))
      return v >= min && v <= max ? v : initial
    } catch {
      return initial
    }
  })
  const boxRef = useRef<E>(null)
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const box = boxRef.current
      if (!box) return
      e.preventDefault()
      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)
      const rect = box.getBoundingClientRect()
      const move = (ev: PointerEvent) => setRatio(Math.min(max, Math.max(min, fromPointer(ev, rect))))
      const up = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
        handle.removeEventListener('pointercancel', up)
        setRatio((r) => {
          try {
            localStorage.setItem(key, String(r))
          } catch {
            /* ignore */
          }
          return r
        })
      }
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', up)
      handle.addEventListener('pointercancel', up)
    },
    [key, min, max, fromPointer],
  )
  return { ratio, boxRef, onPointerDown }
}

/**
 * The host may or may not give this page a bounded height. Measure the header
 * block ourselves so the grid can be sized from the viewport and every pane
 * scrolls internally instead of growing the page.
 */
export function useHeaderHeight() {
  const headRef = useRef<HTMLDivElement>(null)
  const [headH, setHeadH] = useState(0)
  useEffect(() => {
    const el = headRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeadH(el.getBoundingClientRect().bottom))
    ro.observe(el)
    setHeadH(el.getBoundingClientRect().bottom)
    return () => ro.disconnect()
  }, [])
  return { headRef, headH }
}
