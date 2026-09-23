import type { DesignInfo } from '../api'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  info: DesignInfo
  /** Opens the theme panel, which owns tokens.css generation and edits. */
  onOpenTheme: () => void
}

// Colours worth showing as swatches, in priority order; the rest are counted.
const SWATCH_ORDER = ['primary', 'secondary', 'accent', 'canvas-soft', 'canvas', 'surface', 'ink', 'hairline']

/**
 * One quiet line under the toolbar when the deck has a DESIGN.md: its name,
 * key colours and font. Clicking it opens the theme panel; a small marker says
 * when tokens.css is missing or behind DESIGN.md.
 */
export function ThemeRow({ t, info, onOpenTheme }: Props) {
  const d = info.design
  if (!info.present || !d || info.empty) return null
  const names = Object.keys(d.colors)
  const shown = [...SWATCH_ORDER.filter((n) => n in d.colors), ...names.filter((n) => !SWATCH_ORDER.includes(n))].slice(0, 8)
  const more = names.length - shown.length
  const state = !info.tokensExists ? 'missing' : info.tokensStale ? 'stale' : 'fresh'

  return (
    <button
      type="button"
      onClick={onOpenTheme}
      className="mb-2 flex-none flex items-center gap-2 flex-wrap text-[12px] text-muted bg-transparent border-0 p-0 cursor-pointer hover:text-text text-left"
      data-testid="theme-row"
      data-tokens={state}
      title={t('theme.row_hint')}
    >
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
      {state !== 'fresh' && (
        <span className="inline-flex items-center gap-1" style={{ color: 'var(--warn)' }}>
          <span aria-hidden className="inline-block rounded-full" style={{ width: 6, height: 6, background: 'var(--warn)' }} />
          {state === 'missing' ? t('theme.tokens.missing') : t('theme.tokens.stale')}
        </span>
      )}
    </button>
  )
}
