import { useAppApi, useNavigate } from '@kirocrew/app-sdk'
import { Card, CardTitle, PageHeader } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, type BackendStatus, type BuildInfo, type BuildResult, type Deck, type PdfJob, type PreviewInfo, makeClient } from './api'
import { openDeckChat } from './chat'
import { BuildPanel } from './components/BuildPanel'
import { DeckPanel } from './components/DeckPanel'
import { Presenter } from './components/Presenter'
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
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
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

  // --- build state
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [viewMode, setViewMode] = useState<'slides' | 'output'>('slides')

  useEffect(() => {
    setBuildResult(null)
    setPendingCommand(null)
    setViewMode('slides')
    if (!selected) {
      setBuildInfo(null)
      return
    }
    let alive = true
    client
      .buildInfo(selected.path)
      .then((i) => alive && setBuildInfo(i))
      .catch((e) => {
        console.warn('[html-studio] build/info failed', e)
        alive && setBuildInfo(null)
      })
    return () => {
      alive = false
    }
  }, [client, selected?.path]) // eslint-disable-line react-hooks/exhaustive-deps

  const runBuild = useCallback(
    async (trust = false) => {
      if (!selected) return
      setBuilding(true)
      setPendingCommand(null)
      try {
        const res = await client.build(selected.path, trust)
        if (res.needsTrust && res.command) {
          setPendingCommand(res.command)
          return
        }
        setBuildResult(res)
        setReloadKey((k) => k + 1)
        const info = await client.buildInfo(selected.path)
        setBuildInfo(info)
        if (res.ok && res.output) setViewMode('output')
      } catch (e) {
        setBuildResult({ ok: false, mode: 'external', stderr: e instanceof ApiError ? e.code : 'request_failed' })
      } finally {
        setBuilding(false)
      }
    },
    [client, selected],
  )

  const openIssue = (file: string) => {
    if (!preview) return
    const idx = preview.slides.indexOf(file)
    if (idx >= 0) {
      setViewMode('slides')
      setCurrent(idx)
    }
  }

  const outputUrl = preview && buildInfo?.outputExists ? `${preview.baseUrl}/${buildInfo.output}` : null

  // --- present / pdf
  const [pdf, setPdf] = useState<PdfJob | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // P1-7: one chat session per deck, project-scoped to the deck folder.
  const navigate = useNavigate()
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const openChat = useCallback(async () => {
    if (!selected || chatBusy) return
    setChatBusy(true)
    setChatError(null)
    try {
      const { key } = await openDeckChat(
        api,
        { deck: selected, preview, build: buildInfo, language: locale },
        t('chat.title', { name: selected.name }),
      )
      navigate(`/chat?sid=${encodeURIComponent(key)}`)
    } catch (e) {
      // Dashboard routes are not wrapped by our client: surface the SDK's message.
      setChatError(e instanceof Error ? e.message : 'chat_failed')
    } finally {
      setChatBusy(false)
    }
  }, [api, selected, preview, buildInfo, locale, t, navigate, chatBusy])
  useEffect(() => {
    setPdf(null)
    setPdfError(null)
  }, [selected?.path])

  const [presenting, setPresenting] = useState(false)
  const present = useCallback(() => {
    if (!selected || !outputUrl) return
    setPresenting(true)
  }, [selected, outputUrl])
  const presentInBrowser = useCallback(() => {
    if (!selected) return
    void client.present(selected.path, current + 1).catch((e) => setPdfError(e instanceof ApiError ? e.code : 'request_failed'))
  }, [client, selected, current])

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

  const canBuild = !!selected && !!preview && preview.slides.length > 0 && !building && (buildInfo?.buildable ?? false)
  const buildHint = !selected
    ? ''
    : !buildInfo
      ? t('build.hint.loading')
      : !buildInfo.buildable
        ? t('build.hint.single_file')
        : buildInfo.builtin
          ? t('build.mode.builtin')
          : buildInfo.command ?? '' 

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

  // Connect to the backend. Right after the app is (re)enabled the backend is
  // still starting, so the first /status can fail: keep retrying until it
  // answers, and only then load the deck list. Nothing renders half-loaded.
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    const connect = async () => {
      if (!alive) return
      try {
        const res = await client.status()
        if (!alive) return
        setStatus(res)
        setConn('connected')
        await refresh()
      } catch {
        if (!alive) return
        setConn(attempt === 0 ? 'connecting' : 'error')
        attempt += 1
        timer = setTimeout(connect, Math.min(1000 * attempt, 5000))
      }
    }
    void connect()
    const onFocus = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
        void connect()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [client, refresh])

  const addRoot = useCallback(
    async (path?: string) => {
      setError(null)
      setErrorDetail(null)
      setLoading(true)
      try {
        if (path) {
          const res = await client.addRoot(path)
          setRoots(res.roots)
        } else {
          // The OS dialog may stay open far longer than the gateway proxy allows
          // a single request to take, so start it and poll for the outcome.
          const start = await client.pickStart()
          let st = start
          while (st.state === 'pending') {
            await new Promise((r) => setTimeout(r, 700))
            st = await client.pickStatus(start.id)
          }
          if (st.state === 'cancelled') return
          if (st.state === 'error') throw new ApiError(st.error ?? 'folder_chooser_failed', st.detail)
          setRoots(st.roots ?? [])
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed')
        setErrorDetail(e instanceof ApiError ? e.message : String(e))
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
          {` · ui ${__HS_BUILD__}`}
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
                  errorDetail={errorDetail}
                  pickerSupported={status?.pickerSupported ?? /Mac/i.test(navigator.platform)}
                  connected={conn === 'connected'}
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
                    <SlideStrip preview={preview} current={current} onSelect={setCurrent} reloadKey={reloadKey} />
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
            <div className="flex gap-1 flex-wrap items-center">
              {outputUrl && (
                <div className="inline-flex rounded-md border border-border overflow-hidden mr-2" role="group" aria-label={t('view.label')}>
                  {(['slides', 'output'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setViewMode(m)}
                      aria-pressed={viewMode === m}
                      className="px-2 py-0.5 text-[12px] cursor-pointer border-0"
                      style={{
                        background: viewMode === m ? 'var(--bg-hover)' : 'transparent',
                        color: viewMode === m ? 'var(--accent)' : 'var(--muted)',
                        fontWeight: viewMode === m ? 600 : 400,
                      }}
                    >
                      {t(`view.${m}`)}
                    </button>
                  ))}
                </div>
              )}
              <SmallBtn
                active
                onClick={() => runBuild(false)}
                disabled={!canBuild}
                className="inline-flex items-center gap-1.5"
                title={buildHint}
              >
                {building && <Spinner />}
                {t('toolbar.build')}
              </SmallBtn>
              <SmallBtn disabled>{t('toolbar.check')}</SmallBtn>
              <SmallBtn onClick={present} disabled={!outputUrl} title={outputUrl ? t('present.hint') : t('present.need_output')}>
                {t('toolbar.present')}
              </SmallBtn>
              <SmallBtn onClick={presentInBrowser} disabled={!outputUrl} title={t('present.browser_hint')} aria-label={t('present.browser')}>
                ↗
              </SmallBtn>
              <SmallBtn
                onClick={() => void exportPdf()}
                disabled={!preview || pdf?.state === 'running'}
                title={t('pdf.hint')}
                className="inline-flex items-center gap-1.5"
              >
                {pdf?.state === 'running' && <Spinner />}
                {t('toolbar.pdf')}
              </SmallBtn>
              <SmallBtn
                onClick={() => void openChat()}
                disabled={!selected || chatBusy}
                title={t('chat.hint')}
                className="inline-flex items-center gap-1.5"
              >
                {chatBusy && <Spinner />}
                {t('toolbar.chat')}
              </SmallBtn>
            </div>
          </div>
          {selected && chatError && (
            <div className="mb-2 flex-none rounded-md border p-2 text-[12px]" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} role="alert">
              {t('chat.failed')}
              <span className="block text-muted break-all">{chatError}</span>
            </div>
          )}
          {selected && (pdf?.state === 'done' || pdfError) && (
            <div
              className="mb-2 flex-none rounded-md border p-2 text-[12px] flex items-center gap-2 flex-wrap"
              style={{ borderColor: pdfError ? 'var(--danger)' : 'var(--ok)' }}
              role="status"
            >
              {pdfError ? (
                <span style={{ color: 'var(--danger)' }}>
                  {t(`error.${pdfError}`) === `error.${pdfError}` ? t('error.generic', { code: pdfError }) : t(`error.${pdfError}`)}
                  {pdf?.detail ? <span className="block text-muted break-all">{pdf.detail}</span> : null}
                </span>
              ) : (
                <>
                  <span style={{ color: 'var(--ok)' }}>{t('pdf.done', { kb: Math.round((pdf?.bytes ?? 0) / 1024) })}</span>
                  <span className="text-muted break-all">{pdf?.output}</span>
                  <SmallBtn onClick={() => pdf?.output && selected && void client.reveal(selected.path, pdf.output.slice(selected.path.length + 1))}>
                    {t('pdf.reveal')}
                  </SmallBtn>
                </>
              )}
              <SmallBtn className="ml-auto" onClick={() => { setPdf(null); setPdfError(null) }} aria-label={t('build.dismiss')}>✕</SmallBtn>
            </div>
          )}
          {selected && (buildResult || pendingCommand) && (
            <div className="mb-2 flex-none">
              <BuildPanel
                t={t}
                result={buildResult}
                pendingCommand={pendingCommand}
                onTrust={() => runBuild(true)}
                onCancelTrust={() => setPendingCommand(null)}
                onOpenIssue={openIssue}
                onDismiss={() => setBuildResult(null)}
              />
            </div>
          )}
          {selected && preview ? (
            viewMode === 'output' && outputUrl ? (
              <div className="flex flex-col gap-2 min-h-0">
                <div className="text-[12px] text-muted">{t('view.output_hint')}</div>
                <div
                  className="w-full rounded-md border border-border overflow-hidden"
                  style={{ aspectRatio: '16 / 9', background: '#111' }}
                >
                  <iframe
                    key={reloadKey}
                    src={outputUrl}
                    title={buildInfo?.output ?? 'output'}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            ) : (
              <SlideViewer t={t} preview={preview} current={current} onChange={setCurrent} reloadKey={reloadKey} />
            )
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
      {presenting && selected && outputUrl && preview && (
        <Presenter
          t={t}
          url={outputUrl}
          startSlide={current + 1}
          slideCount={preview.slides.length}
          onClose={() => setPresenting(false)}
        />
      )}
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
