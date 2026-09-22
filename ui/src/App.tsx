import { useAppApi } from '@kirocrew/app-sdk'
import { Card, CardTitle, PageHeader } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, type BackendStatus, type Deck, type PreviewInfo, makeClient } from './api'
import { DeckPanel } from './components/DeckPanel'
import { Section, useCollapsed } from './components/Section'
import { SlideStrip } from './components/SlideStrip'
import { SlideViewer } from './components/SlideViewer'
import { SmallBtn } from './components/SmallBtn'
import { Spinner } from './components/Spinner'
import { LOCALES, type LocalePref, useI18n } from './i18n'

type Conn = 'connecting' | 'connected' | 'error'

// NOTE on styling: the dashboard ships a precompiled Tailwind sheet, so only
// utility classes the host itself uses are available (e.g. text-muted,
// border-border, bg-card, bg-ok/bg-warn/bg-danger, text-text). Anything else
// must be expressed with inline styles or the host's CSS variables
// (--accent, --muted, --border, --ok, --warn, --danger, --text, --card, --bg).

export default function HtmlStudio() {
  const api = useAppApi()
  const client = useMemo(() => makeClient(api), [api])
  const { t, locale, pref, setPref } = useI18n()

  const [conn, setConn] = useState<Conn>('connecting')
  const [status, setStatus] = useState<BackendStatus | null>(null)
  const [roots, setRoots] = useState<string[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useCollapsed('sidebar', true)
  // null = leave the section's own persisted state alone
  const [decksForce, setDecksForce] = useState<boolean | null>(null)
  const [slidesForce, setSlidesForce] = useState<boolean | null>(null)

  const selected = decks.find((d) => d.id === selectedId) ?? null

  const [preview, setPreview] = useState<PreviewInfo | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)

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

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await client.decks()
      setRoots(res.roots)
      setDecks(res.decks)
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    let alive = true
    client
      .status()
      .then((res) => {
        if (!alive) return
        setStatus(res)
        setConn('connected')
        void refresh()
      })
      .catch(() => alive && setConn('error'))
    return () => {
      alive = false
    }
  }, [client, refresh])

  const addRoot = useCallback(
    async (path?: string) => {
      setError(null)
      setLoading(true)
      try {
        const res = await client.addRoot(path)
        if (res.cancelled) return
        setRoots(res.roots)
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed')
        return
      } finally {
        setLoading(false)
      }
      await refresh()
    },
    [client, refresh],
  )

  const removeRoot = useCallback(
    async (path: string) => {
      setError(null)
      setLoading(true)
      try {
        const res = await client.removeRoot(path)
        setRoots(res.roots)
        setDecks((prev) => prev.filter((d) => d.root !== path))
        if (selected && selected.root === path) setSelectedId(null)
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed')
        return
      } finally {
        setLoading(false)
      }
      await refresh()
    },
    [client, refresh, selected],
  )

  const selectDeck = (deck: Deck) => {
    setSelectedId(deck.id)
    // Selecting a deck hands the sidebar over to its slides.
    setDecksForce(false)
    setSlidesForce(true)
    // Release the override so the user can toggle freely afterwards.
    setTimeout(() => {
      setDecksForce(null)
      setSlidesForce(null)
    }, 0)
  }

  const statusText =
    conn === 'connecting' ? t('status.connecting') : conn === 'connected' ? t('status.connected') : t('status.error')

  const gridCols = sidebarOpen
    ? 'minmax(200px, 1fr) minmax(320px, 3fr) minmax(220px, 1.4fr)'
    : '36px minmax(320px, 3fr) minmax(220px, 1.4fr)'

  // The host may or may not give this page a bounded height. Measure the header
  // block ourselves and size the grid from the viewport so every pane has a real
  // height limit and scrolls internally instead of growing the page.
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

  return (
    <div className="flex flex-col min-h-0" lang={locale}>
      <div ref={headRef}>
      <PageHeader title={t('app.title')} subtitle={t('app.subtitle')} />

      {/* Status bar + language switch */}
      <div className="px-6 pb-3 flex items-center gap-3 text-[12px] flex-wrap">
        <span className="inline-flex items-center gap-2 text-muted" role="status" aria-live="polite">
          <StatusDot conn={conn} />
          {statusText}
          {status ? ` · ${t('footer.version')} ${status.version}` : ''}
        </span>
        <div className="ml-auto inline-flex items-center gap-1" role="group" aria-label={t('lang.label')}>
          <span className="text-muted mr-1">{t('lang.label')}</span>
          {(['auto', ...LOCALES] as LocalePref[]).map((p) => (
            <SmallBtn key={p} active={pref === p} aria-pressed={pref === p} onClick={() => setPref(p)}>
              {p === 'auto' ? t('lang.auto') : p.toUpperCase()}
            </SmallBtn>
          ))}
        </div>
      </div>
      </div>

      {/* Layout: sidebar | preview | chat. Stacks below 1100px. */}
      <div
        className="hs-grid px-6 pb-6 grid gap-3"
        style={{
          gridTemplateColumns: gridCols,
          gridAutoRows: 'minmax(0, 1fr)',
          height: headH ? `calc(100dvh - ${Math.round(headH)}px)` : undefined,
          minHeight: 320,
        }}
      >
        <style>{`
          @media (max-width: 1100px) { .hs-grid { grid-template-columns: 1fr !important; grid-auto-rows: auto !important; height: auto !important; } }
          /* The host Card is a plain block with unknown inner wrappers. Turn the whole
             chain from the grid cell down to the section body into min-height:0 flex
             columns, so the body is the ONE element that scrolls. */
          .hs-grid > div { min-height: 0; display: flex; flex-direction: column; }
          .hs-grid > div > *, .hs-grid > div > * > * { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
          .hs-grid .hs-fill { flex: 1 1 auto; min-height: 0; }
          .hs-grid .hs-scroll { overflow-y: auto !important; }
          .hs-grid section[data-grow="true"] { flex: 1 1 auto; min-height: 0; }
          .hs-grid section[data-grow="true"] > [id$="-body"] { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
        `}</style>

        {/* Sidebar */}
        {sidebarOpen ? (
          <div className="min-h-0 flex flex-col">
            <Card>
            <div className="flex flex-col min-h-0 hs-fill">
              <div className="flex items-center justify-end -mt-1 -mr-1 flex-none">
                <SmallBtn onClick={() => setSidebarOpen(false)} aria-label={t('sidebar.collapse')} title={t('sidebar.collapse')}>
                  ◂
                </SmallBtn>
              </div>
              <Section
                id="decks"
                title={t('panel.decks')}
                badge={decks.length ? `(${decks.length})` : undefined}
                forceOpen={decksForce}
                grow={!selected}
              >
                <DeckPanel
                  t={t}
                  locale={locale}
                  roots={roots}
                  decks={decks}
                  selectedId={selectedId}
                  loading={loading}
                  error={error}
                  pickerSupported={status?.pickerSupported ?? false}
                  onSelect={selectDeck}
                  onAddRoot={addRoot}
                  onRemoveRoot={removeRoot}
                  onRefresh={refresh}
                />
              </Section>
              <div className="my-2 border-t border-border flex-none" />
              <Section
                id="slides"
                title={t('panel.slides')}
                badge={selected ? `(${selected.slideCount})` : undefined}
                defaultOpen={false}
                forceOpen={slidesForce}
                grow
              >
              {selected ? (
                preview ? (
                  preview.slides.length ? (
                    <SlideStrip preview={preview} current={current} onSelect={setCurrent} />
                  ) : (
                    <p className="m-0 text-[12px] text-muted">{t('deck.summary.no_slides')}</p>
                  )
                ) : previewError ? (
                  <p className="m-0 text-[12px]" style={{ color: 'var(--danger)' }}>
                    {t('error.generic', { code: previewError })}
                  </p>
                ) : (
                  <p className="m-0 text-[12px] text-muted inline-flex items-center gap-2">
                    <Spinner /> {t('viewer.loading')}
                  </p>
                )
              ) : (
                <p className="m-0 text-[12px] text-muted">{t('panel.slides.empty')}</p>
              )}
            </Section>
            </div>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center pt-2">
            <SmallBtn onClick={() => setSidebarOpen(true)} aria-label={t('sidebar.expand')} title={t('sidebar.expand')}>
              ▸
            </SmallBtn>
          </div>
        )}

        {/* Preview */}
        <div className="min-h-0 flex flex-col">
        <Card>
          <div className="hs-fill hs-scroll min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap flex-none">
            <CardTitle>{selected ? selected.name : t('panel.preview')}</CardTitle>
            <div className="flex gap-1 flex-wrap">
              {(['toolbar.build', 'toolbar.check', 'toolbar.present', 'toolbar.pdf'] as const).map((k) => (
                <SmallBtn key={k} disabled>
                  {t(k)}
                </SmallBtn>
              ))}
            </div>
          </div>
          {selected && preview ? (
            <SlideViewer t={t} preview={preview} current={current} onChange={setCurrent} />
          ) : (
            <div
              className="w-full rounded-md border border-border flex items-center justify-center"
              style={{ aspectRatio: '16 / 9', borderStyle: 'dashed', minHeight: 160 }}
            >
              {selected ? (
                previewError ? (
                  <p className="text-sm text-center px-4" style={{ color: 'var(--danger)' }}>
                    {t('error.generic', { code: previewError })}
                  </p>
                ) : (
                  <p className="text-sm text-muted inline-flex items-center gap-2">
                    <Spinner /> {t('viewer.loading')}
                  </p>
                )
              ) : (
                <p className="text-sm text-muted text-center px-4">{t('panel.preview.empty')}</p>
              )}
            </div>
          )}
          </div>
        </Card>
        </div>

        {/* Chat */}
        <div className="min-h-0 flex flex-col">
        <Card>
          <CardTitle>{t('panel.chat')}</CardTitle>
          <p className="text-sm text-muted">{t('panel.chat.empty')}</p>
        </Card>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ conn }: { conn: Conn }) {
  const cls = conn === 'connected' ? 'bg-ok' : conn === 'error' ? 'bg-danger' : 'bg-warn'
  const fallback = conn === 'connected' ? '#22c55e' : conn === 'error' ? '#ef4444' : '#eab308'
  return (
    <span
      aria-hidden
      className={`inline-block w-2 h-2 rounded-full ${cls}`}
      style={{ backgroundColor: `var(--${cls.slice(3)}, ${fallback})` }}
    />
  )
}
