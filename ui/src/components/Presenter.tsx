import { useCallback, useEffect, useRef, useState } from 'react'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  /** Built output URL (served by the deck's preview server). */
  url: string
  /** Preview server base (the shared presenter state lives there). */
  baseUrl: string
  /** 1-based slide to start from. */
  startSlide: number
  slideCount: number
  onClose: () => void
  /** Open the presenter window (system browser) at a 1-based slide. */
  openPresenter?: (slide: number) => Promise<void>
  /** Called when the show ends with the slide it ended on (1-based). */
  onPosition?: (slide: number) => void
  /**
   * `overlay` (default): inside the dashboard window, where presenting IS
   * fullscreen and leaving fullscreen ends the show.
   * `window`: the component IS the page of its own pop-out window. Fullscreen is
   * a button (a fresh window has no user activation to request it on load),
   * Esc only leaves fullscreen, and closing the window ends the show.
   */
  mode?: 'overlay' | 'window'
}

type Stroke = { id: string; pts: [number, number][] }
type InkOp = { op: 'reset' } | { op: 'clear'; slide: number } | { op: 'start' | 'add'; slide: number; id: string; pts: [number, number][] }
type PresentStateWire = {
  seq: number
  index: number
  black: boolean
  presenter: boolean
  audience: boolean
  ink?: Record<string, Stroke[]> // the whole drawing (first event, GET)
  ink_ops?: InkOp[] // deltas since the previous event
}

const STAGE_W = 1280
const STAGE_H = 720

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
 *  - In `window` mode (the show in its own pop-out window) none of the
 *    fullscreen coupling applies: that window is a plain BrowserWindow where
 *    the Fullscreen API behaves normally, so fullscreen is just a button, Esc
 *    leaves it, and the window's own close ends the show.
 */
export function Presenter({ t, url, baseUrl, startSlide, slideCount, onClose, openPresenter, onPosition, mode = 'overlay' }: Props) {
  const inWindow = mode === 'window'
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [current, setCurrent] = useState(startSlide)
  const currentRef = useRef(current)
  currentRef.current = current
  // Presenter window sync (P3-6): the presenter window is a system-browser page
  // on the preview server; this fullscreen show is the audience screen. Both
  // meet at the server's /present/state (another browser process cannot be
  // reached any other way from the dashboard).
  const stateUrl = `${baseUrl}/present/state`
  const seqRef = useRef(-1)
  const [black, setBlack] = useState(false)
  const blackRef = useRef(black)
  blackRef.current = black
  const [presenterOn, setPresenterOn] = useState(false)
  // Pen strokes drawn in the presenter window, per slide (index -> strokes), in
  // 1280x720 stage coordinates; mapped onto the letterboxed deck here.
  const inkRef = useRef<Record<string, Stroke[]>>({})
  const inkCanvas = useRef<HTMLCanvasElement>(null)
  const stageBoxRef = useRef<HTMLDivElement>(null)
  const redrawInk = useCallback(() => {
    const c = inkCanvas.current
    const box = stageBoxRef.current
    if (!c || !box) return
    const r = box.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    // The deck runtime contain-fits the 1280x720 stage in the viewport, centred.
    const sc = Math.min(r.width / STAGE_W, r.height / STAGE_H)
    ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ((r.width - STAGE_W * sc) / 2) * dpr, ((r.height - STAGE_H * sc) / 2) * dpr)
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const st of inkRef.current[String(currentRef.current - 1)] || []) {
      if (!st.pts.length) continue
      ctx.beginPath()
      ctx.moveTo(st.pts[0][0], st.pts[0][1])
      if (st.pts.length === 1) ctx.lineTo(st.pts[0][0] + 0.1, st.pts[0][1])
      for (let i = 1; i < st.pts.length; i++) ctx.lineTo(st.pts[i][0], st.pts[i][1])
      ctx.stroke()
    }
    c.dataset.strokes = String((inkRef.current[String(currentRef.current - 1)] || []).length)
  }, [])
  const applyInkOp = useCallback((op: InkOp) => {
    const ink = inkRef.current
    if (op.op === 'reset') {
      inkRef.current = {}
      return
    }
    const key = String(op.slide)
    if (op.op === 'clear') {
      delete ink[key]
      return
    }
    const list = ink[key] || (ink[key] = [])
    if (op.op === 'start') list.push({ id: op.id, pts: op.pts.slice() })
    else {
      const st = list.find((x) => x.id === op.id)
      if (st) st.pts.push(...op.pts)
    }
  }, [])
  const inflight = useRef(0) // polls are skipped while our own writes are in flight
  const post = useCallback(
    (body: Record<string, unknown>) => {
      inflight.current += 1
      void fetch(stateUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'audience', ...body }) })
        .then((r) => r.json())
        .then((st: PresentStateWire) => {
          seqRef.current = st.seq
        })
        .catch(() => undefined)
        .finally(() => {
          inflight.current -= 1
        })
    },
    [stateUrl],
  )
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

  const postFrame = useCallback((msg: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  const go = useCallback(
    (index1: number) => {
      const n = Math.max(1, Math.min(slideCount || index1, index1))
      setCurrent(n)
      post({ index: n - 1 })
      postFrame({ type: 'hs-go', index: n - 1 })
      // External runtimes usually follow the hash; a src change that only
      // differs in the fragment is a fragment navigation, not a reload — so it
      // must be the same presenter URL (with the helper query) as the initial load.
      const f = frameRef.current
      if (f) f.src = `${frameUrl}#${n}`
    },
    [post, postFrame, slideCount, frameUrl],
  )

  // The pen is per slide: redraw whenever the slide shown changes.
  useEffect(() => {
    redrawInk()
  }, [current, redrawInk])

  // F: none. Esc is the single exit (fullscreen and presentation are one thing).

  // Ask the deck what is under the pointer; it answers hs-zoom or hs-miss.
  const hitTest = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const f = frameRef.current
    if (!f) return
    const r = f.getBoundingClientRect()
    postFrame({ type: 'hs-hit', x: e.clientX - r.left, y: e.clientY - r.top })
  }, [postFrame])

  // Presenter window + state sync.
  useEffect(() => {
    let alive = true
    let ready = false
    // Seed the shared state with OUR slide first (awaited), so the first poll
    // does not drag us to whatever the server remembered from a previous show.
    // A new show starts with a clean sheet: the pen is for this presentation only.
    void fetch(stateUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'audience', index: startSlide - 1, black: false, ink: { op: 'reset' } }) })
      .then((r) => r.json())
      .then((st: PresentStateWire) => {
        seqRef.current = st.seq
      })
      .catch(() => undefined)
      .finally(() => {
        ready = true
      })
    void openPresenter?.(startSlide)
    const apply = (st: PresentStateWire) => {
        if (!alive) return
        setPresenterOn(st.presenter)
        // Ink is applied even for states we have "seen": the drawing rides on
        // the same sequence as our own index/black writes.
        if (st.ink) {
          inkRef.current = st.ink
          redrawInk()
        } else if (st.ink_ops?.length) {
          st.ink_ops.forEach(applyInkOp)
          redrawInk()
        }
        if (st.seq === seqRef.current) return
        seqRef.current = st.seq
        // Apply by value, not by sequence: a write of ours may have landed between
        // this GET and the state it reports, so only differences from what we
        // hold locally are taken (the presenter window does the same).
        if (typeof st.index === 'number' && st.index + 1 !== currentRef.current) {
          const n = st.index + 1
          setCurrent(n)
          postFrame({ type: 'hs-go', index: st.index })
          const f = frameRef.current
          if (f) f.src = `${frameUrl}#${n}`
        }
        if (typeof st.black === 'boolean' && st.black !== blackRef.current) setBlack(st.black)
    }
    // Push first: the server streams every change (pen points included) as
    // Server-Sent Events. Polling stays as a slow fallback for presence and in
    // case the stream drops.
    let es: EventSource | null = null
    try {
      es = new EventSource(`${baseUrl}/present/events`)
      es.onmessage = (e) => {
        if (!ready || inflight.current > 0) return
        try {
          apply(JSON.parse(e.data) as PresentStateWire)
        } catch {
          /* ignore malformed */
        }
      }
    } catch {
      es = null
    }
    const tick = async () => {
      if (!ready || inflight.current > 0) return
      try {
        apply((await (await fetch(stateUrl)).json()) as PresentStateWire)
      } catch {
        /* preview restarting: keep trying */
      }
    }
    void tick()
    const id = setInterval(tick, es ? 1000 : 100)
    window.addEventListener('resize', redrawInk)
    // The show is over: the pen goes with it (the presenter window clears too).
    // In its own window the close never unmounts React, so pagehide carries it.
    let ended = false
    const endShow = () => {
      if (ended) return
      ended = true
      void fetch(stateUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'audience', ink: { op: 'reset' } }), keepalive: true }).catch(() => undefined)
    }
    if (inWindow) window.addEventListener('pagehide', endShow)
    return () => {
      alive = false
      clearInterval(id)
      es?.close()
      window.removeEventListener('resize', redrawInk)
      window.removeEventListener('pagehide', endShow)
      endShow()
      onPosition?.(currentRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    rootRef.current?.focus()
    if (inWindow) {
      // Own window: fullscreen is the user's call (button); its exit means nothing.
      const onChange = () => setFullscreen(!!document.fullscreenElement)
      document.addEventListener('fullscreenchange', onChange)
      return () => document.removeEventListener('fullscreenchange', onChange)
    }
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
        else if (inWindow) {
          // Esc leaves fullscreen only; the window stays until it is closed.
          if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
          return
        } else close()
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
  }, [current, go, close, slideCount, inWindow])

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
      <div ref={stageBoxRef} className="flex-1 w-full h-full relative min-h-0">
        <iframe
          ref={frameRef}
          src={`${frameUrl}#${startSlide}`}
          title={t('present.title')}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          className="absolute inset-0 w-full h-full border-0"
        />
        {/* Pen strokes drawn in the presenter window, mirrored onto the deck. */}
        <canvas ref={inkCanvas} data-testid="present-ink" aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }} />
        {black && <div data-testid="present-black" className="absolute inset-0" style={{ background: '#000', zIndex: 6 }} />}
      </div>
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
      {inWindow && !fullscreen && (
        <div
          data-testid="present-window-hint"
          className="absolute left-0 right-0 top-0 px-3 py-2 text-[12px] text-center"
          style={{ background: 'rgba(0,0,0,.6)', color: '#ddd', zIndex: 10, pointerEvents: 'none' }}
        >
          {t('present.window_hint')}
        </div>
      )}
      <div
        className="absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3 py-2 text-[12px] transition-opacity"
        style={{ background: 'rgba(0,0,0,.6)', color: '#ddd', opacity: chrome || (inWindow && !fullscreen) ? 1 : 0, zIndex: 10 }}
      >
        <SmallBtn onClick={() => go(current - 1)} disabled={current <= 1} aria-label={t('viewer.prev')} style={btn}>◂</SmallBtn>
        <span className="tabular-nums">{current} / {slideCount}</span>
        <SmallBtn onClick={() => go(current + 1)} disabled={current >= slideCount} aria-label={t('viewer.next')} style={btn}>▸</SmallBtn>
        <span className="ml-3 text-[11px]" style={{ color: '#999' }}>{inWindow ? t('present.keys_window') : t('present.keys')}</span>
        <span className="ml-3 inline-flex items-center gap-1 text-[11px]" data-testid="present-presenter" data-on={presenterOn ? 'true' : 'false'} style={{ color: presenterOn ? '#4ade80' : '#999' }}>
          <span aria-hidden className="inline-block rounded-full" style={{ width: 7, height: 7, background: presenterOn ? '#22c55e' : '#666' }} />
          {presenterOn ? t('present.presenter_on') : t('present.presenter_off')}
        </span>
        <span className="ml-auto flex gap-1">
          {openPresenter && (
            <SmallBtn onClick={() => void openPresenter(current)} style={btn} title={t('present.presenter_hint')}>
              {t('present.presenter_window')} ↗
            </SmallBtn>
          )}
          <SmallBtn
            onClick={() => {
              setBlack((v) => {
                post({ black: !v })
                return !v
              })
            }}
            active={black}
            aria-pressed={black}
            style={btn}
          >
            {t('presenter.black')}
          </SmallBtn>
          {!fullscreen && <SmallBtn onClick={enterFullscreen} style={btn}>{t('present.fullscreen')}</SmallBtn>}
          <SmallBtn onClick={close} style={btn}>{t('present.close')}</SmallBtn>
        </span>
      </div>
    </div>
  )
}
