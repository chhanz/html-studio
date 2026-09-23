import { ChatEmbed, useAppApi, useNavigate } from '@kirocrew/app-sdk'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { BuildInfo, Deck, PreviewInfo } from '../api'
import { findDeckChat, openDeckChat } from '../chat'
import { SmallBtn } from './SmallBtn'
import { Spinner } from './Spinner'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  locale: string
  deck: Deck | null
  preview: PreviewInfo | null
  build: BuildInfo | null
  open: boolean
  onToggle: () => void
  /** Bump to look the session up again (e.g. after pins created it). */
  refreshKey?: number
  /** Rendered above the conversation (quick action chips). */
  toolbar?: ReactNode
}

type Status = 'idle' | 'checking' | 'none' | 'ready' | 'error'

/**
 * The deck's chat, embedded under the preview. Selecting a deck only LOOKS UP
 * its session (read-only), so browsing decks never litters the sidebar; the
 * user starts a session explicitly, which creates it, scopes it to the deck
 * folder and sends the one-time brief (see chat.ts).
 */
export function DeckChat({ t, locale, deck, preview, build, open, onToggle, refreshKey = 0, toolbar }: Props) {
  const api = useAppApi()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('idle')
  const [slotKey, setSlotKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSlotKey(null)
    setError(null)
    if (!deck) {
      setStatus('idle')
      return
    }
    setStatus('checking')
    findDeckChat(api, deck.path)
      .then((slot) => {
        if (cancelled) return
        if (slot) {
          setSlotKey(slot.key)
          setStatus('ready')
        } else setStatus('none')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [api, deck, refreshKey])

  const start = useCallback(async () => {
    if (!deck) return
    setStatus('checking')
    setError(null)
    try {
      const { key } = await openDeckChat(api, { deck, preview, build, language: locale }, t('chat.title', { name: deck.name }))
      setSlotKey(key)
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }, [api, deck, preview, build, locale, t])

  return (
    <div className="hs-fill min-h-0 flex flex-col" data-testid="deck-chat" data-status={status}>
      <div className="flex items-center gap-2 flex-none">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="deck-chat-body"
          className="flex-1 min-w-0 flex items-center gap-2 py-1 px-1 -mx-1 rounded-md text-[15px] font-semibold text-text-strong hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left"
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform"
            style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ▸
          </span>
          {t('panel.chat')}
          {!open && <span className="font-normal text-[12px] text-muted truncate ml-1">{t('chat.tagline')}</span>}
        </button>
        <div className="flex gap-1 items-center flex-none">
          {status === 'checking' && <Spinner />}
          {slotKey && (
            <SmallBtn onClick={() => navigate(`/chat?sid=${encodeURIComponent(slotKey)}`)} title={t('chat.open_full_hint')}>
              {t('chat.open_full')} ↗
            </SmallBtn>
          )}
        </div>
      </div>
      {open && (
        <div id="deck-chat-body" className="hs-fill min-h-0 flex flex-col mt-1">
          {deck && toolbar}
          {!deck && <p className="text-sm text-muted">{t('panel.chat.empty')}</p>}
          {deck && status === 'none' && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted">{t('chat.none', { name: deck.name })}</p>
              <SmallBtn onClick={() => void start()}>{t('chat.start')}</SmallBtn>
            </div>
          )}
          {deck && status === 'error' && (
            <div className="text-[12px]" style={{ color: 'var(--danger)' }} role="alert">
              {t('chat.failed')}
              <span className="block text-muted break-all">{error}</span>
              <SmallBtn onClick={() => void start()} className="mt-1">{t('chat.retry')}</SmallBtn>
            </div>
          )}
          {deck && status === 'ready' && slotKey && (
            <div className="hs-fill min-h-0 flex flex-col" data-testid="deck-chat-embed" data-slot={slotKey}>
              <ChatEmbed slotKey={slotKey} frameless startAtBottom placeholder={t('chat.placeholder', { name: deck.name })} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
