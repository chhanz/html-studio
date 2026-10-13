import { useCallback, useEffect, useState } from 'react'
import { ApiError, type CheckIssue, type CheckJob, type CheckResult, type Client, type Deck, type PreviewInfo } from '../api'
import { MAX_BATCH, issueKey } from '../components/CheckPanel'
import { type Capture, type Pin, newPin } from '../pins'
import { slideFileFor } from './usePins'

type T = (key: string, vars?: Record<string, string | number>) => string

type Args = {
  client: Client
  selected: Deck | null
  preview: PreviewInfo | null
  t: T
  setPins: React.Dispatch<React.SetStateAction<Pin[]>>
  pinnedIssues: Set<string>
}

/** Deck check: one headless run over the deck (a polled job); each issue can become a pin. */
export function useCheck({ client, selected, preview, t, setPins, pinnedIssues }: Args) {
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

  const fixIssue = useCallback(
    (issue: CheckIssue) => {
      if (!preview) return
      const key = issueKey(issue)
      const slideFile = slideFileFor(selected, preview, issue.slideIndex)
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
    [preview, selected?.kind, selected?.entry, selected?.slidesDir, t, setPins], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // "Pin all" places at most one batch of pins (the backend accepts 50 per
  // send). Issues beyond that stay in the list, marked unpinned, to be pinned
  // once the first batch is through; the panel says how many wait.
  const [pinAllLeft, setPinAllLeft] = useState(0)
  useEffect(() => setPinAllLeft(0), [checkResult])
  const fixAllIssues = useCallback(
    (draftCount: number) => {
      if (!checkResult) return
      const todo = checkResult.issues.filter((i) => !pinnedIssues.has(issueKey(i)))
      const room = Math.max(0, MAX_BATCH - draftCount)
      for (const i of todo.slice(0, room)) fixIssue(i)
      setPinAllLeft(Math.max(0, todo.length - room))
    },
    [checkResult, pinnedIssues, fixIssue],
  )

  return { checkJob, checkResult, setCheckResult, checkError, runCheck, fixIssue, fixAllIssues, pinAllLeft }
}
