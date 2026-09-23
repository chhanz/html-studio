import { useAppApi } from '@kirocrew/app-sdk'
import { Card, CardTitle, PageHeader } from '@kirocrew/app-sdk/ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, type BackendStatus, type BuildInfo, type BuildResult, type CheckIssue, type CheckJob, type CheckResult, type Deck, type DesignInfo, type NotesIndex, type PdfJob, type PreviewInfo, type Arranged, type ArchivedSlide, type NewDeckRequest, makeClient } from './api'
import { openDeckChat } from './chat'
import { BuildPanel } from './components/BuildPanel'
import { CheckPanel, issueKey } from './components/CheckPanel'
import { DeckChat } from './components/DeckChat'
import { NotesPanel } from './components/NotesPanel'
import { CodeEditor, type Drafts } from './components/CodeEditor'
import { DeckPanel } from './components/DeckPanel'
import { PinsPanel } from './components/PinsPanel'
import { Presenter } from './components/Presenter'
import { QuickChips } from './components/QuickChips'
import { Section, useCollapsed } from './components/Section'
import { SlideStrip, type ArrangeActions } from './components/SlideStrip'
import { LayoutPicker } from './components/LayoutPicker'
import { NewDeckDialog } from './components/NewDeckDialog'
import { TweakPanel } from './components/TweakPanel'
import { SlideViewer } from './components/SlideViewer'
import { SmallBtn } from './components/SmallBtn'
import { ThemeRow } from './components/ThemeRow'
import { Spinner } from './components/Spinner'
import { LOCALES, type LocalePref, useI18n } from './i18n'
import { type Capture, type Pin, loadPins, newPin, savePins } from './pins'
import { type QuickActionId, quickActionPrompt } from './quick'

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
  const [viewMode, setViewMode] = useState<'slides' | 'output' | 'code'>('slides')
  // Code editor drafts (unsaved text per slide), kept across slide and view switches.
  const draftsRef = useRef<Drafts>(new Map())
  // Output view: the frame follows `current` through its hash (src={url#N}); the
  // built-in runtime also reports its own navigation back, so the strip follows.
  const outputFrameRef = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: string; index?: number } | null
      if (!m || m.type !== 'hs-slide' || typeof m.index !== 'number') return
      if (e.source === outputFrameRef.current?.contentWindow) setCurrent(m.index)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

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
        if (res.ok) setTimeout(() => setBuildResult((cur) => (cur === res ? null : cur)), 8000)
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

  // P2-1: select-to-edit. The viewer frame runs the overlay (backend/inject/select.js)
  // and reports clicks; pins live here (persisted per deck) and are pushed back
  // to the frame so it can draw and re-anchor the markers.
  const [selectMode, setSelectMode] = useState(false)
  // P3-7: tweak panel (theme variables, live preview, apply to tokens.css).
  const [tweakOpen, setTweakOpen] = useState(false)
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
        // Deck-relative source path the agent will open (single-file decks: the entry itself).
        const name = preview.slides[cap.slideIndex] ?? String(cap.slideIndex + 1)
        const slideFile = selected?.kind === 'single' ? selected.entry ?? name : `${selected?.slidesDir ?? 'slides'}/${name}`
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
  const jumpToPin = useCallback((slideIndex: number, id: string) => {
    setCurrent(slideIndex)
    setActivePin(id)
    setViewMode('slides')
  }, [])

  // P2-3: send pins to the deck's chat session as one batch, then follow the
  // agent's per-pin reports (report.py → queue) until every pin is done.
  const [sending, setSending] = useState(false)
  const [chatRefresh, setChatRefresh] = useState(0)
  const [sendError, setSendError] = useState<string | null>(null)
  const sendPins = useCallback(async () => {
    if (!selected || sending) return
    const drafts = pins.filter((p) => p.status === 'new' && p.comment.trim())
    if (!drafts.length) return
    setSending(true)
    setSendError(null)
    try {
      const batch = await client.pinsSend(selected.path, drafts, locale)
      const { key } = await openDeckChat(api, { deck: selected, preview, build: buildInfo, language: locale }, t('chat.title', { name: selected.name }))
      await api.post('/api/chat?ws=1', { message: batch.prompt, slot: key, agent: '' })
      const cidByPin = new Map(batch.comments.map((c) => [c.pinId, c.cid]))
      setPins((prev) => prev.map((p) => (cidByPin.has(p.id) ? { ...p, status: 'sent', batchId: batch.id, batchCid: cidByPin.get(p.id), thread: [] } : p)))
      setChatRefresh((k) => k + 1) // the deck chat pane may have looked up before the session existed
    } catch (e) {
      setSendError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'request_failed')
    } finally {
      setSending(false)
    }
  }, [api, client, selected, pins, sending, locale, preview, buildInfo, t]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (completed) setReloadKey((k) => k + 1)
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
        const { key } = await openDeckChat(api, { deck: selected, preview, build: buildInfo, language: locale }, t('chat.title', { name: selected.name }))
        const msg = `Re pin [${pin.batchCid}] (${pin.slideFile} > ${pin.selector}): ${text}\nContinue with that comment and report again with report.py (--cid ${pin.batchCid}).`
        await api.post('/api/chat?ws=1', { message: msg, slot: key, agent: '' })
        setPins((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'sent', thread: [...(p.thread ?? []), { role: 'user', text, ts: Date.now() }] } : p)))
      } catch (e) {
        setSendError(e instanceof ApiError ? e.code : e instanceof Error ? e.message : 'request_failed')
      }
    },
    [api, client, selected, pins, preview, buildInfo, locale, t],
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

  // P2-5: deck check. One headless run over the deck; each issue can become a pin.
  const [checkJob, setCheckJob] = useState<CheckJob | null>(null)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  useEffect(() => {
    setCheckJob(null)
    setCheckResult(null)
    setCheckError(null)
  }, [selected?.path])
  const runCheck = useCallback(async () => {
    if (!selected || checkJob?.state === 'running') return
    setCheckError(null)
    setCheckResult(null)
    try {
      const job = await client.checkStart(selected.path)
      setCheckJob(job)
    } catch (e) {
      setCheckError(e instanceof ApiError ? e.code : 'request_failed')
    }
  }, [client, selected, checkJob?.state])
  useEffect(() => {
    if (!checkJob || checkJob.state !== 'running') return
    let alive = true
    const id = setInterval(async () => {
      try {
        const st = await client.checkStatus(checkJob.id)
        if (!alive) return
        if (st.state === 'running') return
        setCheckJob(st)
        if (st.state === 'done' && st.result) setCheckResult(st.result)
        else setCheckError(st.error ?? 'check_failed')
      } catch (e) {
        if (!alive) return
        setCheckJob(null)
        setCheckError(e instanceof ApiError ? e.code : 'request_failed')
      }
    }, 700)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [client, checkJob?.id, checkJob?.state]) // eslint-disable-line react-hooks/exhaustive-deps
  const pinnedIssues = useMemo(() => new Set(pins.map((p) => p.issueKey).filter((k): k is string => !!k)), [pins])
  const fixIssue = useCallback(
    (issue: CheckIssue) => {
      if (!preview) return
      const key = issueKey(issue)
      const name = preview.slides[issue.slideIndex] ?? String(issue.slideIndex + 1)
      const slideFile = selected?.kind === 'single' ? selected.entry ?? name : `${selected?.slidesDir ?? 'slides'}/${name}`
      const cap: Capture = {
        slideIndex: issue.slideIndex,
        cid: null,
        selector: issue.selector,
        tag: issue.tag,
        elementId: null,
        classes: issue.classes,
        text: issue.text,
        rect: issue.rect ?? { x: 0, y: 0, w: 0, h: 0 },
        src: issue.src ?? null,
      }
      const commentKey = `check.fixcomment.${issue.rule}`
      const base = t(commentKey) === commentKey ? t(`check.rule.${issue.rule}`) : t(commentKey)
      setPins((prev) => {
        if (prev.some((p) => p.issueKey === key)) return prev
        const nextIndex = prev.reduce((max, p) => Math.max(max, p.index), 0) + 1
        const pin = newPin(cap, slideFile, nextIndex)
        return [...prev, { ...pin, comment: issue.detail ? `${base} (${issue.detail})` : base, issueKey: key }]
      })
    },
    [preview, selected?.kind, selected?.entry, selected?.slidesDir, t],
  )
  const fixAllIssues = useCallback(() => {
    if (!checkResult) return
    for (const i of checkResult.issues) if (!pinnedIssues.has(issueKey(i))) fixIssue(i)
  }, [checkResult, pinnedIssues, fixIssue])

  // The deck's chat lives in the pane under the preview (DeckChat); collapsed until wanted.
  const [chatOpen, setChatOpen] = useCollapsed('chat', false)

  // P2-6: quick actions about the current slide, sent to the deck chat.
  const runQuickAction = useCallback(
    async (id: QuickActionId) => {
      if (!selected || !preview) return
      const name = preview.slides[current] ?? String(current + 1)
      const slideFile = selected.kind === 'single' ? selected.entry ?? name : `${selected.slidesDir}/${name}`
      const notesFile = `notes/${name.replace(/\.html?$/i, '').replace(/#/g, '-')}.md`
      const prompt = quickActionPrompt(id, {
        slideFile,
        slideNumber: current + 1,
        slideCount: preview.slides.length,
        notesFile,
        language: locale,
        hasDesignMd: selected.hasDesignMd,
      })
      const { key } = await openDeckChat(api, { deck: selected, preview, build: buildInfo, language: locale }, t('chat.title', { name: selected.name }))
      await api.post('/api/chat?ws=1', { message: prompt, slot: key, agent: '' })
      setChatRefresh((k) => k + 1)
      setChatOpen(true)
      // Actions that edit files: refresh the preview after a moment so the change shows.
      if (id === 'tighten' || id === 'draft-next') setTimeout(() => setReloadKey((k) => k + 1), 8000)
      if (id === 'notes') setTimeout(() => setNotesRefresh((k) => k + 1), 8000)
    },
    [api, selected, preview, current, locale, buildInfo, t, setChatOpen],
  )

  // Watch the selected deck for changes made outside the studio (the agent
  // writing slides, an editor saving): preview/start is idempotent and reports
  // the slide list and the newest mtime, so a light poll keeps the strip and
  // the viewer in step without a file watcher.
  const syncDeck = useCallback(async () => {
    if (!selected || !preview) return
    try {
      const p = await client.previewStart(selected.path)
      const slidesChanged = p.slides.length !== preview.slides.length || p.slides.some((s, i) => s !== preview.slides[i])
      const touched = p.modifiedAt !== undefined && preview.modifiedAt !== undefined && p.modifiedAt > preview.modifiedAt
      if (slidesChanged || touched || p.css !== preview.css) {
        setPreview(p)
        setReloadKey((k) => k + 1)
        setNotesIndex(null)
        setNotesRefresh((k) => k + 1)
        if (slidesChanged) {
          setDecks((ds) => ds.map((d) => (d.id === selected.id ? { ...d, slideCount: p.slides.length, slides: p.slides } : d)))
          setCurrent((c) => Math.min(c, Math.max(0, p.slides.length - 1)))
        }
      }
    } catch {
      /* preview restarting or backend away: the next tick tries again */
    }
  }, [client, selected, preview])
  useEffect(() => {
    if (!selected || !preview) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void syncDeck()
    }, 2500)
    return () => clearInterval(id)
  }, [selected, preview, syncDeck])

  // P3-5: speaker notes (notes/<slide>.md), edited under the preview.
  const [notesOpen, setNotesOpen] = useCollapsed('notes', false)
  const [notesIndex, setNotesIndex] = useState<NotesIndex | null>(null)
  const [notesRefresh, setNotesRefresh] = useState(0)
  useEffect(() => {
    setNotesIndex(null)
  }, [selected?.path])
  const withNotes = useMemo(() => new Set(notesIndex?.withNotes ?? []), [notesIndex])

  // P3-2: slide arrangement (reorder / add / duplicate / archive / restore).
  // The backend renames files and answers with the new slide list; the preview
  // keeps its server, only its slide list changes.
  const [arrangeBusy, setArrangeBusy] = useState(false)
  const [arrangeError, setArrangeError] = useState<string | null>(null)
  const [archived, setArchived] = useState<ArchivedSlide[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  useEffect(() => {
    setArchived([])
    setArrangeError(null)
    if (!selected) return
    let alive = true
    void client.slidesArchiveList(selected.path).then((r) => alive && setArchived(r.items)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [client, selected?.path]) // eslint-disable-line react-hooks/exhaustive-deps
  const applyArranged = useCallback(
    (res: Arranged, focus?: string) => {
      setPreview((p) => (p ? { ...p, slides: res.slides } : p))
      if (selected) setDecks((ds) => ds.map((d) => (d.id === selected.id ? { ...d, slideCount: res.slides.length } : d)))
      setReloadKey((k) => k + 1)
      setNotesRefresh((k) => k + 1)
      setNotesIndex(null)
      if (focus) {
        const i = res.slides.indexOf(focus)
        if (i >= 0) setCurrent(i)
      } else setCurrent((c) => Math.min(c, Math.max(0, res.slides.length - 1)))
      if (res.rebuild && 'ok' in res.rebuild) {
        setBuildResult(res.rebuild)
        if (selected) void client.buildInfo(selected.path).then(setBuildInfo).catch(() => undefined)
      }
      if (selected) void client.slidesArchiveList(selected.path).then((r) => setArchived(r.items)).catch(() => undefined)
    },
    [client, selected],
  )
  const runArrange = useCallback(
    async (op: () => Promise<Arranged & { name?: string }>, focusFromName = true) => {
      setArrangeBusy(true)
      setArrangeError(null)
      try {
        const res = await op()
        applyArranged(res, focusFromName ? res.name : undefined)
      } catch (e) {
        setArrangeError(e instanceof ApiError ? e.code : 'request_failed')
      } finally {
        setArrangeBusy(false)
      }
    },
    [applyArranged],
  )
  // P3-3: layout picker (insert a template after a slide / save a slide as a template).
  const [picker, setPicker] = useState<{ mode: 'insert' | 'save'; after: string | null; slide?: string } | null>(null)
  useEffect(() => {
    setPicker(null)
  }, [selected?.path])
  const arrangeActions = useMemo<ArrangeActions | undefined>(
    () =>
      selected
        ? {
            busy: arrangeBusy,
            onAdd: (after) => setPicker({ mode: 'insert', after }),
            onDuplicate: (slide) => void runArrange(() => client.slidesAdd(selected.path, slide, true)),
            onSaveLayout: (slide) => setPicker({ mode: 'save', after: slide, slide }),
            onReorder: (order) => {
              const focus = preview?.slides[current]
              const at = focus ? order.indexOf(focus) : -1
              void runArrange(async () => {
                const res = await client.slidesReorder(selected.path, order)
                return { ...res, name: at >= 0 ? res.slides[at] : undefined }
              })
            },
            onArchive: (slide) => void runArrange(() => client.slidesArchive(selected.path, slide), false),
          }
        : undefined,
    [selected, arrangeBusy, preview, current, runArrange, client],
  )

  // P1-8: DESIGN.md recognition. Read-only until the user asks for tokens.css.
  const [designInfo, setDesignInfo] = useState<DesignInfo | null>(null)
  const [tokensBusy, setTokensBusy] = useState(false)
  useEffect(() => {
    if (!selected || !selected.hasDesignMd) {
      setDesignInfo(null)
      return
    }
    let alive = true
    client
      .design(selected.path)
      .then((i) => alive && setDesignInfo(i))
      .catch((e) => {
        console.warn('[html-studio] design failed', e)
        alive && setDesignInfo(null)
      })
    return () => {
      alive = false
    }
  }, [client, selected?.path, selected?.hasDesignMd]) // eslint-disable-line react-hooks/exhaustive-deps
  const writeTokens = useCallback(async () => {
    if (!selected) return
    setTokensBusy(true)
    try {
      const info = await client.writeTokens(selected.path)
      setDesignInfo(info)
      // The backend restarted the preview with the new stylesheet: pick up its port/css.
      const p = await client.previewStart(selected.path)
      setPreview(p)
      setReloadKey((k) => k + 1)
    } catch (e) {
      setPreviewError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setTokensBusy(false)
    }
  }, [client, selected])

  // P1-7: deck chat pane state is declared above (needed by the quick actions).
  // Preview / chat split: share of the right column given to the chat (persisted).
  const [chatRatio, setChatRatio] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('hs.chatRatio'))
      return v >= 0.15 && v <= 0.8 ? v : 0.4
    } catch {
      return 0.4
    }
  })
  const rightColRef = useRef<HTMLDivElement>(null)
  // Code view: share of the height given to the preview (above the editor), persisted.
  const [codeRatio, setCodeRatio] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem('hs.codeRatio'))
      return v >= 0.15 && v <= 0.75 ? v : 0.45
    } catch {
      return 0.45
    }
  })
  const codeViewRef = useRef<HTMLDivElement>(null)
  const onCodeSplitterDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const box = codeViewRef.current
    if (!box) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const rect = box.getBoundingClientRect()
    const move = (ev: PointerEvent) => setCodeRatio(Math.min(0.75, Math.max(0.15, (ev.clientY - rect.top) / rect.height)))
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      setCodeRatio((r) => {
        try {
          localStorage.setItem('hs.codeRatio', String(r))
        } catch {
          /* ignore */
        }
        return r
      })
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }, [])
  const onSplitterDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const col = rightColRef.current
      if (!col) return
      e.preventDefault()
      const handle = e.currentTarget
      handle.setPointerCapture(e.pointerId)
      const rect = col.getBoundingClientRect()
      const move = (ev: PointerEvent) => {
        const ratio = Math.min(0.8, Math.max(0.15, (rect.bottom - ev.clientY) / rect.height))
        setChatRatio(ratio)
      }
      const up = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', up)
        handle.removeEventListener('pointercancel', up)
        setChatRatio((r) => {
          try {
            localStorage.setItem('hs.chatRatio', String(r))
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
    [],
  )
  useEffect(() => {
    setPdf(null)
    setPdfError(null)
  }, [selected?.path])

  const [presenting, setPresenting] = useState(false)
  const present = useCallback(() => {
    if (!selected || !outputUrl) return
    setPresenting(true)
  }, [selected, outputUrl])
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

  // P3-4: new deck wizard. After creation the deck is selected; optionally the
  // deck chat opens with the wizard's answers and asks for an outline.
  const [newDeckOpen, setNewDeckOpen] = useState(false)
  const onDeckCreated = useCallback(
    async (deck: Deck, askOutline: boolean, answers: NewDeckRequest) => {
      setNewDeckOpen(false)
      await refresh()
      selectDeck(deck)
      if (!askOutline) return
      try {
        const { key } = await openDeckChat(api, { deck, preview: null, build: null, language: locale }, t('chat.title', { name: deck.name }))
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
        await api.post('/api/chat?ws=1', { message: msg, slot: key, agent: '' })
        setChatOpen(true)
      } catch {
        /* the deck exists; the chat can be started from the pane */
      }
    },
    [refresh, api, locale, t], // eslint-disable-line react-hooks/exhaustive-deps
  )


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

  const gridCols = sidebarOpen ? 'minmax(200px, 1fr) minmax(320px, 4fr)' : '36px minmax(320px, 4fr)'

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
                      <SlideStrip t={t} preview={preview} current={current} onSelect={setCurrent} reloadKey={reloadKey} withNotes={withNotes} notesLabel={t('strip.has_notes')} arrange={arrangeActions} />
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
                                    onClick={() => void runArrange(() => client.slidesRestore(selected.path, a.name, preview.slides[current] ?? null))}
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
                onClick={() => void runCheck()}
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
              <SmallBtn active onClick={present} disabled={!outputUrl} title={outputUrl ? t('present.hint') : t('present.need_output')}>
                {t('toolbar.present')}
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
              <SmallBtn className="ml-auto" onClick={() => { setPdf(null); setPdfError(null) }} aria-label={t('build.dismiss')}>✕</SmallBtn>
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
              pinned={pinnedIssues}
              onJump={(i) => {
                setCurrent(i)
                setViewMode('slides')
              }}
              onFix={fixIssue}
              onFixAll={fixAllIssues}
              onClose={() => setCheckResult(null)}
            />
          )}
          {selected && (buildResult || pendingCommand) && (
            <div className="mb-2 flex-none overflow-y-auto" style={{ maxHeight: "40%" }}>
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
                      setReloadKey((k) => k + 1)
                      if (res.rebuild && 'ok' in res.rebuild) {
                        setBuildResult(res.rebuild)
                        void client.buildInfo(selected.path).then(setBuildInfo).catch(() => undefined)
                      }
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
                  pins={pins}
                  current={current}
                  activeId={activePin}
                  sending={sending}
                  sendError={sendError}
                  onComment={updatePinComment}
                  onRemove={removePin}
                  onJump={jumpToPin}
                  onClearAll={() => setPins([])}
                  onSend={() => void sendPins()}
                  onReply={(id, text) => void replyToPin(id, text)}
                  onDismissDone={dismissDone}
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
                tokensBusy={tokensBusy}
                onWriteTokens={() => void writeTokens()}
                onPreview={() => setReloadKey((k) => k + 1)}
                onApplied={() => {
                  setReloadKey((k) => k + 1)
                  void client.previewStart(selected.path).then(setPreview).catch(() => undefined)
                  void client.design(selected.path).then(setDesignInfo).catch(() => undefined)
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
            onPick={(layoutId, after) => {
              setPicker(null)
              void runArrange(() => client.slidesAdd(selected.path, after, false, layoutId))
            }}
          />
        )}

        {/* Speaker notes for the current slide (P3-5) */}
        {selected && preview && preview.slides[current] && (
          <div className="hs-right-notes min-h-0 flex flex-col" style={{ flex: notesOpen ? '0 0 22%' : '0 0 auto', marginTop: 12 }}>
            <Card>
              <NotesPanel
                t={t}
                client={client}
                deckPath={selected.path}
                slide={preview.slides[current]}
                slideNumber={current + 1}
                open={notesOpen}
                onToggle={() => setNotesOpen(!notesOpen)}
                onChanged={setNotesIndex}
                refreshKey={notesRefresh + reloadKey}
              />
            </Card>
          </div>
        )}

        {/* Splitter: drag to change the preview / chat share (hidden when the chat is collapsed) */}
        {chatOpen ? (
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
        <div className="hs-right-chat min-h-0 flex flex-col" style={{ flex: chatOpen ? `0 0 ${Math.round(chatRatio * 1000) / 10}%` : '0 0 auto' }}>
        <Card>
          <DeckChat
            t={t}
            locale={locale}
            deck={selected}
            preview={preview}
            build={buildInfo}
            open={chatOpen}
            onToggle={() => setChatOpen(!chatOpen)}
            refreshKey={chatRefresh}
            toolbar={preview ? <QuickChips t={t} slideNumber={current + 1} onRun={runQuickAction} /> : null}
          />
        </Card>
        </div>
        </div>
      </div>
      {presenting && selected && outputUrl && preview && (
        <Presenter
          t={t}
          url={outputUrl}
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
