import { useCallback, useEffect, useRef, useState } from 'react'
import type { Client, PreviewInfo } from '../api'
import { SlideFrame } from './SlideFrame'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  client: Client
  deckPath: string
  preview: PreviewInfo
  /** Built output URL (null when the deck is not built: the audience window needs it). */
  outputUrl: string | null
  /** 0-based slide to start from. */
  start: number
  onClose: () => void
  /** Persist the slide position back to the studio when closing. */
  onPosition: (index: number) => void
}

type Presence = 'none' | 'connected'

/**
 * Presenter view (P3-6): what the speaker sees. Current slide (move the mouse
 * over it to point a laser in the audience window), next slide, speaker notes,
 * elapsed time and clock. The audience window is the built deck opened in the
 * system browser with ?hs=audience (inject/audience.js); both sides share the
 * preview server's origin, so a BroadcastChannel keyed by its port links them.
 *
 * The view itself is the presenter's screen: it never goes fullscreen on its
 * own (the audience window does, via the browser), and Esc closes it.
 */
export function PresenterView({ t, client, deckPath, preview, outputUrl, start, onClose, onPosition }: Props) {
  const total = preview.slides.length
  const [index, setIndex] = useState(Math.min(Math.max(0, start), Math.max(0, total - 1)))
  const [notes, setNotes] = useState('')
  const [presence, setPresence] = useState<Presence>('none')
  const [black, setBlack] = useState(false)
  const [laserOn, setLaserOn] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const stageRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef(index)
  indexRef.current = index

  // The studio and the audience window are different origins, so the current
  // slide iframe (same origin as the audience) relays for us: postMessage in,
  // BroadcastChannel out, and back (inject/relay.js).
  const relayRef = useRef<HTMLIFrameElement | null>(null)
  const relayReady = useRef(false)
  const queued = useRef<Record<string, unknown>[]>([])
  const send = useCallback((msg: Record<string, unknown>) => {
    const w = relayRef.current?.contentWindow
    const full = { from: 'presenter', ...msg }
    if (!w || !relayReady.current) {
      queued.current.push(full)
      return
    }
    w.postMessage({ type: 'hs-relay', msg: full }, '*')
  }, [])
  const blackRef = useRef(black)
  blackRef.current = black

  useEffect(() => {
    let seen: ReturnType<typeof setTimeout> | null = null
    const alive = () => {
      setPresence('connected')
      if (seen) clearTimeout(seen)
      seen = setTimeout(() => setPresence('none'), 6000)
    }
    const onMsg = (e: MessageEvent) => {
      if (e.source !== relayRef.current?.contentWindow) return
      const d = e.data as { type?: string; msg?: { from?: string; type?: string; index?: number } }
      if (!d) return
      if (d.type === 'hs-relay-ready') {
        relayReady.current = true
        const q = queued.current.splice(0)
        for (const m of q) relayRef.current?.contentWindow?.postMessage({ type: 'hs-relay', msg: m }, '*')
        send({ type: 'ping' })
        return
      }
      if (d.type !== 'hs-relay' || !d.msg || d.msg.from !== 'audience') return
      const m = d.msg
      if (m.type === 'hello' || m.type === 'pong') {
        alive()
        send({ type: 'goto', index: indexRef.current })
        send({ type: 'black', on: blackRef.current })
      } else if (m.type === 'slide' && typeof m.index === 'number') {
        alive()
        if (m.index !== indexRef.current) setIndex(Math.min(Math.max(0, m.index), total - 1))
      } else if (m.type === 'bye') setPresence('none')
    }
    window.addEventListener('message', onMsg)
    const ping = setInterval(() => send({ type: 'ping' }), 4000)
    return () => {
      window.removeEventListener('message', onMsg)
      clearInterval(ping)
      if (seen) clearTimeout(seen)
    }
  }, [send, total])
  // The relay frame reloads with every slide change: mark it not ready until it says so.
  useEffect(() => {
    relayReady.current = false
  }, [index])

  useEffect(() => {
    send({ type: 'goto', index })
  }, [index, send])
  useEffect(() => {
    send({ type: 'black', on: black })
  }, [black, send])
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    let alive = true
    const name = preview.slides[index]
    if (!name) return
    client
      .noteGet(deckPath, name)
      .then((n) => alive && setNotes(n.text))
      .catch(() => alive && setNotes(''))
    return () => {
      alive = false
    }
  }, [client, deckPath, preview.slides, index])
  useEffect(
    () => () => {
      // Best effort: the relay frame is going away with us.
      const w = relayRef.current?.contentWindow
      w?.postMessage({ type: 'hs-relay', msg: { from: 'presenter', type: 'laser', on: false } }, '*')
      w?.postMessage({ type: 'hs-relay', msg: { from: 'presenter', type: 'black', on: false } }, '*')
      onPosition(indexRef.current)
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const go = useCallback((n: number) => setIndex(Math.min(Math.max(0, n), total - 1)), [total])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tgt = e.target as HTMLElement | null
      if (tgt && ['INPUT', 'TEXTAREA'].includes(tgt.tagName)) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') go(indexRef.current + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') go(indexRef.current - 1)
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(total - 1)
      else if (e.key === 'b' || e.key === 'B') setBlack((v) => !v)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go, onClose, total])

  // Laser: pointer over the current slide maps to stage coordinates for the audience.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current?.querySelector('[data-testid="slide-stage"]') as HTMLElement | null
    if (!stage) return
    const r = stage.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * preview.stage.width
    const y = ((e.clientY - r.top) / r.height) * preview.stage.height
    const inside = x >= 0 && y >= 0 && x <= preview.stage.width && y <= preview.stage.height
    setLaserOn(inside)
    send({ type: 'laser', x: Math.round(x), y: Math.round(y), on: inside })
  }
  const onLeave = () => {
    setLaserOn(false)
    send({ type: 'laser', on: false })
  }
  const openAudience = async () => {
    try {
      await client.present(deckPath, index + 1, 'audience')
    } catch {
      /* the button state shows the result via presence */
    }
  }

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  const clock = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dark = { background: '#0b0b0d', color: '#e5e5e5' }
  const btn = { color: '#ddd', borderColor: '#555' }
  const nextName = preview.slides[index + 1]

  return (
    <div role="dialog" aria-label={t('presenter.title')} className="fixed inset-0 flex flex-col" style={{ zIndex: 1000, ...dark }} data-testid="presenter-view" data-slide={index + 1} data-audience={presence}>
      <div className="flex items-center gap-3 px-3 py-2 text-[12px] flex-none" style={{ borderBottom: '1px solid #222' }}>
        <span className="font-semibold text-[14px]">{t('presenter.title')}</span>
        <span className="tabular-nums" data-testid="presenter-timer">{mm}:{ss}</span>
        <span className="tabular-nums" style={{ color: '#999' }}>{clock}</span>
        <span className="ml-3 inline-flex items-center gap-1" data-testid="presenter-presence">
          <span aria-hidden className="inline-block rounded-full" style={{ width: 8, height: 8, background: presence === 'connected' ? '#22c55e' : '#666' }} />
          {presence === 'connected' ? t('presenter.audience_connected') : t('presenter.audience_none')}
        </span>
        <span className="ml-auto inline-flex gap-1 items-center">
          <SmallBtn onClick={() => void openAudience()} disabled={!outputUrl} title={outputUrl ? t('presenter.open_audience_hint') : t('present.need_output')} style={btn} data-testid="presenter-open-audience">
            {t('presenter.open_audience')} ↗
          </SmallBtn>
          <SmallBtn onClick={() => setBlack((v) => !v)} active={black} style={btn} title={t('presenter.black_hint')}>
            {t('presenter.black')}
          </SmallBtn>
          <SmallBtn onClick={onClose} style={btn}>{t('present.close')}</SmallBtn>
        </span>
      </div>
      <div className="flex-1 min-h-0 grid gap-3 p-3" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gridTemplateRows: 'minmax(0, 1fr) auto' }}>
        <div className="min-h-0 flex flex-col gap-1">
          <div className="text-[12px] flex items-center gap-2" style={{ color: '#999' }}>
            <span>{t('presenter.current', { n: index + 1, total })}</span>
            <span className="truncate">{preview.slides[index]}</span>
            {laserOn && <span style={{ color: '#f87171' }}>{t('presenter.laser_on')}</span>}
          </div>
          <div ref={stageRef} className="flex-1 min-h-0 relative" onMouseMove={onMove} onMouseLeave={onLeave} style={{ cursor: 'crosshair' }} data-testid="presenter-current">
            <SlideFrame
              src={`${preview.baseUrl}/slide/${index}?hs=relay`}
              stageWidth={preview.stage.width}
              stageHeight={preview.stage.height}
              title={preview.slides[index]}
              fit="contain"
              className="rounded-md"
              interactive
              frameRef={(el) => {
                relayRef.current = el
              }}
            />
            {/* the frame only relays; keep the pointer on this layer for the laser */}
            <div className="absolute inset-0" />
          </div>
        </div>
        <div className="min-h-0 flex flex-col gap-1">
          <div className="text-[12px]" style={{ color: '#999' }}>{nextName ? t('presenter.next', { n: index + 2 }) : t('presenter.last')}</div>
          <div className="relative" style={{ flex: '0 0 auto', height: '38%' }}>
            {nextName && <SlideFrame src={`${preview.baseUrl}/slide/${index + 1}`} stageWidth={preview.stage.width} stageHeight={preview.stage.height} title={nextName} fit="contain" className="rounded-md" />}
          </div>
          <div className="text-[12px] mt-2" style={{ color: '#999' }}>{t('presenter.notes')}</div>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-md p-3 text-[16px] whitespace-pre-wrap" style={{ background: '#151518', lineHeight: 1.55 }} data-testid="presenter-notes">
            {notes.trim() ? notes : <span style={{ color: '#666' }}>{t('presenter.no_notes')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px]" style={{ gridColumn: '1 / -1', color: '#999' }}>
          <SmallBtn onClick={() => go(index - 1)} disabled={index <= 0} aria-label={t('viewer.prev')} style={btn}>◂</SmallBtn>
          <span className="tabular-nums" style={{ color: '#ddd' }}>{index + 1} / {total}</span>
          <SmallBtn onClick={() => go(index + 1)} disabled={index >= total - 1} aria-label={t('viewer.next')} style={btn}>▸</SmallBtn>
          <span className="ml-3">{t('presenter.keys')}</span>
        </div>
      </div>
    </div>
  )
}
