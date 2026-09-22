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
 * The deck's own runtime handles slide navigation; we forward keys to it and,
 * for the built-in runtime, talk to it over postMessage (hs-go / hs-step).
 */
export function Presenter({ t, url, startSlide, slideCount, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [current, setCurrent] = useState(startSlide)
  const [fullscreen, setFullscreen] = useState(false)
  const [chrome, setChrome] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Leave fullscreen explicitly before unmounting: Electron does not always
  // fire fullscreenchange for Esc, and unmounting while fullscreen leaves the
  // window stuck until the user presses Esc again.
  const close = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
    } catch {
      /* ignore */
    }
    onClose()
  }, [onClose])

  const post = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  const go = useCallback(
    (index1: number) => {
      const n = Math.max(1, Math.min(slideCount || index1, index1))
      setCurrent(n)
      post({ type: 'hs-go', index: n - 1 })
      // External runtimes: also drive via the hash they usually listen to.
      try {
        const w = frameRef.current?.contentWindow
        if (w) w.location.hash = `#${n}`
      } catch {
        /* cross-origin: ignore */
      }
    },
    [post, slideCount],
  )

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch {
      /* not permitted: stay as an overlay */
    }
  }, [])

  // Enter fullscreen on mount; leaving fullscreen (Esc) closes the presenter.
  useEffect(() => {
    void toggleFullscreen()
    const onChange = () => {
      const fs = !!document.fullscreenElement
      setFullscreen(fs)
      if (!fs && wasFullscreen.current) onClose() // user left fullscreen (Esc/OS gesture)
      if (fs) wasFullscreen.current = true
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const wasFullscreen = useRef(false)

  // The built-in runtime reports its position; keep the control bar in sync
  // when the deck itself handled the key (iframe focused).
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string; index?: number } | null
      if (e.source !== frameRef.current?.contentWindow || !m) return
      if (m.type === 'hs-slide' && typeof m.index === 'number') setCurrent(m.index + 1)
      else if (m.type === 'hs-exit') void close()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [close])

  // Keyboard: handled here so it works even when the iframe has no focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void close()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(current - 1)
      } else if (e.key === 'Home') {
        go(1)
      } else if (e.key === 'End') {
        go(slideCount)
      } else if (e.key === 'f' || e.key === 'F') {
        void toggleFullscreen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, go, close, slideCount, toggleFullscreen])

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

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t('present.title')}
      onMouseMove={poke}
      className="fixed inset-0 flex flex-col"
      style={{ zIndex: 1000, background: '#000', cursor: chrome ? 'default' : 'none' }}
    >
      <iframe
        ref={frameRef}
        src={`${url}#${startSlide}`}
        title={t('present.title')}
        sandbox="allow-scripts allow-same-origin"
        className="flex-1 w-full h-full border-0"
        onLoad={() => frameRef.current?.focus()}
      />
      <div
        className="absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3 py-2 text-[12px] transition-opacity"
        style={{ background: 'rgba(0,0,0,.6)', color: '#ddd', opacity: chrome ? 1 : 0 }}
      >
        <SmallBtn onClick={() => go(current - 1)} disabled={current <= 1} aria-label={t('viewer.prev')} style={{ color: '#ddd', borderColor: '#555' }}>◂</SmallBtn>
        <span className="tabular-nums">{current} / {slideCount}</span>
        <SmallBtn onClick={() => go(current + 1)} disabled={current >= slideCount} aria-label={t('viewer.next')} style={{ color: '#ddd', borderColor: '#555' }}>▸</SmallBtn>
        <span className="ml-3 text-[11px]" style={{ color: '#999' }}>{t('present.keys')}</span>
        <span className="ml-auto flex gap-1">
          <SmallBtn onClick={() => void toggleFullscreen()} style={{ color: '#ddd', borderColor: '#555' }}>
            {fullscreen ? t('present.exit_fullscreen') : t('present.fullscreen')}
          </SmallBtn>
          <SmallBtn onClick={() => void close()} style={{ color: '#ddd', borderColor: '#555' }}>{t('present.close')}</SmallBtn>
        </span>
      </div>
    </div>
  )
}
