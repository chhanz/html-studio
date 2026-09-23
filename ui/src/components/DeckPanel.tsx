import { useState } from 'react'
import type { Deck } from '../api'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  locale: string
  roots: string[]
  decks: Deck[]
  selectedId: string | null
  loading: boolean
  error: string | null
  errorDetail?: string | null
  pickerSupported: boolean
  connected: boolean
  onSelect: (deck: Deck) => void
  onAddRoot: (path?: string) => Promise<void>
  onRemoveRoot: (path: string) => Promise<void>
  onRefresh: () => Promise<void>
  /** Open the new deck wizard (needs at least one folder). */
  onNew?: () => void
}

function shortPath(p: string): string {
  return p.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, '~')
}

function fmtDate(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(ts * 1000)
  } catch {
    return new Date(ts * 1000).toLocaleString()
  }
}

/**
 * The deck list. Two layers, kept visually apart: the FOLDERS the studio scans
 * (a one-line summary with a Manage toggle; registering a folder is a setup
 * step done once) and the DECKS found in them, with New deck as the one
 * primary action. With no folder yet, the list area explains that both finding
 * and creating decks need a folder, and offers to register one right there.
 * There is no Refresh button: the list re-scans by itself.
 */
export function DeckPanel(p: Props) {
  const { t } = p
  const [manage, setManage] = useState(false)
  const [typing, setTyping] = useState(false)
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)

  const submitPath = async () => {
    if (!path.trim()) return
    setBusy(true)
    try {
      await p.onAddRoot(path.trim())
      setPath('')
      setTyping(false)
    } finally {
      setBusy(false)
    }
  }

  const pick = async () => {
    setBusy(true)
    try {
      await p.onAddRoot()
    } finally {
      setBusy(false)
    }
  }

  // Register a folder: the OS picker where available, a typed path otherwise.
  const registerButton = (primary: boolean) =>
    p.pickerSupported ? (
      <SmallBtn onClick={pick} disabled={busy || !p.connected} active={primary} className="inline-flex items-center gap-1.5" data-testid="folder-register">
        {busy && <Spinner />}
        {busy ? t('roots.picking') : t('roots.add')}
      </SmallBtn>
    ) : (
      <SmallBtn onClick={() => setTyping((v) => !v)} active={primary || typing} disabled={busy || !p.connected} data-testid="folder-register">
        {t('roots.add')}
      </SmallBtn>
    )
  const pathForm = typing && (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        void submitPath()
      }}
    >
      <input
        autoFocus
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder={t('roots.path_placeholder')}
        aria-label={t('roots.add')}
        className="flex-1 min-w-0 px-2 py-1 rounded-md border text-[12px]"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
      />
      <SmallBtn active type="submit" disabled={busy || !path.trim()}>
        {t('roots.confirm')}
      </SmallBtn>
    </form>
  )

  const hasRoots = p.roots.length > 0

  return (
    <div className="flex flex-col gap-2 text-[13px]">
      {/* Folders: one quiet line, details behind Manage */}
      {hasRoots && (
        <div className="flex flex-col gap-1" data-testid="folders">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            <span className="truncate flex-1" title={p.roots.join('\n')}>
              {t('roots.summary', { first: shortPath(p.roots[0]), more: p.roots.length - 1 })}
              {p.roots.length > 1 ? ` (+${p.roots.length - 1})` : ''}
            </span>
            <SmallBtn onClick={() => setManage((v) => !v)} active={manage} aria-expanded={manage} aria-controls="folders-body" style={{ padding: '0 6px' }}>
              {t('roots.manage')}
            </SmallBtn>
          </div>
          {manage && (
            <div id="folders-body" className="flex flex-col gap-1 rounded-md border border-border p-2">
              <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                {p.roots.map((r) => (
                  <li key={r} className="flex items-center gap-2 text-[12px] text-muted" title={r}>
                    <span className="truncate flex-1">{shortPath(r)}</span>
                    <SmallBtn danger onClick={() => p.onRemoveRoot(r)} aria-label={`${t('roots.remove')} ${r}`} style={{ padding: '0 6px' }}>
                      {t('roots.remove')}
                    </SmallBtn>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-1">
                {registerButton(false)}
                <SmallBtn onClick={() => p.onRefresh()} disabled={busy || p.loading || !p.connected} className="inline-flex items-center gap-1.5" title={t('roots.rescan_hint')}>
                  {p.loading && !busy && <Spinner />}
                  {t('roots.rescan')}
                </SmallBtn>
              </div>
              {pathForm}
              <p className="m-0 text-[11px] text-muted">{t('roots.hint')}</p>
            </div>
          )}
        </div>
      )}

      {/* The one primary action */}
      {hasRoots && p.onNew && (
        <SmallBtn onClick={p.onNew} disabled={busy || !p.connected} active data-testid="deck-new" className="self-start">
          {t('newdeck.button')}
        </SmallBtn>
      )}

      {p.error && (
        <p className="m-0 text-[12px]" style={{ color: 'var(--danger)' }} role="alert">
          {t(`error.${p.error}`) === `error.${p.error}` ? t('error.generic', { code: p.error }) : t(`error.${p.error}`)}
          {p.errorDetail && t(`error.${p.error}`) === `error.${p.error}` ? (
            <span className="block text-muted break-all">{p.errorDetail}</span>
          ) : null}
        </p>
      )}

      {/* Deck list, or the empty state that explains why a folder comes first */}
      {!p.connected ? (
        <p className="m-0 text-muted inline-flex items-center gap-2">
          <Spinner /> {t('status.connecting')}
        </p>
      ) : !hasRoots ? (
        <div className="flex flex-col gap-2 rounded-md border p-3" style={{ borderStyle: 'dashed' }} data-testid="folders-empty">
          <p className="m-0 text-muted">{t('panel.decks.empty')}</p>
          <div>{registerButton(true)}</div>
          {pathForm}
        </div>
      ) : p.loading && p.decks.length === 0 ? (
        <p className="m-0 text-muted">{t('decks.loading')}</p>
      ) : p.decks.length === 0 ? (
        <p className="m-0 text-muted">{t('decks.none_found')}</p>
      ) : (
        <ul className="flex flex-col gap-1 m-0 p-0 list-none" role="listbox" aria-label={t('panel.decks')}>
          {p.decks.map((d) => {
            const selected = d.id === p.selectedId
            return (
              <li key={d.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => p.onSelect(d)}
                  title={d.path}
                  className="w-full text-left px-2 py-1.5 rounded-md border cursor-pointer transition-all"
                  style={{
                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                    background: selected ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate flex-1">{d.name}</span>
                    <span className="text-[11px] text-muted whitespace-nowrap">
                      {t('decks.slide_count', { n: d.slideCount })}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted truncate">
                    {fmtDate(d.modifiedAt, p.locale)}
                    {d.kind === 'single' ? ` · ${t('decks.kind.single')}` : ''}
                    {d.hasDesignMd ? ' · DESIGN.md' : ''}
                    {d.hasStudioJson ? ' · studio.json' : ''}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
