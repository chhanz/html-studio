import { useEffect, useMemo, useRef, useState } from 'react'
import type { Rebuild, Client, DesignInfo, TweakInfo, TweakItem } from '../api'
import { ApiError } from '../api'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  client: Client
  deckPath: string
  /** DESIGN.md / tokens.css state, when the deck has a DESIGN.md. */
  design?: DesignInfo | null
  /** Write (or refresh) tokens.css from DESIGN.md without other changes. */
  onWriteTokens?: () => void
  tokensBusy?: boolean
  /** Called after the preview server accepted new overrides (bump reloadKey). */
  onPreview: () => void
  /** Called after Apply wrote tokens.css (refresh design info, preview). */
  /** Changes were written; ``rebuild`` is what the backend did about the built output. */
  onApplied: (rebuild?: Rebuild) => void
  onClose: () => void
}

const GROUP_ORDER = ['colors', 'font', 'typography', 'spacing', 'rounded']

function splitLength(v: string): { n: number; unit: string } | null {
  const m = /^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh)?$/.exec(v.trim())
  return m ? { n: Number(m[1]), unit: m[2] ?? '' } : null
}

/**
 * Theme tweaks for the open deck. Every control is one CSS variable the deck's
 * tokens.css (or the default theme) reads. Moving a control posts the whole
 * set of changed values to the preview server, which prints them into every
 * slide page, so the strip and the viewer follow at once; nothing is written
 * until Apply, which updates DESIGN.md and regenerates tokens.css.
 */
export function TweakPanel({ t, client, deckPath, design, onWriteTokens, tokensBusy = false, onPreview, onApplied, onClose }: Props) {
  const [info, setInfo] = useState<TweakInfo | null>(null)
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = () =>
    client
      .tweakInfo(deckPath)
      .then((i) => {
        setInfo(i)
        setError(null)
      })
      .catch((e) => setError(e instanceof ApiError ? e.code : 'request_failed'))
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckPath])

  // Debounced live preview: colour pickers fire on every pixel of drag.
  const pushPreview = (next: Record<string, string>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void client
        .tweakPreview(deckPath, next)
        .then(() => onPreview())
        .catch((e) => setError(e instanceof ApiError ? e.code : 'request_failed'))
    }, 120)
  }
  const set = (item: TweakItem, value: string) => {
    setApplied(false)
    const next = { ...changes }
    if (value.trim() === item.value.trim()) delete next[item.var]
    else next[item.var] = value
    setChanges(next)
    pushPreview(next)
  }
  const revertAll = () => {
    if (timer.current) clearTimeout(timer.current)
    setChanges({})
    setApplied(false)
    pushPreview({})
  }
  const apply = async () => {
    // A debounced preview push must not land after the apply and resurrect the override.
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setApplying(true)
    setError(null)
    try {
      const res = await client.tweakApply(deckPath, changes)
      setChanges({})
      setApplied(true)
      onApplied(res.rebuild)
      await load()
    } catch (e) {
      setError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setApplying(false)
    }
  }
  // Leaving the panel drops live overrides (files are untouched either way).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      void client.tweakPreview(deckPath, {}).then(() => onPreview()).catch(() => undefined)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deckPath],
  )

  const groups = useMemo(() => {
    const by: Record<string, TweakItem[]> = {}
    for (const it of info?.items ?? []) (by[it.group] ||= []).push(it)
    return GROUP_ORDER.filter((g) => by[g]?.length).map((g) => [g, by[g]] as const)
  }, [info])
  const dirty = Object.keys(changes).length

  const control = (item: TweakItem) => {
    const value = changes[item.var] ?? item.value
    const changed = item.var in changes
    if (item.kind === 'color') {
      const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
      return (
        <input type="color" value={hex} onChange={(e) => set(item, e.target.value)} aria-label={item.name} style={{ width: 34, height: 24, padding: 0, border: `1px solid ${changed ? 'var(--accent)' : 'var(--border)'}`, background: 'transparent' }} />
      )
    }
    if (item.kind === 'length') {
      const base = splitLength(item.value)
      const cur = splitLength(value) ?? base
      if (base && cur) {
        const max = Math.max(Math.abs(base.n) * 2, base.n === 0 ? 100 : 1)
        const step = base.unit === 'rem' || base.unit === 'em' ? 0.05 : 1
        return (
          <span className="inline-flex items-center gap-2">
            <input type="range" min={0} max={max} step={step} value={cur.n} onChange={(e) => set(item, `${e.target.value}${base.unit}`)} aria-label={item.name} style={{ width: 110 }} />
            <input
              type="number"
              step={step}
              value={cur.n}
              onChange={(e) => set(item, `${e.target.value}${base.unit}`)}
              aria-label={`${item.name} value`}
              className="rounded border border-border px-1 text-[12px]"
              style={{ width: 64, background: 'var(--bg)', color: 'var(--text)' }}
            />
            <span className="text-muted text-[11px]">{base.unit}</span>
          </span>
        )
      }
    }
    return <input value={value} onChange={(e) => set(item, e.target.value)} aria-label={item.name} className="rounded border border-border px-1 text-[12px]" style={{ width: 150, background: 'var(--bg)', color: 'var(--text)' }} />
  }

  return (
    <div className="flex flex-col min-h-0 h-full text-[12px]" data-testid="tweak-panel" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
      <div className="flex items-center gap-2 mb-2 flex-none">
        <span className="font-semibold text-[13px]">{t('tweak.title')}</span>
        <span className="flex-1" />
        <SmallBtn onClick={onClose}>{t('layout.close')}</SmallBtn>
      </div>
      <p className="m-0 mb-2 text-muted flex-none">{info?.hasDesign ? t('tweak.hint_design') : t('tweak.hint_default')}</p>
      {info?.hasDesign && info.layered && <p className="m-0 mb-2 text-muted flex-none">{t('tweak.hint_layered', { css: info.css ?? '' })}</p>}
      {info?.hasDesign && design && !design.empty && (!design.tokensExists || design.tokensStale || (info.css !== 'tokens.css' && !info.layered)) && (
        <div className="mb-2 flex-none flex items-center gap-2 flex-wrap rounded-md border px-2 py-1" style={{ borderColor: 'var(--warn)' }}>
          <span style={{ color: 'var(--warn)' }}>{!design.tokensExists ? t('theme.tokens.missing') : design.tokensStale ? t('theme.tokens.stale') : t('tweak.hint_no_tokens')}</span>
          {onWriteTokens && (
            <SmallBtn onClick={onWriteTokens} disabled={tokensBusy || applying} className="inline-flex items-center gap-1" title={t('theme.tokens.hint')}>
              {tokensBusy && <Spinner />}
              {!design.tokensExists ? t('theme.tokens.write') : t('theme.tokens.update')}
            </SmallBtn>
          )}
        </div>
      )}
      {error && (
        <p className="m-0 mb-2" role="alert" style={{ color: 'var(--danger)' }}>
          {t('error.generic', { code: error })}
        </p>
      )}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-3 pr-1">
        {!info && !error && (
          <span className="inline-flex items-center gap-2 text-muted">
            <Spinner /> {t('viewer.loading')}
          </span>
        )}
        {groups.map(([g, items]) => (
          <div key={g}>
            <div className="font-medium mb-1">{t(`tweak.group_${g}`)}</div>
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const changed = item.var in changes
                return (
                  <div key={item.var} className="flex items-center gap-2" data-testid="tweak-item" data-var={item.var} data-changed={changed ? 'true' : undefined}>
                    <span className="truncate" style={{ width: 120, color: changed ? 'var(--accent)' : undefined }} title={item.var}>
                      {changed ? '● ' : ''}
                      {item.name}
                    </span>
                    {control(item)}
                    {changed && (
                      <SmallBtn onClick={() => set(item, item.value)} aria-label={t('tweak.revert_one', { name: item.name })} style={{ padding: '0 6px' }}>
                        ↺
                      </SmallBtn>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 flex-none flex-wrap">
        <SmallBtn onClick={() => void apply()} active disabled={!dirty || applying}>
          {t('tweak.apply')}
        </SmallBtn>
        <SmallBtn onClick={revertAll} disabled={!dirty || applying}>
          {t('tweak.revert_all')}
        </SmallBtn>
        {applying && <Spinner />}
        <span className="text-muted" role="status">
          {applying ? t('tweak.applying') : applied ? t('tweak.applied') : dirty ? t('tweak.dirty', { n: dirty }) : ''}
        </span>
      </div>
      <p className="m-0 mt-1 text-[11px] text-muted flex-none">{t('tweak.note')}</p>
    </div>
  )
}
