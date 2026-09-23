import { useEffect, useRef, useState } from 'react'
import type { Client, NotesIndex } from '../api'
import { ApiError } from '../api'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  client: Client
  deckPath: string
  /** Display name of the current slide (as in the strip). */
  slide: string
  slideNumber: number
  open: boolean
  onToggle: () => void
  /** Called after a save so the strip can refresh its note markers. */
  onChanged: (index: NotesIndex) => void
  /** Bump to reload the note text (e.g. the agent wrote notes). */
  refreshKey?: number
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/**
 * Speaker notes for the current slide: a plain Markdown textarea backed by
 * notes/<slide>.md. Saves 800ms after the last keystroke (and on blur), so
 * there is no Save button to forget. Notes never reach the slide HTML.
 */
export function NotesPanel({ t, client, deckPath, slide, slideNumber, open, onToggle, onChanged, refreshKey = 0 }: Props) {
  const [text, setText] = useState('')
  const [file, setFile] = useState('')
  const [loading, setLoading] = useState(false)
  const [save, setSave] = useState<SaveState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [orphans, setOrphans] = useState<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ deckPath, slide, text: '' })

  // Load on slide change (flush a pending save for the previous slide first).
  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
      const prev = latest.current
      if (prev.deckPath && prev.slide) void client.noteSave(prev.deckPath, prev.slide, prev.text).catch(() => undefined)
    }
    let alive = true
    setLoading(true)
    setSave('idle')
    setError(null)
    Promise.all([client.noteGet(deckPath, slide), client.notesIndex(deckPath)])
      .then(([n, idx]) => {
        if (!alive) return
        setText(n.text)
        setFile(n.file)
        latest.current = { deckPath, slide, text: n.text }
        setOrphans(idx.orphans)
        onChanged(idx)
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.code : 'request_failed'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, deckPath, slide, refreshKey])

  const persist = async (value: string) => {
    setSave('saving')
    try {
      await client.noteSave(deckPath, slide, value)
      const idx = await client.notesIndex(deckPath)
      setOrphans(idx.orphans)
      onChanged(idx)
      setSave('saved')
    } catch (e) {
      setSave('error')
      setError(e instanceof ApiError ? e.code : 'request_failed')
    }
  }
  const onChange = (value: string) => {
    setText(value)
    latest.current = { deckPath, slide, text: value }
    setSave('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void persist(value)
    }, 800)
  }
  const flush = () => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    void persist(latest.current.text)
  }
  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const status =
    save === 'saving' ? t('notes.saving') : save === 'saved' ? t('notes.saved') : save === 'dirty' ? t('notes.unsaved') : save === 'error' ? t('notes.save_failed') : ''
  return (
    <div className="hs-fill min-h-0 flex flex-col" data-testid="notes-panel" data-save={save}>
      <div className="flex items-center gap-2 flex-none">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="notes-body"
          title={t('notes.tagline')}
          className="flex-1 min-w-0 flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[15px] font-semibold text-text-strong hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left"
        >
          <span aria-hidden className="inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
            ▸
          </span>
          {t('notes.title', { n: slideNumber })}
          <span className="font-normal text-[12px] text-muted truncate ml-1" title={t('notes.tagline')}>{open ? file : text.trim() ? t('notes.has') : ''}</span>
        </button>
        <span className="flex-none text-[12px] text-muted inline-flex items-center gap-1" role="status">
          {(loading || save === 'saving') && <Spinner />}
          {status}
        </span>
      </div>
      {open && (
        <div id="notes-body" className="hs-fill min-h-0 flex flex-col mt-1 gap-1">
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onBlur={flush}
            disabled={loading}
            placeholder={t('notes.placeholder')}
            aria-label={t('notes.title', { n: slideNumber })}
            spellCheck={false}
            className="hs-fill min-h-0 w-full resize-none rounded-md border border-border bg-bg px-2 py-1 text-[13px] text-text font-mono"
            style={{ minHeight: 96, lineHeight: 1.5 }}
          />
          <div className="flex items-center gap-2 text-[11px] text-muted flex-none flex-wrap">
            <span>{t('notes.hint')}</span>
            {error && <span style={{ color: 'var(--danger)' }}>{t(`error.${error}`) === `error.${error}` ? t('error.generic', { code: error }) : t(`error.${error}`)}</span>}
            {orphans.length > 0 && (
              <span className="ml-auto" title={orphans.join(', ')} data-testid="notes-orphans">
                {t('notes.orphans', { n: orphans.length })}
                <SmallBtn className="ml-1" onClick={() => void client.reveal(deckPath, `notes/${orphans[0]}`).catch(() => undefined)}>
                  {t('notes.show')}
                </SmallBtn>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
