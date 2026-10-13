import { useAppApi } from '@kirocrew/app-sdk'
import { Card, CardTitle, PageHeader } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Deck, type NewDeckRequest, makeClient } from './api'
import { BuildPanel } from './components/BuildPanel'
import { CheckPanel } from './components/CheckPanel'
import { DeckChat } from './components/DeckChat'
import { NotesPanel } from './components/NotesPanel'
import { CodeEditor } from './components/CodeEditor'
import { DeckPanel } from './components/DeckPanel'
import { PinsPanel } from './components/PinsPanel'
import { Presenter } from './components/Presenter'
import { ShowWindow, readShowParams, showWindowUrl } from './components/ShowWindow'
import { QuickChips } from './components/QuickChips'
import { Section, useCollapsed } from './components/Section'
import { SlideStrip } from './components/SlideStrip'
import { LayoutPicker } from './components/LayoutPicker'
import { NewDeckDialog } from './components/NewDeckDialog'
import { TweakPanel } from './components/TweakPanel'
import { SlideViewer } from './components/SlideViewer'
import { SmallBtn } from './components/SmallBtn'
import { ThemeRow } from './components/ThemeRow'
import { Spinner } from './components/Spinner'
import { type Conn, useConnection } from './hooks/useConnection'
import { useNotes } from './hooks/useNotes'
import { usePreview } from './hooks/usePreview'
import { useBuild } from './hooks/useBuild'
import { useDeckChat } from './hooks/useDeckChat'
import { usePins } from './hooks/usePins'
import { useCheck } from './hooks/useCheck'
import { useArrange } from './hooks/useArrange'
import { useTheme } from './hooks/useTheme'
import { useHeaderHeight, usePdf, useSplitRatio } from './hooks/useLayout'
import { LOCALES, type LocalePref, useI18n } from './i18n'

// NOTE on styling: the dashboard ships a precompiled Tailwind sheet, so only
// utility classes the host itself uses are available (e.g. text-muted,
// border-border, bg-card, bg-ok/bg-warn/bg-danger, text-text). Anything else
// must be expressed with inline styles or the host's CSS variables
// (--accent, --muted, --border, --ok, --warn, --danger, --text, --card, --bg).

/**
 * Entry. The dashboard mounts this once per page. A page opened by Present
 * (same app URL plus the show parameters) renders only the show; every other
 * page is the studio.
 */
export default function HtmlStudio() {
  const show = readShowParams(location.search)
  return show ? <ShowWindow params={show} /> : <Studio />
}

/**
 * The studio page. Each concern lives in a hook under ./hooks; this component
 * wires them together and lays out the panes. Read top to bottom: connection
 * and deck list, the preview of the selected deck, then everything that acts
 * on it (build, chat, pins, check, arrange, theme, pdf), then the layout.
 */
function Studio() {
  const api = useAppApi()
  const client = useMemo(() => makeClient(api), [api])
  const { t, locale, pref, setPref } = useI18n()

  const { conn, status, roots, decks, setDecks, loading, error, errorDetail, selectedId, selected, decksForce, slidesForce, refresh, addRoot, removeRoot, selectDeck } = useConnection(client)
  const [sidebarOpen, setSidebarOpen] = useCollapsed('sidebar', true)

  const notes = useNotes(selected?.path)
  const { preview, setPreview, previewError, setPreviewError, current, setCurrent, reloadKey, bumpReload, viewMode, setViewMode, externalChanges, draftsRef, outputFrameRef, syncDeck } = usePreview({
    client,
    selected,
    setDecks,
    onExternalChange: notes.invalidate,
  })

  const build = useBuild({ client, selected, preview, externalChanges, t, setViewMode, setCurrent, bumpReload })
  const { buildInfo, building, buildResult, pendingCommand, runBuild, showRebuild, outputUrl, showUrl, canBuild, buildHint } = build

  const chat = useDeckChat({ api, selected, preview, buildInfo, current, locale, t, bumpReload, bumpNotes: notes.bump })
  const pins = usePins({ client, selected, preview, current, locale, setCurrent, setViewMode, bumpReload, postToChat: chat.post, bumpChat: chat.bumpChat })
  const { selectMode, setSelectMode, activePin, setViewerFrame } = pins
  const check = useCheck({ client, selected, preview, t, setPins: pins.setPins, pinnedIssues: pins.pinnedIssues })
  const { checkJob, checkResult, checkError } = check

  const arrange = useArrange({ client, selected, preview, current, setPreview, setDecks, setCurrent, bumpReload, invalidateNotes: notes.invalidate, showRebuild })
  const { arrangeBusy, arrangeError, archived, archiveOpen, setArchiveOpen, arrangeActions, picker, setPicker } = arrange

  const theme = useTheme({ client, selected, setPreview, setPreviewError, bumpReload })
  const { designInfo, tweakOpen, setTweakOpen } = theme
  const { pdf, pdfError, exportPdf, dismiss: pdfDismiss } = usePdf(client, selected)

  // Preview / chat split: share of the right column given to the chat. Code view: share of the height given to the preview.
  const chatSplit = useSplitRatio<HTMLDivElement>({ key: 'hs.chatRatio', initial: 0.4, min: 0.15, max: 0.8, fromPointer: (ev, rect) => (rect.bottom - ev.clientY) / rect.height })
  const codeSplit = useSplitRatio<HTMLDivElement>({ key: 'hs.codeRatio', initial: 0.45, min: 0.15, max: 0.75, fromPointer: (ev, rect) => (ev.clientY - rect.top) / rect.height })
  const { ratio: chatRatio, boxRef: rightColRef, onPointerDown: onSplitterDown } = chatSplit
  const { ratio: codeRatio, boxRef: codeViewRef, onPointerDown: onCodeSplitterDown } = codeSplit
  const { headRef, headH } = useHeaderHeight()

  // Presenting. The show opens in its own window (this app's page with the show
  // parameters): the dashboard stays usable and the window can be dragged to
  // the projector. If the window cannot be opened (pop-ups blocked), the show
  // runs as an in-app fullscreen overlay instead.
  const [presenting, setPresenting] = useState(false) // the in-app overlay (fallback)
  const [showWin, setShowWin] = useState<Window | null>(null)
  const present = useCallback(() => {
    if (!selected || !showUrl || !preview) return
    if (showWin && !showWin.closed) {
      showWin.focus()
      return
    }
    const target = showWindowUrl({ deck: selected.path, url: showUrl, base: preview.baseUrl, slide: current + 1, count: preview.slides.length })
    const w = Math.min(1280, Math.round((screen.availWidth || 1280) * 0.8))
    const h = Math.round((w * 9) / 16) + 40
    const win = window.open(target, 'hs-show', `popup=yes,width=${w},height=${h},resizable=yes`)
    if (!win) {
      setPresenting(true)
      return
    }
    try {
      win.focus()
    } catch {
      /* a vetoed focus is cosmetic */
    }
    setShowWin(win)
  }, [selected, showUrl, preview, current, showWin])
  // The show window closed: the show is over; pick up the slide it ended on.
  useEffect(() => {
    if (!showWin || !preview) return
    const base = preview.baseUrl
    const id = setInterval(() => {
      if (!showWin.closed) return
      clearInterval(id)
      setShowWin(null)
      fetch(`${base}/present/state`)
        .then((r) => r.json())
        .then((st: { index?: number }) => {
          if (typeof st.index === 'number') setCurrent(st.index)
        })
        .catch(() => undefined)
    }, 1000)
    return () => clearInterval(id)
  }, [showWin, preview, setCurrent])
  const showOpen = !!showWin && !showWin.closed

  // New deck wizard. After creation the deck is selected; optionally the deck
  // chat opens with the wizard's answers and asks for an outline.
  const [newDeckOpen, setNewDeckOpen] = useState(false)
  const onDeckCreated = useCallback(
    async (deck: Deck, askOutline: boolean, answers: NewDeckRequest) => {
      setNewDeckOpen(false)
      await refresh()
      selectDeck(deck)
      if (!askOutline) return
      try {
        const lang = locale.startsWith('ko') ? 'Korean' : 'English'
        const msg = [
          'This deck was just created with the new deck wizard. brief.md in the deck folder holds the same answers.',
          `Title: ${answers.title}`,
          answers.presenter ? `Presenter: ${answers.presenter}` : '',
          answers.purpose ? `Purpose: ${answers.purpose}` : '',
          answers.audience ? `Audience: ${answers.audience}` : '',
          answers.sources ? `Source material:\n${answers.sources}` : '',
          '',
          `Propose an outline for this deck as a numbered list of slide titles with one line each on what the slide shows (answer in ${lang}). Do not create files yet; wait for my go-ahead.`,
        ]
          .filter((l) => l !== '')
          .join('\n')
        await chat.post(deck, msg, { preview: null, build: null })
        chat.setChatOpen(true)
      } catch {
        /* the deck exists; the chat can be started from the pane */
      }
    },
    [refresh, locale, chat], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const statusText =
    conn === 'connecting' ? t('status.connecting') : conn === 'connected' ? t('status.connected') : t('status.error')
  const gridCols = sidebarOpen ? 'minmax(200px, 1fr) minmax(320px, 4fr)' : '36px minmax(320px, 4fr)'

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

      {/* Layout: sidebar | (preview / deck chat). Stacks below 1100px. */}
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
          /* Right column: two cards share the height (inline flex-basis on each wrapper). */
          .hs-grid .hs-right > div > * { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
          .hs-grid .hs-right > div > * > * { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
          .hs-grid .hs-right-chat[style*="0 0 auto"] > * > *, .hs-grid .hs-right-notes[style*="0 0 auto"] > * > * { flex: 0 0 auto; }
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
                  onRefresh={async () => {
                    await refresh()
                    await syncDeck()
                  }}
                  onNew={() => setNewDeckOpen(true)}
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
                    <>
                      <SlideStrip t={t} preview={preview} current={current} onSelect={setCurrent} reloadKey={reloadKey} withNotes={notes.withNotes} notesLabel={t('strip.has_notes')} arrange={arrangeActions} />
                      {arrangeError && (
                        <p className="m-0 mt-2 text-[12px]" role="alert" style={{ color: 'var(--danger)' }}>
                          {t('error.generic', { code: arrangeError })}
                        </p>
                      )}
                      {archived.length > 0 && (
                        <div className="mt-3 text-[12px]" data-testid="archive-list">
                          <button
                            type="button"
                            onClick={() => setArchiveOpen((v) => !v)}
                            aria-expanded={archiveOpen}
                            className="w-full text-left bg-transparent border-0 p-0 cursor-pointer text-muted hover:text-text"
                          >
                            {archiveOpen ? '▾' : '▸'} {t('strip.archive_box', { n: archived.length })}
                          </button>
                          {archiveOpen && (
                            <ul className="m-0 mt-1 p-0 list-none flex flex-col gap-1">
                              {archived.map((a) => (
                                <li key={a.name} className="flex items-center gap-2">
                                  <span className="truncate flex-1 text-muted" title={a.file}>
                                    {a.name}
                                  </span>
                                  <SmallBtn
                                    disabled={arrangeBusy}
                                    onClick={() => arrange.restore(a.name)}
                                    title={t('strip.restore_hint')}
                                  >
                                    {t('strip.restore')}
                                  </SmallBtn>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </>
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

        {/* Right column: preview above, deck chat below */}
        <div ref={rightColRef} className="hs-right min-h-0 flex flex-col">
        <div className="hs-right-preview min-h-0 flex flex-col" style={{ flex: '1 1 0' }}>
        <Card>
          <div className="hs-fill min-h-0 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap flex-none">
            <CardTitle>{selected ? selected.name : t('panel.preview')}</CardTitle>
            <div className="flex gap-3 flex-wrap items-center">
              {/* Left cluster: how the deck is shown (view mode + toggles). Right cluster: things that run. */}
              <div className="flex gap-1 items-center" role="group" aria-label={t('toolbar.group_view')}>
              {preview && (
                <div className="inline-flex rounded-md border border-border overflow-hidden mr-1" role="group" aria-label={t('view.label')}>
                  {(outputUrl ? (['slides', 'output', 'code'] as const) : (['slides', 'code'] as const)).map((m) => (
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
                onClick={() => setSelectMode((v) => !v)}
                active={selectMode}
                aria-pressed={selectMode}
                disabled={!preview || viewMode !== 'slides'}
                title={t('select.hint')}
              >
                {t('toolbar.select')}
              </SmallBtn>
              <SmallBtn onClick={() => setTweakOpen((v) => !v)} active={tweakOpen} aria-pressed={tweakOpen} disabled={!selected || !preview} title={t('toolbar.tweak_hint')} data-testid="toolbar-tweak">
                {t('toolbar.tweak')}
              </SmallBtn>
              </div>
              <div className="flex gap-1 items-center" role="group" aria-label={t('toolbar.group_actions')}>
              <SmallBtn
                onClick={() => runBuild(false)}
                disabled={!canBuild}
                className="inline-flex items-center gap-1.5"
                title={buildHint}
              >
                {building && <Spinner />}
                {t('toolbar.build')}
              </SmallBtn>
              <SmallBtn
                onClick={() => void check.runCheck()}
                disabled={!preview || checkJob?.state === 'running'}
                title={t('check.hint')}
                className="inline-flex items-center gap-1.5"
              >
                {checkJob?.state === 'running' && <Spinner />}
                {checkJob?.state === 'running' && preview ? t('check.running', { n: preview.slides.length }) : t('toolbar.check')}
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
              <SmallBtn active onClick={present} disabled={!showUrl} title={showOpen ? t('present.open_hint') : showUrl ? t('present.hint') : t('present.need_output')} aria-pressed={showOpen}>
                {showOpen ? t('toolbar.presenting') : t('toolbar.present')}
              </SmallBtn>
              </div>
            </div>
          </div>
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
              <SmallBtn className="ml-auto" onClick={pdfDismiss} aria-label={t('build.dismiss')}>✕</SmallBtn>
            </div>
          )}
          {selected && designInfo && <ThemeRow t={t} info={designInfo} onOpenTheme={() => setTweakOpen(true)} />}
          {selected && checkError && (
            <div className="mb-2 flex-none rounded-md border p-2 text-[12px]" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} role="alert">
              {t('check.failed')}: {t(`error.${checkError}`) === `error.${checkError}` ? t('error.generic', { code: checkError }) : t(`error.${checkError}`)}
              {checkJob?.detail ? <span className="block text-muted break-all">{checkJob.detail}</span> : null}
            </div>
          )}
          {selected && checkResult && (
            <CheckPanel
              t={t}
              result={checkResult}
              pinned={pins.pinnedIssues}
              draftCount={pins.pins.filter((p) => p.status === 'new').length}
              pinAllLeft={check.pinAllLeft}
              onJump={(i) => {
                setCurrent(i)
                setViewMode('slides')
              }}
              onFix={check.fixIssue}
              onFixAll={check.fixAllIssues}
              onClose={() => check.setCheckResult(null)}
            />
          )}
          {selected && build.outputStale && (
            <div className="mb-2 flex-none rounded-md border p-2 text-[12px] flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--warn)' }} role="status" data-testid="build-stale-notice">
              <span className="flex-1 min-w-0">{t('build.stale')}</span>
              <SmallBtn active onClick={() => runBuild(false)} disabled={!canBuild} className="inline-flex items-center gap-1.5">
                {building && <Spinner />}
                {t('toolbar.build')}
              </SmallBtn>
            </div>
          )}
          {selected && build.scriptOffer && (
            <div className="mb-2 flex-none rounded-md border p-3 text-[13px] flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--border)' }} role="status" data-testid="build-script-notice">
              <span className="flex-1 min-w-0">{t('build.script.found', { script: build.scriptOffer.script, command: build.scriptOffer.command })}</span>
              <SmallBtn active onClick={build.adoptScript}>
                {t('build.script.use', { script: build.scriptOffer.script })}
              </SmallBtn>
              <SmallBtn onClick={build.ignoreScript}>{t('build.script.ignore')}</SmallBtn>
            </div>
          )}
          {selected && (buildResult || pendingCommand) && (
            <div className="mb-2 flex-none overflow-y-auto" style={{ maxHeight: "40%" }}>
              <BuildPanel
                t={t}
                result={buildResult}
                pendingCommand={pendingCommand}
                onTrust={() => runBuild(true)}
                onCancelTrust={() => build.setPendingCommand(null)}
                onOpenIssue={build.openIssue}
                onDismiss={() => build.setBuildResult(null)}
              />
            </div>
          )}
          <div className="flex min-h-0 flex-1" style={{ gap: tweakOpen ? 12 : 0 }}>
          <div className="flex flex-col min-h-0 min-w-0 flex-1">
          {selected && preview ? (
            viewMode === 'code' && preview.slides[current] ? (
              <div ref={codeViewRef} className="flex flex-col min-h-0 flex-1" data-testid="code-view">
                <div className="min-w-0 min-h-0 flex flex-col overflow-hidden" style={{ flex: `0 0 calc(${Math.round(codeRatio * 1000) / 10}% - 6px)` }}>
                  <SlideViewer t={t} preview={preview} current={current} onChange={setCurrent} reloadKey={reloadKey} />
                </div>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label={t('split.code_label')}
                  aria-valuenow={Math.round(codeRatio * 100)}
                  data-testid="code-split-handle"
                  onPointerDown={onCodeSplitterDown}
                  className="flex-none flex items-center justify-center"
                  style={{ flex: '0 0 12px', height: 12, cursor: 'row-resize', touchAction: 'none' }}
                >
                  <div className="rounded-full" style={{ flex: '0 0 3px', width: 40, height: 3, background: 'var(--border-strong, var(--border))', opacity: 0.8 }} />
                </div>
                <div className="min-w-0 min-h-0 flex flex-col flex-1 overflow-hidden">
                  <CodeEditor
                    t={t}
                    client={client}
                    deckPath={selected.path}
                    slide={preview.slides[current]}
                    slideNumber={current + 1}
                    drafts={draftsRef.current}
                    refreshKey={reloadKey}
                    onSaved={(res) => {
                      bumpReload()
                      showRebuild(res.rebuild, selected.path)
                    }}
                  />
                </div>
              </div>
            ) : viewMode === 'output' && outputUrl ? (
              <div className="flex flex-col gap-2 min-h-0">
                <div className="text-[12px] text-muted">{t('view.output_hint')}</div>
                <div
                  className="w-full rounded-md border border-border overflow-hidden"
                  style={{ aspectRatio: '16 / 9', background: '#111' }}
                >
                  <iframe
                    key={reloadKey}
                    ref={outputFrameRef}
                    src={`${outputUrl}#${current + 1}`}
                    title={buildInfo?.output ?? 'output'}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            ) : (
              <>
                {selectMode && (
                  <div className="mb-1 flex-none text-[12px]" style={{ color: 'var(--accent)' }} role="status">
                    {t('select.on_hint')}
                  </div>
                )}
                <SlideViewer t={t} preview={preview} current={current} onChange={setCurrent} reloadKey={reloadKey} selectMode={selectMode} frameRef={setViewerFrame} />
                <PinsPanel
                  t={t}
                  pins={pins.pins}
                  current={current}
                  activeId={activePin}
                  sending={pins.sending}
                  sendError={pins.sendError}
                  sendLeft={pins.sendLeft}
                  onComment={pins.updatePinComment}
                  onRemove={pins.removePin}
                  onJump={pins.jumpToPin}
                  onClearAll={() => pins.setPins([])}
                  onSend={() => void pins.sendPins()}
                  onReply={(id, text) => void pins.replyToPin(id, text)}
                  onDismissDone={pins.dismissDone}
                />
              </>
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
          {tweakOpen && selected && preview && (
            <div className="min-h-0 flex-none" style={{ width: 300 }}>
              <TweakPanel
                t={t}
                client={client}
                deckPath={selected.path}
                design={designInfo}
                tokensBusy={theme.tokensBusy}
                onWriteTokens={() => void theme.writeTokens()}
                onPreview={bumpReload}
                onApplied={(rebuild) => {
                  theme.onApplied()
                  showRebuild(rebuild, selected.path)
                  void refresh()
                }}
                onClose={() => setTweakOpen(false)}
              />
            </div>
          )}
          </div>
          </div>
        </Card>
        </div>

        {newDeckOpen && <NewDeckDialog t={t} client={client} roots={roots} decks={decks} onCreated={(d, ask, a) => void onDeckCreated(d, ask, a)} onClose={() => setNewDeckOpen(false)} />}
        {picker && selected && preview && (
          <LayoutPicker
            t={t}
            client={client}
            preview={preview}
            mode={picker.mode}
            after={picker.after}
            saveSlide={picker.slide}
            deckPath={selected.path}
            busy={arrangeBusy}
            onClose={() => setPicker(null)}
            onPick={arrange.insertLayout}
          />
        )}

        {/* Speaker notes for the current slide (P3-5) */}
        {selected && preview && preview.slides[current] && (
          <div className="hs-right-notes min-h-0 flex flex-col" style={{ flex: notes.notesOpen ? '0 0 22%' : '0 0 auto', marginTop: 12 }}>
            <Card>
              <NotesPanel
                t={t}
                client={client}
                deckPath={selected.path}
                slide={preview.slides[current]}
                slideNumber={current + 1}
                open={notes.notesOpen}
                onToggle={() => notes.setNotesOpen(!notes.notesOpen)}
                onChanged={notes.setNotesIndex}
                refreshKey={notes.notesRefresh + reloadKey}
              />
            </Card>
          </div>
        )}

        {/* Splitter: drag to change the preview / chat share (hidden when the chat is collapsed) */}
        {chat.chatOpen ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('split.label')}
            aria-valuenow={Math.round(chatRatio * 100)}
            data-testid="split-handle"
            onPointerDown={onSplitterDown}
            className="flex-none flex items-center justify-center"
            style={{ flex: '0 0 12px', height: 12, cursor: 'row-resize', touchAction: 'none' }}
          >
            <div className="rounded-full" style={{ flex: '0 0 3px', width: 40, height: 3, background: 'var(--border-strong, var(--border))', opacity: 0.8 }} />
          </div>
        ) : (
          <div style={{ flex: '0 0 12px', height: 12 }} />
        )}

        {/* Deck chat (under the preview) */}
        <div className="hs-right-chat min-h-0 flex flex-col" style={{ flex: chat.chatOpen ? `0 0 ${Math.round(chatRatio * 1000) / 10}%` : '0 0 auto' }}>
        <Card>
          <DeckChat
            t={t}
            locale={locale}
            deck={selected}
            preview={preview}
            build={buildInfo}
            open={chat.chatOpen}
            onToggle={() => chat.setChatOpen(!chat.chatOpen)}
            refreshKey={chat.chatRefresh}
            toolbar={preview ? <QuickChips t={t} slideNumber={current + 1} onRun={chat.runQuickAction} /> : null}
          />
        </Card>
        </div>
        </div>
      </div>
      {presenting && selected && showUrl && preview && (
        <Presenter
          t={t}
          url={showUrl}
          baseUrl={preview.baseUrl}
          startSlide={current + 1}
          slideCount={preview.slides.length}
          onClose={() => setPresenting(false)}
          onPosition={(n) => setCurrent(n - 1)}
          openPresenter={async (slide) => {
            await client.present(selected.path, slide, 'presenter', locale)
          }}
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
