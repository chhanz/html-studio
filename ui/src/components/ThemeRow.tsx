import type { DesignInfo } from '../api'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  info: DesignInfo
  busy: boolean
  onWriteTokens: () => void
}

// Colours worth showing as swatches, in priority order; the rest are counted.
const SWATCH_ORDER = ['primary', 'secondary', 'accent', 'canvas-soft', 'canvas', 'surface', 'ink', 'hairline']

/**
 * One line under the toolbar when the deck has a DESIGN.md: what the theme is
 * (name, key colours, font) and the tokens.css state with a button to write or
 * refresh it. Writing a file into the deck is always an explicit click.
 */
export function ThemeRow({ t, info, busy, onWriteTokens }: Props) {
  const d = info.design
  if (!info.present || !d) return null
  const names = Object.keys(d.colors)
  const shown = [...SWATCH_ORDER.filter((n) => n in d.colors), ...names.filter((n) => !SWATCH_ORDER.includes(n))].slice(0, 8)
  const more = names.length - shown.length
  const state = !info.tokensExists ? 'missing' : info.tokensStale ? 'stale' : 'fresh'
  const ownCss = info.css && info.css !== info.tokens

  return (
    <div className="mb-2 flex-none flex items-center gap-2 flex-wrap text-[12px] text-muted" data-testid="theme-row" data-tokens={state}>
      <span className="font-medium text-text">{d.name || 'DESIGN.md'}</span>
      <span className="inline-flex items-center gap-1" aria-label={t('theme.colors')}>
        {shown.map((n) => (
          <span
            key={n}
            title={`${n} ${d.colors[n]}`}
            data-testid="theme-swatch"
            data-name={n}
            className="inline-block rounded-sm border border-border"
            style={{ width: 14, height: 14, background: d.colors[n] }}
          />
        ))}
        {more > 0 && <span>+{more}</span>}
      </span>
      {d.font.family && <span className="truncate">{d.font.family}</span>}
      <span className="ml-auto inline-flex items-center gap-2">
        {info.empty ? (
          <span>{t('theme.empty')}</span>
        ) : (
          <>
            <span>{state === 'missing' ? t('theme.tokens.missing') : state === 'stale' ? t('theme.tokens.stale') : t('theme.tokens.fresh')}</span>
            <SmallBtn onClick={onWriteTokens} disabled={busy} title={ownCss ? t('theme.tokens.own_css_hint', { css: info.css! }) : t('theme.tokens.hint')} className="inline-flex items-center gap-1">
              {busy && <Spinner />}
              {state === 'missing' ? t('theme.tokens.write') : t('theme.tokens.update')}
            </SmallBtn>
          </>
        )}
      </span>
    </div>
  )
}
