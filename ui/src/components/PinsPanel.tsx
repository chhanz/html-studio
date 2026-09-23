import { elementLabel, type Pin } from '../pins'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  pins: Pin[]
  current: number
  activeId: string | null
  onComment: (id: string, comment: string) => void
  onRemove: (id: string) => void
  onJump: (slideIndex: number, id: string) => void
  onClearAll: () => void
}

const STATUS_COLOR: Record<Pin['status'], string> = {
  new: 'var(--accent)',
  sent: 'var(--warn)',
  done: 'var(--ok)',
  question: 'var(--danger)',
}

/**
 * Pins gathered across slides. Each row is one comment on one element; the
 * marker number matches the badge drawn on the slide. Sending them to the
 * agent is P2-3; this panel is the draft list.
 */
export function PinsPanel({ t, pins, current, activeId, onComment, onRemove, onJump, onClearAll }: Props) {
  if (pins.length === 0) return null
  return (
    <div className="mt-2 flex-none rounded-md border border-border p-2 text-[12px]" data-testid="pins-panel" style={{ maxHeight: '40%', overflowY: 'auto' }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-text">{t('pins.title', { n: pins.length })}</span>
        <span className="text-muted">{t('pins.hint')}</span>
        <SmallBtn className="ml-auto" onClick={onClearAll}>{t('pins.clear')}</SmallBtn>
      </div>
      <ul className="flex flex-col gap-1">
        {pins.map((p) => (
          <li
            key={p.id}
            data-testid="pin"
            data-pin-id={p.id}
            data-status={p.status}
            data-how={p.how ?? ''}
            className="flex items-start gap-2 rounded-md p-1"
            style={{ background: p.id === activeId ? 'var(--bg-hover)' : undefined }}
          >
            <button
              type="button"
              onClick={() => onJump(p.slideIndex, p.id)}
              className="flex-none rounded-full text-white text-[11px] font-semibold"
              style={{ width: 20, height: 20, lineHeight: '20px', background: STATUS_COLOR[p.status], textAlign: 'center' }}
              title={t('pins.jump', { n: p.slideIndex + 1 })}
              aria-label={t('pins.jump', { n: p.slideIndex + 1 })}
            >
              {p.index}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-muted truncate">
                <span className="text-text">{p.slideFile}</span>
                <span className="truncate" title={p.selector}>{elementLabel(p)}</span>
                {p.text && <span className="truncate">"{p.text}"</span>}
                {p.slideIndex === current && p.how && p.how !== 'cid' && p.how !== 'selector' && (
                  <span style={{ color: 'var(--warn)' }}>{p.how === 'lost' ? t('pins.lost') : t('pins.moved')}</span>
                )}
              </div>
              <input
                type="text"
                value={p.comment}
                onChange={(e) => onComment(p.id, e.target.value)}
                placeholder={t('pins.placeholder')}
                aria-label={t('pins.comment_for', { n: p.index })}
                autoFocus={p.id === activeId && !p.comment}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
              />
            </div>
            <SmallBtn onClick={() => onRemove(p.id)} aria-label={t('pins.remove')} title={t('pins.remove')}>
              ×
            </SmallBtn>
          </li>
        ))}
      </ul>
    </div>
  )
}
