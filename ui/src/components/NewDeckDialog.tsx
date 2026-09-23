import { useEffect, useMemo, useState } from 'react'
import type { Client, Deck, NewDeckRequest, NewDeckTheme } from '../api'
import { ApiError } from '../api'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  client: Client
  roots: string[]
  decks: Deck[]
  onCreated: (deck: Deck, askOutline: boolean, answers: NewDeckRequest) => void
  onClose: () => void
}

type Remembered = { presenter?: string; root?: string; themeKind?: NewDeckTheme['kind']; accent?: string; bg?: string; fg?: string; font?: string; askOutline?: boolean }
const REMEMBER_KEY = 'hs.newDeck'

function remembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER_KEY) || '{}') as Remembered
  } catch {
    return {}
  }
}

/** Folder name suggestion from the title (mirrors newdeck.slugify). */
export function slugify(title: string): string {
  const s = title
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, 60) || 'deck'
}

/**
 * The new deck wizard: one screen, three groups (deck, theme, location). The
 * backend creates the folder and files; this dialog only collects answers and
 * remembers the ones that repeat (presenter, root, theme, the outline choice).
 */
export function NewDeckDialog({ t, client, roots, decks, onCreated, onClose }: Props) {
  const mem = useMemo(remembered, [])
  const [title, setTitle] = useState('')
  const [presenter, setPresenter] = useState(mem.presenter ?? '')
  const [purpose, setPurpose] = useState('')
  const [audience, setAudience] = useState('')
  const [sources, setSources] = useState('')
  const [themeKind, setThemeKind] = useState<NewDeckTheme['kind']>(mem.themeKind ?? 'default')
  const [accent, setAccent] = useState(mem.accent ?? '#6d5efc')
  const [bg, setBg] = useState(mem.bg ?? '#ffffff')
  const [fg, setFg] = useState(mem.fg ?? '#1f2430')
  const [font, setFont] = useState(mem.font ?? '')
  const [copyFrom, setCopyFrom] = useState(decks[0]?.path ?? '')
  const [root, setRoot] = useState(roots.includes(mem.root ?? '') ? (mem.root as string) : roots[0] ?? '')
  const [folder, setFolder] = useState('')
  const [folderTouched, setFolderTouched] = useState(false)
  const [askOutline, setAskOutline] = useState(mem.askOutline ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!folderTouched) setFolder(slugify(title))
  }, [title, folderTouched])

  const themedDecks = decks.filter((d) => d.hasDesignMd || d.hasStudioJson)
  const canSubmit = title.trim() && folder.trim() && root && !busy && (themeKind !== 'copy' || copyFrom)

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const theme: NewDeckTheme =
      themeKind === 'design' ? { kind: 'design', accent, bg, fg, font: font.trim() || undefined } : themeKind === 'copy' ? { kind: 'copy', from: copyFrom } : { kind: 'default' }
    const req: NewDeckRequest = { root, folder: folder.trim(), title: title.trim(), presenter: presenter.trim(), purpose: purpose.trim(), audience: audience.trim(), sources: sources.trim(), theme }
    try {
      const res = await client.deckNew(req)
      try {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ presenter: presenter.trim(), root, themeKind, accent, bg, fg, font: font.trim(), askOutline } satisfies Remembered))
      } catch {
        /* ignore */
      }
      onCreated(res.deck, askOutline, req)
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
      setBusy(false)
    }
  }

  const input = 'rounded-md border border-border px-2 py-1 text-[13px] w-full'
  const inputStyle = { background: 'var(--bg)', color: 'var(--text)' }
  const field = (id: string, label: string, control: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[12px] text-muted">
        {label}
      </label>
      {control}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  )
  const group = (title: string, children: React.ReactNode) => (
    <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
      <legend className="text-[12px] font-semibold mb-1 p-0">{title}</legend>
      {children}
    </fieldset>
  )
  const colour = (id: string, label: string, value: string, set: (v: string) => void) => (
    <label htmlFor={id} className="flex items-center gap-2 text-[12px]">
      <input id={id} type="color" value={value} onChange={(e) => set(e.target.value)} aria-label={label} style={{ width: 28, height: 22, padding: 0, border: '1px solid var(--border)', background: 'transparent' }} />
      {label} <span className="text-muted">{value}</span>
    </label>
  )

  return (
    <div className="fixed inset-0" style={{ zIndex: 900, background: 'rgba(0,0,0,.45)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t('newdeck.title')}
        className="rounded-lg border border-border"
        style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', background: 'var(--bg)', width: 'min(720px, 92vw)', maxHeight: '88vh', boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="flex-none px-4 py-3 border-b border-border" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <div className="flex flex-col">
            <span className="font-semibold text-[14px]">{t('newdeck.title')}</span>
            <span className="text-[12px] text-muted">{t('newdeck.hint')}</span>
          </div>
          <span className="flex-1" />
          <SmallBtn type="button" onClick={onClose} disabled={busy}>
            {t('layout.close')}
          </SmallBtn>
        </div>
        <div className="px-4 py-3 overflow-auto" style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: '0 1 auto' }}>
          {group(
            t('newdeck.group_deck'),
            <>
              {field('nd-title', t('newdeck.f_title'), <input id="nd-title" className={input} style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus maxLength={200} />)}
              {field('nd-presenter', t('newdeck.f_presenter'), <input id="nd-presenter" className={input} style={inputStyle} value={presenter} onChange={(e) => setPresenter(e.target.value)} maxLength={120} />)}
              {field('nd-purpose', t('newdeck.f_purpose'), <textarea id="nd-purpose" className={input} style={{ ...inputStyle, minHeight: 48 }} value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={4000} />)}
              {field('nd-audience', t('newdeck.f_audience'), <input id="nd-audience" className={input} style={inputStyle} value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={400} />)}
              {field('nd-sources', t('newdeck.f_sources'), <textarea id="nd-sources" className={input} style={{ ...inputStyle, minHeight: 64 }} value={sources} onChange={(e) => setSources(e.target.value)} maxLength={4000} />, t('newdeck.f_sources_hint'))}
            </>,
          )}
          {group(
            t('newdeck.group_theme'),
            <>
              <div className="flex flex-wrap gap-3 text-[12px]" role="radiogroup" aria-label={t('newdeck.group_theme')}>
                {(['default', 'design', 'copy'] as const).map((k) => (
                  <label key={k} className="inline-flex items-center gap-1">
                    <input type="radio" name="theme" value={k} checked={themeKind === k} onChange={() => setThemeKind(k)} disabled={k === 'copy' && !themedDecks.length} />
                    {t(`newdeck.theme_${k}`)}
                  </label>
                ))}
              </div>
              {themeKind === 'design' && (
                <div className="flex flex-wrap gap-4 items-center">
                  {colour('nd-accent', t('newdeck.c_accent'), accent, setAccent)}
                  {colour('nd-bg', t('newdeck.c_bg'), bg, setBg)}
                  {colour('nd-fg', t('newdeck.c_fg'), fg, setFg)}
                  <label htmlFor="nd-font" className="flex items-center gap-2 text-[12px]">
                    {t('newdeck.c_font')}
                    <input id="nd-font" className="rounded-md border border-border px-2 py-1 text-[12px]" style={{ ...inputStyle, width: 160 }} value={font} onChange={(e) => setFont(e.target.value)} placeholder="Pretendard" maxLength={80} />
                  </label>
                </div>
              )}
              {themeKind === 'copy' && (
                <select className={input} style={inputStyle} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} aria-label={t('newdeck.theme_copy_from')}>
                  {themedDecks.map((d) => (
                    <option key={d.path} value={d.path}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </>,
          )}
          {group(
            t('newdeck.group_where'),
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-1" style={{ flex: '1 1 260px' }}>
                <label htmlFor="nd-root" className="text-[12px] text-muted">
                  {t('newdeck.f_root')}
                </label>
                <select id="nd-root" className={input} style={inputStyle} value={root} onChange={(e) => setRoot(e.target.value)}>
                  {roots.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/^\/Users\/[^/]+|^\/home\/[^/]+/, '~')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1" style={{ flex: '1 1 200px' }}>
                <label htmlFor="nd-folder" className="text-[12px] text-muted">
                  {t('newdeck.f_folder')}
                </label>
                <input
                  id="nd-folder"
                  className={input}
                  style={inputStyle}
                  value={folder}
                  onChange={(e) => {
                    setFolderTouched(true)
                    setFolder(e.target.value)
                  }}
                  maxLength={80}
                />
              </div>
            </div>,
          )}
          <label className="inline-flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={askOutline} onChange={(e) => setAskOutline(e.target.checked)} />
            {t('newdeck.ask_outline')}
          </label>
          {error && (
            <p className="m-0 text-[12px]" role="alert" style={{ color: 'var(--danger)' }}>
              {t(`newdeck.err_${error}`) === `newdeck.err_${error}` ? t('error.generic', { code: error }) : t(`newdeck.err_${error}`)}
            </p>
          )}
        </div>
        <div className="flex-none px-4 py-3 border-t border-border" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span className="flex-1" />
          {busy && <Spinner />}
          <SmallBtn type="submit" active disabled={!canSubmit}>
            {t('newdeck.create')}
          </SmallBtn>
        </div>
      </form>
    </div>
  )
}
