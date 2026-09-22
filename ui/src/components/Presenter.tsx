import { useCallback, useEffect, useRef, useState } from 'react'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  /** Built output URL (served by the deck's preview server). */
  url: string
  /** 1-based slide to start from. */
  startSlide: number
  slideCount: number
  onClose: () => void
}

type Zoom = { kind: 'img'; src: string; alt: string } | { kind: 'svg'; svg: string }

/**
 * Presentation mode inside the dashboard: a full-viewport overlay hosting the
 * built deck in an iframe, taken to real fullscreen with the Fullscreen API.
 *
 * Design notes (learned the hard way in the Electron shell):
 *  - Presenting IS fullscreen. Leaving fullscreen by any route (Esc, the OS
 *    control) ends the presentation, and ending the presentation leaves fullscreen.
 *  - Keyboard never depends on where focus is: a transparent shield sits over
 *    the iframe so keys arrive here (capture phase) whatever runtime the deck
 *    uses. A click on the shield is sent to the deck as a hit test (the deck is
 *    another origin, so we cannot look ourselves): an image under the pointer
 *    opens the lightbox. Clicks never navigate; keys do.
 *  - Closing never waits on the Fullscreen API: unmount first, then exit
 *    fullscreen best-effort. The shell can lower the window without firing
 *    fullscreenchange, so a watchdog compares the viewport with the screen.
 */
export function Presenter({ t, url, startSlide, slideCount, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [current, setCurrent] = useState(startSlide)
  const [fullscreen, setFullscreen] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [zoom, setZoom] = useState<Zoom | null>(null)
  const zoomRef = useRef<Zoom | null>(null)
  zoomRef.current = zoom
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closed = useRef(false)
  const wasFullscreen = useRef(false)
  // The deck is served with the presenter helper injected (see preview.py).
  const frameUrl = `${url}?hs=present`

  const close = useCallback(() => {
    if (closed.current) return
    closed.current = true
    onClose()
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  }, [onClose])

  const enterFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const req = () => el.requestFullscreen().catch(() => undefined) // refused: stay as an overlay; button retries
    const cur = document.fullscreenElement
    if (cur === el) return
    // A previous presentation may have left a stale fullscreen element behind
    // (the shell lowered the window without telling the document). Clear it first.
    if (cur) document.exitFullscreen().then(req, req)
    else void req()
  }, [])

  const post = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  const go = useCallback(
    (index1: number) => {
      const n = Math.max(1, Math.min(slideCount || index1, index1))
      setCurrent(n)
      post({ type: 'hs-go', index: n - 1 })
      // External runtimes usually follow the hash; a src change that only
      // differs in the fragment is a fragment navigation, not a reload — so it
      // must be the same presenter URL (with the helper query) as the initial load.
      const f = frameRef.current
      if (f) f.src = `${frameUrl}#${n}`
    },
    [post, slideCount, frameUrl],
  )

  // F: none. Esc is the single exit (fullscreen and presentation are one thing).

  // Ask the deck what is under the pointer; it answers hs-zoom or hs-miss.
  const hitTest = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const f = frameRef.current
    if (!f) return
    const r = f.getBoundingClientRect()
    post({ type: 'hs-hit', x: e.clientX - r.left, y: e.clientY - r.top })
  }, [post])

  useEffect(() => {
    rootRef.current?.focus()
    enterFullscreen()
    const onChange = () => {
      const fs = !!document.fullscreenElement
      setFullscreen(fs)
      if (fs) wasFullscreen.current = true
      else if (wasFullscreen.current) close()
    }
    document.addEventListener('fullscreenchange', onChange)
    // Watchdog: the shell can lower the window (Esc, green button) without a
    // fullscreenchange on the document. Arm only once the window has actually
    // reached screen size, so the entry animation is never mistaken for an exit.
    let windowWasFullscreen = false
    const tick = setInterval(() => {
      if (closed.current) return
      const windowIsFullscreen = window.innerHeight >= screen.height - 40 && window.innerWidth >= screen.width - 40
      if (windowIsFullscreen) windowWasFullscreen = true
      else if (windowWasFullscreen) close()
    }, 250)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      clearInterval(tick)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The built-in runtime reports its position and forwards keys it saw.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data as ({ type?: string; index?: number } & Partial<Zoom>) | null
      if (e.source !== frameRef.current?.contentWindow || !m) return
      if (m.type === 'hs-slide' && typeof m.index === 'number') setCurrent(m.index + 1)
      else if (m.type === 'hs-exit') close()
      else if (m.type === 'hs-zoom' && m.kind === 'img' && typeof m.src === 'string') setZoom({ kind: 'img', src: m.src, alt: m.alt ?? '' })
      else if (m.type === 'hs-zoom' && m.kind === 'svg' && typeof m.svg === 'string') setZoom({ kind: 'svg', svg: m.svg })
      // hs-miss: nothing under the pointer worth enlarging; clicks do not navigate.
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [close])

  // Keyboard, capture phase: fires before any host handler and regardless of focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        if (zoomRef.current) setZoom(null)
        else close()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
        setZoom(null)
        go(current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        setZoom(null)
        go(current - 1)
      } else if (e.key === 'Home') go(1)
      else if (e.key === 'End') go(slideCount)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [current, go, close, slideCount])

  // Auto-hide the control bar while the pointer is still.
  const poke = () => {
    setChrome(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setChrome(false), 2500)
  }
  useEffect(() => {
    poke()
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const btn = { color: '#ddd', borderColor: '#555' }
  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t('present.title')}
      tabIndex={-1}
      onMouseMove={poke}
      className="fixed inset-0 flex flex-col outline-none"
      style={{ zIndex: 1000, background: '#000', cursor: chrome ? 'default' : 'none' }}
    >
      <iframe
        ref={frameRef}
        src={`${frameUrl}#${startSlide}`}
        title={t('present.title')}
        sandbox="allow-scripts allow-same-origin"
        tabIndex={-1}
        className="flex-1 w-full h-full border-0"
      />
      {/* Click shield: keeps focus here; a click is hit-tested in the deck
          (image → lightbox). Clicks never navigate. */}
      <div data-testid="present-shield" className="absolute inset-0" onClick={hitTest} />
      {zoom && (
        <div
          data-testid="present-zoom"
          role="img"
          aria-label={zoom.kind === 'img' ? zoom.alt || t('present.zoom') : t('present.zoom')}
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.92)', cursor: 'zoom-out' }}
          onClick={() => setZoom(null)}
        >
          {zoom.kind === 'img' ? (
            <img src={zoom.src} alt={zoom.alt} style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain' }} />
          ) : (
            <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(zoom.svg)}`} alt="" style={{ maxWidth: '96vw', maxHeight: '96vh', objectFit: 'contain' }} />
          )}
        </div>
      )}
      <div
        className="absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3 py-2 text-[12px] transition-opacity"
        style={{ background: 'rgba(0,0,0,.6)', color: '#ddd', opacity: chrome ? 1 : 0 }}
      >
        <SmallBtn onClick={() => go(current - 1)} disabled={current <= 1} aria-label={t('viewer.prev')} style={btn}>◂</SmallBtn>
        <span className="tabular-nums">{current} / {slideCount}</span>
        <SmallBtn onClick={() => go(current + 1)} disabled={current >= slideCount} aria-label={t('viewer.next')} style={btn}>▸</SmallBtn>
        <span className="ml-3 text-[11px]" style={{ color: '#999' }}>{t('present.keys')}</span>
        <span className="ml-auto flex gap-1">
          {!fullscreen && <SmallBtn onClick={enterFullscreen} style={btn}>{t('present.fullscreen')}</SmallBtn>}
          <SmallBtn onClick={close} style={btn}>{t('present.close')}</SmallBtn>
        </span>
      </div>
    </div>
  )
}
