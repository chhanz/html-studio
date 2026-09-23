import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Client, SlideSource, SourceSaved } from '../api'
import { ApiError } from '../api'
import { escapeHtml, tokenizeHtml } from '../highlight'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

/** Unsaved text kept across slide switches and view changes (per slide name). */
export type Draft = { text: string; mtime: number }
export type Drafts = Map<string, Draft>

type Props = {
  t: T
  client: Client
  deckPath: string
  /** Slide display name (as in the strip). */
  slide: string
  slideNumber: number
  drafts: Drafts
  /** Bump to reload from disk (e.g. after the agent edited the deck). */
  refreshKey?: number
  onSaved: (result: SourceSaved) => void
}

type Status = 'loading' | 'clean' | 'dirty' | 'saving' | 'saved' | 'error'

const COLOR: Record<string, string> = {
  comment: 'var(--muted)',
  tag: 'var(--accent)',
  attr: 'var(--warn)',
  value: 'var(--ok)',
  entity: 'var(--danger)',
  'css-prop': 'var(--accent)',
  'css-value': 'var(--ok)',
  punct: 'var(--muted)',
}

const FONT = '12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/**
 * The slide's HTML in a textarea laid over a syntax-coloured copy of the same
 * text (same font, same metrics, no wrapping), so typing stays native (undo,
 * IME, selection) while the eye gets colours. Saves on Cmd/Ctrl+S or the button;
 * never automatically, since half-typed markup would go straight to disk and the
 * preview. A save carries the mtime the text was loaded with: when the file
 * changed meanwhile, the server refuses and the bar offers reload or overwrite.
 */
export function CodeEditor({ t, client, deckPath, slide, slideNumber, drafts, refreshKey = 0, onSaved }: Props) {
  const [source, setSource] = useState<SlideSource | null>(null)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const textRef = useRef(text)
  textRef.current = text
  const statusRef = useRef(status)
  statusRef.current = status

  /**
   * Read the slide from disk. ``quiet`` is for refreshes the app triggers (a
   * rebuild, an agent edit, our own save): no loading flicker, and when the
   * file still says what the editor shows, the status is left alone.
   */
  const load = useCallback(
    async (keepDraft: boolean, quiet = false) => {
      if (!quiet) setStatus('loading')
      setError(null)
      setConflict(false)
      try {
        const src = await client.sourceGet(deckPath, slide)
        setSource(src)
        const draft = keepDraft ? drafts.get(slide) : undefined
        if (draft && draft.text !== src.text) {
          setText(draft.text)
          setStatus('dirty')
        } else {
          drafts.delete(slide)
          setText(src.text)
          if (!quiet || src.text !== textRef.current || statusRef.current === 'loading') setStatus('clean')
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed')
        setStatus('error')
      }
    },
    [client, deckPath, slide, drafts],
  )

  // Full load when the slide changes; quiet refresh when the app says the deck changed.
  useEffect(() => {
    void load(true)
  }, [load])
  const firstRefresh = useRef(true)
  useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false
      return
    }
    void load(true, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const dirty = status === 'dirty' || (status === 'saving' && drafts.has(slide))

  const edit = (next: string) => {
    setText(next)
    if (source) {
      if (next === source.text) {
        drafts.delete(slide)
        setStatus('clean')
      } else {
        drafts.set(slide, { text: next, mtime: source.mtime })
        setStatus('dirty')
      }
    }
  }

  const save = useCallback(
    async (overwrite = false) => {
      if (!source) return
      const body = textRef.current
      setStatus('saving')
      setError(null)
      try {
        const res = await client.sourceSave(deckPath, slide, body, overwrite ? null : source.mtime)
        drafts.delete(slide)
        setSource({ ...source, text: body, mtime: res.mtime })
        setConflict(false)
        setStatus('saved')
        onSaved(res)
      } catch (e) {
        const code = e instanceof ApiError ? e.code : 'request_failed'
        if (code === 'conflict') {
          setConflict(true)
          setStatus('dirty')
          return
        }
        setError(code)
        setStatus('error')
      }
    },
    [client, deckPath, slide, source, drafts, onSaved],
  )

  // Tab indents (two spaces) instead of leaving the field. There is no save
  // shortcut: the dashboard shell owns Cmd/Ctrl+S, so the button is the way.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      const ta = e.currentTarget
      const { selectionStart, selectionEnd, value } = ta
      if (e.shiftKey) {
        // outdent the current line by up to two spaces
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
        const n = value.slice(lineStart, lineStart + 2) === '  ' ? 2 : value[lineStart] === ' ' ? 1 : 0
        if (!n) return
        const next = value.slice(0, lineStart) + value.slice(lineStart + n)
        edit(next)
        requestAnimationFrame(() => ta.setSelectionRange(Math.max(lineStart, selectionStart - n), Math.max(lineStart, selectionEnd - n)))
      } else {
        const next = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd)
        edit(next)
        requestAnimationFrame(() => ta.setSelectionRange(selectionStart + 2, selectionStart + 2))
      }
    }
  }

  const highlighted = useMemo(() => {
    const html = tokenizeHtml(text)
      .map(([kind, s]) => (kind === 'text' ? escapeHtml(s) : `<span style="color:${COLOR[kind]}${kind === 'comment' ? ';font-style:italic' : ''}">${escapeHtml(s)}</span>`))
      .join('')
    // A trailing newline needs a visible last line so both layers are the same height.
    return text.endsWith('\n') || text === '' ? html + ' ' : html
  }, [text])
  const lineCount = useMemo(() => text.split('\n').length, [text])

  // The textarea takes the highlighted layer's size (widest line, all lines), so
  // one scrolling container moves both and the gutter together.
  useLayoutEffect(() => {
    const ta = taRef.current
    const pre = preRef.current
    if (!ta || !pre) return
    ta.style.width = `${pre.offsetWidth}px`
    ta.style.height = `${pre.offsetHeight}px`
  }, [highlighted])

  const statusText =
    status === 'loading' ? t('code.loading')
    : status === 'saving' ? t('code.saving')
    : status === 'saved' ? t('code.saved')
    : status === 'dirty' ? t('code.unsaved')
    : status === 'error' ? t('code.error', { code: error ?? '' })
    : ''

  return (
    <div className="flex flex-col min-h-0 flex-1" data-testid="code-editor">
      <div className="flex items-center gap-2 mb-1 flex-none text-[12px]">
        <span className="font-medium truncate">
          {t('code.title', { n: slideNumber })}
          {dirty && <span aria-label={t('code.unsaved')}> ●</span>}
        </span>
        <span className="text-muted truncate">{source?.file ?? ''}</span>
        <span className="flex-1" />
        <span className="text-muted" role="status" aria-live="polite">
          {status === 'saving' && <Spinner />} {statusText}
        </span>
        <SmallBtn onClick={() => void load(false)} disabled={status === 'loading' || status === 'saving'} title={t('code.reload_hint')}>
          {t('code.reload')}
        </SmallBtn>
        <SmallBtn onClick={() => void save()} active={status === 'dirty'} disabled={status !== 'dirty'} title={t('code.save_hint')}>
          {t('code.save')}
        </SmallBtn>
      </div>
      {conflict && (
        <div className="flex items-center gap-2 mb-1 flex-none text-[12px] rounded-md border px-2 py-1" role="alert" style={{ borderColor: 'var(--warn)', color: 'var(--warn)' }}>
          <span className="flex-1">{t('code.conflict')}</span>
          <SmallBtn onClick={() => void load(false)}>{t('code.conflict_reload')}</SmallBtn>
          <SmallBtn danger onClick={() => void save(true)}>{t('code.conflict_overwrite')}</SmallBtn>
        </div>
      )}
      <div className="flex-1 min-h-0 rounded-md border border-border overflow-auto" style={{ background: 'var(--bg)' }}>
        <div className="flex items-start" style={{ minHeight: '100%' }}>
          <div aria-hidden className="select-none text-right flex-none px-2 py-2" style={{ font: FONT, color: 'var(--muted)', borderRight: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="relative flex-1" style={{ minWidth: 0 }}>
            <pre
              ref={preRef}
              aria-hidden
              className="m-0 px-3 py-2 inline-block"
              style={{ font: FONT, whiteSpace: 'pre', minWidth: '100%', color: 'var(--text)', tabSize: 2 }}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              wrap="off"
              disabled={status === 'loading'}
              aria-label={t('code.title', { n: slideNumber })}
              className="absolute left-0 top-0 m-0 px-3 py-2 border-0 outline-none resize-none overflow-hidden bg-transparent"
              style={{ font: FONT, whiteSpace: 'pre', color: 'transparent', caretColor: 'var(--text)', tabSize: 2, minWidth: '100%' }}
            />
          </div>
        </div>
      </div>
      <div className="text-[11px] text-muted mt-1 flex-none">{t('code.hint')}</div>
    </div>
  )
}
