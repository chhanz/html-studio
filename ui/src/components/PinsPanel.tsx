import { useState } from 'react'
import { elementLabel, type Pin } from '../pins'
import { MAX_BATCH } from './CheckPanel'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  pins: Pin[]
  current: number
  activeId: string | null
  sending: boolean
  sendError: string | null
  /** Drafts the last send left behind (one batch at a time). */
  sendLeft: number
  onComment: (id: string, comment: string) => void
  onRemove: (id: string) => void
  onJump: (slideIndex: number, id: string) => void
  onClearAll: () => void
  onSend: () => void
  onReply: (id: string, text: string) => void
  onDismissDone: () => void
}

const STATUS_COLOR: Record<Pin['status'], string> = {
  new: 'var(--accent)',
  sent: 'var(--warn)',
  done: 'var(--ok)',
  question: 'var(--danger)',
}

/**
 * Pins gathered across slides. Each row is one comment on one element; the
 * marker number matches the badge drawn on the slide. Drafts are sent to the
 * deck's chat session as one batch; the agent's per-pin reports come back as a
 * status and a short thread, and questions can be answered inline.
 */
export function PinsPanel({ t, pins, current, activeId, sending, sendError, sendLeft, onComment, onRemove, onJump, onClearAll, onSend, onReply, onDismissDone }: Props) {
  if (pins.length === 0) return null
  const drafts = pins.filter((p) => p.status === 'new')
  const missing = drafts.some((p) => !p.comment.trim())
  const finished = pins.filter((p) => p.status === 'done')
  const over = drafts.length > MAX_BATCH
  const sendNow = Math.min(drafts.length, MAX_BATCH)
  return (
    <div className="mt-2 rounded-md border border-border p-2 text-[12px]" data-testid="pins-panel" style={{ flex: '0 1 auto', minHeight: 96, maxHeight: '45%', overflowY: 'auto' }}>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="font-medium text-text">{t('pins.title', { n: pins.length })}</span>
        <span className="text-muted">{sendError ? <span style={{ color: 'var(--danger)' }}>{t('pins.send_failed')}: {sendError}</span> : missing && drafts.length ? t('pins.need_comment') : t('pins.hint')}</span>
        <span className="ml-auto inline-flex gap-1">
          {finished.length > 0 && <SmallBtn onClick={onDismissDone}>{t('pins.dismiss_done')}</SmallBtn>}
          <SmallBtn onClick={onClearAll}>{t('pins.clear')}</SmallBtn>
          <SmallBtn
            active
            onClick={onSend}
            disabled={sending || drafts.length === 0 || missing}
            title={over ? t('pins.batch_limit', { max: MAX_BATCH }) : t('pins.send_hint')}
            className="inline-flex items-center gap-1"
            data-testid="pins-send"
          >
            {sending && <Spinner />}
            {sending ? t('pins.sending') : `${t('pins.send')} (${over ? `${sendNow}/${drafts.length}` : drafts.length})`}
          </SmallBtn>
        </span>
      </div>
      {(over || sendLeft > 0) && (
        <div className="mb-1 rounded-sm px-2 py-1" role="status" data-testid="pins-batch-notice" style={{ border: '1px solid var(--warn)', color: 'var(--text)', background: 'var(--bg)' }}>
          {over ? t('pins.batch_limit', { max: MAX_BATCH }) : t('pins.batch_left', { n: sendLeft })}
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {pins.map((p) => (
          <PinRow key={p.id} t={t} pin={p} current={current} active={p.id === activeId} onComment={onComment} onRemove={onRemove} onJump={onJump} onReply={onReply} />
        ))}
      </ul>
    </div>
  )
}

type RowProps = {
  t: T
  pin: Pin
  current: number
  active: boolean
  onComment: (id: string, comment: string) => void
  onRemove: (id: string) => void
  onJump: (slideIndex: number, id: string) => void
  onReply: (id: string, text: string) => void
}

function PinRow({ t, pin: p, current, active, onComment, onRemove, onJump, onReply }: RowProps) {
  const [reply, setReply] = useState('')
  const locked = p.status !== 'new'
  return (
    <li
      data-testid="pin"
      data-pin-id={p.id}
      data-status={p.status}
      data-how={p.how ?? ''}
      className="flex items-start gap-2 rounded-md p-1"
      style={{ background: active ? 'var(--bg-hover)' : undefined }}
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
          <span className="ml-auto flex-none rounded-sm px-1" style={{ color: STATUS_COLOR[p.status], border: `1px solid ${STATUS_COLOR[p.status]}` }} data-testid="pin-status">
            {t(`pins.status.${p.status}`)}
          </span>
          {p.slideIndex === current && p.how && p.how !== 'cid' && p.how !== 'selector' && (
            <span style={{ color: 'var(--warn)' }}>{p.how === 'lost' ? t('pins.lost') : t('pins.moved')}</span>
          )}
        </div>
        {locked ? (
          <div className="mt-1 text-text">{p.comment}</div>
        ) : (
          <input
            type="text"
            value={p.comment}
            onChange={(e) => onComment(p.id, e.target.value)}
            placeholder={t('pins.placeholder')}
            aria-label={t('pins.comment_for', { n: p.index })}
            autoFocus={active && !p.comment}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
          />
        )}
        {p.thread && p.thread.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5" data-testid="pin-thread">
            {p.thread.map((m, i) => (
              <li key={i} className={m.role === 'agent' ? 'text-muted' : 'text-text'}>
                {m.role === 'agent' ? '↳ ' : '↪ '}
                {m.text}
              </li>
            ))}
          </ul>
        )}
        {p.status === 'question' && (
          <form
            className="mt-1 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!reply.trim()) return
              onReply(p.id, reply.trim())
              setReply('')
            }}
          >
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t('pins.reply_placeholder')}
              aria-label={t('pins.reply_placeholder')}
              className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-[12px] text-text"
            />
            <SmallBtn type="submit" disabled={!reply.trim()}>{t('pins.reply')}</SmallBtn>
          </form>
        )}
      </div>
      <SmallBtn onClick={() => onRemove(p.id)} aria-label={t('pins.remove')} title={t('pins.remove')}>
        ×
      </SmallBtn>
    </li>
  )
}
