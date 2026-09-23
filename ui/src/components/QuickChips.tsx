import { useState } from 'react'
import { QUICK_ACTIONS, type QuickActionId } from '../quick'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  slideNumber: number
  disabled?: boolean
  onRun: (id: QuickActionId) => Promise<void>
}

/**
 * One-click prompts about the current slide. The chips only choose the prompt;
 * the caller owns the chat session and the send (see App.runQuickAction).
 */
export function QuickChips({ t, slideNumber, disabled = false, onRun }: Props) {
  const [busy, setBusy] = useState<QuickActionId | null>(null)
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const run = async (id: QuickActionId) => {
    setBusy(id)
    setNote(null)
    try {
      await onRun(id)
      setNote({ kind: 'ok', text: t('quick.sent') })
    } catch (e) {
      setNote({ kind: 'err', text: `${t('quick.failed')}: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setBusy(null)
      setTimeout(() => setNote(null), 4000)
    }
  }
  return (
    <div className="flex items-center gap-1 flex-wrap flex-none mb-1 text-[12px]" role="group" aria-label={t('quick.label', { n: slideNumber })} data-testid="quick-chips">
      <span className="text-muted mr-1">{t('quick.label', { n: slideNumber })}</span>
      {QUICK_ACTIONS.map((id) => (
        <SmallBtn key={id} onClick={() => void run(id)} disabled={disabled || busy !== null} title={t(`quick.hint.${id}`)} data-action={id} className="inline-flex items-center gap-1">
          {busy === id && <Spinner />}
          {t(`quick.${id}`)}
        </SmallBtn>
      ))}
      {note && (
        <span role="status" className="ml-1" style={{ color: note.kind === 'ok' ? 'var(--ok)' : 'var(--danger)' }}>
          {note.text}
        </span>
      )}
    </div>
  )
}
