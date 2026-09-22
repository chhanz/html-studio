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

/**
 * Presentation mode inside the dashboard: a full-viewport overlay hosting the
 * built deck in an iframe, taken to real fullscreen with the Fullscreen API.
 *
 * Design notes (learned the hard way in the Electron shell):
 *  - Presenting IS fullscreen. Leaving fullscreen by any route ends the
 *    presentation, and ending the presentation leaves fullscreen.
 *  - Keyboard never depends on where focus is: a transparent shield sits over
 *    the iframe so keys arrive here (capture phase) whatever runtime the deck
 *    uses. Click on the shield = next slide, like a clicker.
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closed = useRef(false)
  const wasFullscreen = useRef(false)

  const close = useCallback(() => {
    if (closed.current) return
    closed.current = true
    onClose()
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
  }, [onClose])

  const enterFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el || document.fullscreenElement) return
    el.requestFullscreen().catch(() => undefined) // refused: stay as an overlay; F / button retry
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
      // differs in the fragment is a fragment navigation, not a reload.
      const f = frameRef.current
      if (f) f.src = `${url}#${n}`
    },
    [post, slideCount, url],
  )

  // F: enter fullscreen if we are not, otherwise end the presentation.
  const toggle = useCallback(() => {
    if (document.fullscreenElement) close()
    else enterFullscreen()
  }, [close, enterFullscreen])

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
    // Watchdog: the window left fullscreen without telling the document.
    const tick = setInterval(() => {
      if (!wasFullscreen.current || closed.current) return
      const windowIsFullscreen = window.innerHeight >= screen.height - 40 && window.innerWidth >= screen.width - 40
      if (!document.fullscreenElement || !windowIsFullscreen) close()
    }, 400)
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
      const m = e.data as { type?: string; index?: number } | null
      if (e.source !== frameRef.current?.contentWindow || !m) return
      if (m.type === 'hs-slide' && typeof m.index === 'number') setCurrent(m.index + 1)
      else if (m.type === 'hs-exit') close()
      else if (m.type === 'hs-fullscreen') toggle()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [close, toggle])

  // Keyboard, capture phase: fires before any host handler and regardless of focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') go(current + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') go(current - 1)
      else if (e.key === 'Home') go(1)
      else if (e.key === 'End') go(slideCount)
      else if (e.key === 'f' || e.key === 'F') toggle()
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [current, go, close, slideCount, toggle])

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
        src={`${url}#${startSlide}`}
        title={t('present.title')}
        sandbox="allow-scripts allow-same-origin"
        tabIndex={-1}
        className="flex-1 w-full h-full border-0"
      />
      {/* Click shield: keeps focus here and turns a click into "next". */}
      <div
        data-testid="present-shield"
        className="absolute inset-0"
        onClick={() => go(current + 1)}
        onContextMenu={(e) => {
          e.preventDefault()
          go(current - 1)
        }}
      />
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
