import { useCallback, useEffect, useState } from 'react'
import { ApiError, type BuildInfo, type BuildResult, type Client, type Deck, type PreviewInfo, type Rebuild } from '../api'
import type { ViewMode } from './usePreview'

type T = (key: string, vars?: Record<string, string | number>) => string

type Args = {
  client: Client
  selected: Deck | null
  preview: PreviewInfo | null
  /** Bumped when the deck changed on disk outside the studio: build info is re-read (the output may be stale). */
  externalChanges: number
  t: T
  setViewMode: (m: ViewMode) => void
  setCurrent: (i: number) => void
  bumpReload: () => void
}

/**
 * Building the deck: the build contract (build/info), running a build, the
 * one-time consent for an external command, the result banner, and the offer
 * to adopt a build script found in the deck root.
 */
export function useBuild({ client, selected, preview, externalChanges, t, setViewMode, setCurrent, bumpReload }: Args) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [building, setBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  // Decks whose undeclared build script the user chose not to adopt (kept across reloads).
  const [scriptIgnored, setScriptIgnored] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('hs.scriptIgnored') || '[]') as string[]
    } catch {
      return []
    }
  })
  useEffect(() => localStorage.setItem('hs.scriptIgnored', JSON.stringify(scriptIgnored)), [scriptIgnored])

  useEffect(() => {
    setBuildResult(null)
    setPendingCommand(null)
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
  useEffect(() => {
    if (!selected || !externalChanges) return
    void client.buildInfo(selected.path).then(setBuildInfo).catch(() => undefined)
  }, [client, selected?.path, externalChanges]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Resolve a build answer to its result. A built-in build answers at once; an
   * external command answers a job id (its script may outlast the 30s the
   * dashboard proxy gives one request), which is polled here until it ends.
   */
  const awaitBuild = useCallback(
    async (res: Rebuild | undefined): Promise<BuildResult | null> => {
      if (!res || !('ok' in res || 'job' in res)) return null
      if ('ok' in res) return res
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000))
        const st = await client.buildStatus(res.job)
        if (st.state === 'done' && st.result) return st.result
        if (st.state === 'error') return { ok: false, mode: 'external', stderr: st.detail || st.error || 'build_failed' }
      }
    },
    [client],
  )

  /** After an edit route reports a rebuild: show its result once it is known. */
  const showRebuild = useCallback(
    (rebuild: Rebuild | undefined, path: string) => {
      if (!rebuild || 'skipped' in rebuild) return
      if ('job' in rebuild) setBuilding(true)
      void awaitBuild(rebuild)
        .then((r) => {
          if (!r) return
          setBuildResult(r)
          if (r.ok) bumpReload()
          void client.buildInfo(path).then(setBuildInfo).catch(() => undefined)
        })
        .finally(() => setBuilding(false))
    },
    [awaitBuild, client, bumpReload],
  )

  const runBuild = useCallback(
    async (trust = false) => {
      if (!selected) return
      setBuilding(true)
      setPendingCommand(null)
      try {
        const first = await client.build(selected.path, trust)
        if ('ok' in first && first.needsTrust && first.command) {
          setPendingCommand(first.command)
          return
        }
        const res = (await awaitBuild(first)) as BuildResult
        setBuildResult(res)
        if (res.ok) setTimeout(() => setBuildResult((cur) => (cur === res ? null : cur)), 8000)
        bumpReload()
        const info = await client.buildInfo(selected.path)
        setBuildInfo(info)
        if (res.ok && res.output) setViewMode('output')
      } catch (e) {
        setBuildResult({ ok: false, mode: 'external', stderr: e instanceof ApiError ? e.code : 'request_failed' })
      } finally {
        setBuilding(false)
      }
    },
    [client, selected, awaitBuild, bumpReload, setViewMode],
  )

  /** Declare the detected build script in studio.json, then build with it (consent follows). */
  const adoptScript = useCallback(() => {
    if (!selected) return
    void client
      .buildAdopt(selected.path)
      .then((info) => {
        setBuildInfo(info)
        return runBuild(false)
      })
      .catch(() => undefined)
  }, [client, selected, runBuild])
  const ignoreScript = useCallback(() => {
    if (selected) setScriptIgnored((v) => [...v, selected.path])
  }, [selected])
  const scriptOffer = selected && buildInfo?.script && buildInfo.suggestedCommand && !buildInfo.command && !scriptIgnored.includes(selected.path)
    ? { script: buildInfo.script, command: buildInfo.suggestedCommand }
    : null

  const openIssue = (file: string) => {
    if (!preview) return
    const idx = preview.slides.indexOf(file)
    if (idx >= 0) {
      setViewMode('slides')
      setCurrent(idx)
    }
  }

  const outputUrl = preview && buildInfo?.outputExists ? `${preview.baseUrl}/${buildInfo.output}` : null
  /**
   * What Present shows. A deck built by an external command shows its output
   * (the command's result is the real deck); every other deck shows the live
   * /show page the preview server assembles from the current files, so the
   * show, the presenter window and the viewer always agree and no build is needed.
   */
  const showUrl = !preview || !buildInfo || preview.slides.length === 0 ? null : buildInfo.command ? outputUrl : `${preview.baseUrl}/show`
  /** External build whose output predates a source file: the show is behind the slides. */
  const outputStale = !!(buildInfo?.command && buildInfo.outputExists && buildInfo.outputStale)
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

  return {
    buildInfo,
    building,
    buildResult,
    setBuildResult,
    pendingCommand,
    setPendingCommand,
    runBuild,
    showRebuild,
    adoptScript,
    ignoreScript,
    scriptOffer,
    openIssue,
    outputUrl,
    showUrl,
    outputStale,
    canBuild,
    buildHint,
  }
}
