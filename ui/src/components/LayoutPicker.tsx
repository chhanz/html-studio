import { useEffect, useRef, useState } from 'react'
import type { Client, Layout, PreviewInfo } from '../api'
import { ApiError } from '../api'
import { SlideFrame } from './SlideFrame'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  client: Client
  preview: PreviewInfo
  /**
   * 'insert': pick a layout to add after ``after``.
   * 'save': name the current slide (``saveSlide``) and store it as a layout.
   */
  mode: 'insert' | 'save'
  after: string | null
  saveSlide?: string
  deckPath: string
  busy: boolean
  onPick: (layoutId: string, after: string | null) => void
  onClose: () => void
}

/**
 * The layout library as a dialog. Thumbnails are the preview server's
 * ``/layout/<id>`` pages, so every template is shown in THIS deck's stylesheet.
 * Built-ins come first, then the user's saved layouts (deletable). In 'save'
 * mode the same dialog shows the slide to be saved and asks for a name.
 */
export function LayoutPicker({ t, client, preview, mode, after, saveSlide, deckPath, busy, onPick, onClose }: Props) {
  const [items, setItems] = useState<Layout[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const load = () =>
    client
      .layouts()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiError ? e.code : 'request_failed'))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (mode === 'save') nameRef.current?.focus()
  }, [mode])

  const save = async () => {
    if (!saveSlide || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const entry = await client.layoutSave(deckPath, saveSlide, name.trim())
      setSavedAs(entry.name)
      setName('')
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setSaving(false)
    }
  }
  const remove = async (id: string) => {
    setError(null)
    try {
      await client.layoutDelete(id)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
    }
  }
  const label = (l: Layout) => (l.builtin ? t(`layout.${l.id}`) : l.name ?? l.id)
  const builtins = items?.filter((l) => l.builtin) ?? []
  const mine = items?.filter((l) => !l.builtin) ?? []

  const grid = (list: Layout[]) => (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {list.map((l) => (
        <div key={l.id} className="flex flex-col gap-1" data-testid="layout-card" data-layout={l.id}>
          <button
            type="button"
            disabled={busy || mode === 'save'}
            onClick={() => onPick(l.id, after)}
            aria-label={t('layout.insert', { name: label(l) })}
            className="rounded-md p-1 bg-transparent cursor-pointer text-left"
            style={{ border: '2px solid var(--border)' }}
          >
            <SlideFrame src={`${preview.baseUrl}/layout/${l.id}`} stageWidth={preview.stage.width} stageHeight={preview.stage.height} title={label(l)} className="rounded-sm" />
          </button>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="truncate">{label(l)}</span>
            {!l.builtin && (
              <SmallBtn danger className="ml-auto" onClick={() => void remove(l.id)} disabled={busy} aria-label={t('layout.delete', { name: label(l) })}>
                {t('layout.delete_short')}
              </SmallBtn>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0" style={{ zIndex: 900, background: 'rgba(0,0,0,.45)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'save' ? t('layout.save_title') : t('layout.title')}
        className="rounded-lg border border-border"
        style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', background: 'var(--bg)', width: 'min(920px, 92vw)', height: 'auto', maxHeight: '86vh', boxShadow: '0 12px 40px rgba(0,0,0,.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none px-4 py-3 border-b border-border" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
          <div className="flex flex-col">
            <span className="font-semibold text-[14px]">{mode === 'save' ? t('layout.save_title') : t('layout.title')}</span>
            <span className="text-[12px] text-muted">{mode === 'save' ? t('layout.save_hint') : t('layout.hint')}</span>
          </div>
          <span className="flex-1" />
          {busy && <Spinner />}
          <SmallBtn onClick={onClose}>{t('layout.close')}</SmallBtn>
        </div>
        <div className="px-4 py-3 overflow-auto flex-1 min-h-0" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '0 1 auto' }}>
          {error && (
            <p className="m-0 text-[12px]" role="alert" style={{ color: 'var(--danger)' }}>
              {t('error.generic', { code: error })}
            </p>
          )}
          {mode === 'save' && saveSlide && (
            <div className="flex gap-4 items-start">
              <div style={{ width: 260, flex: 'none' }}>
                <SlideFrame src={`${preview.baseUrl}/slide/${preview.slides.indexOf(saveSlide)}`} stageWidth={preview.stage.width} stageHeight={preview.stage.height} title={saveSlide} className="rounded-sm border border-border" />
              </div>
              <form
                className="flex flex-col gap-2 flex-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save()
                }}
              >
                <label className="text-[12px] text-muted" htmlFor="layout-name">
                  {t('layout.name_label')}
                </label>
                <input
                  id="layout-name"
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="rounded-md border border-border px-2 py-1 text-[13px]"
                  style={{ background: 'var(--bg)', color: 'var(--text)' }}
                  placeholder={t('layout.name_placeholder')}
                />
                <div className="flex items-center gap-2">
                  <SmallBtn type="submit" active disabled={saving || !name.trim()}>
                    {t('layout.save')}
                  </SmallBtn>
                  {saving && <Spinner />}
                  {savedAs && (
                    <span className="text-[12px]" role="status" style={{ color: 'var(--ok)' }}>
                      {t('layout.saved', { name: savedAs })}
                    </span>
                  )}
                </div>
                <p className="m-0 text-[11px] text-muted">{t('layout.save_note')}</p>
              </form>
            </div>
          )}
          {items === null && !error ? (
            <p className="m-0 text-[12px] text-muted inline-flex items-center gap-2">
              <Spinner /> {t('viewer.loading')}
            </p>
          ) : (
            <>
              <div>
                <div className="text-[12px] font-medium mb-2">{t('layout.builtin')}</div>
                {grid(builtins)}
              </div>
              <div>
                <div className="text-[12px] font-medium mb-2">{t('layout.mine')}</div>
                {mine.length ? grid(mine) : <p className="m-0 text-[12px] text-muted">{t('layout.mine_empty')}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
