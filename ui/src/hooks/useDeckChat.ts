import type { AppApi } from '@kirocrew/app-sdk'
import { useCallback, useState } from 'react'
import type { BuildInfo, Deck, PreviewInfo } from '../api'
import { openDeckChat } from '../chat'
import { useCollapsed } from '../components/Section'
import { type QuickActionId, quickActionPrompt } from '../quick'

type T = (key: string, vars?: Record<string, string | number>) => string

type Args = {
  api: AppApi
  selected: Deck | null
  preview: PreviewInfo | null
  buildInfo: BuildInfo | null
  current: number
  locale: string
  t: T
  bumpReload: () => void
  bumpNotes: () => void
}

/**
 * The deck's chat pane under the preview: its open state, the refresh counter
 * the pane watches, one helper that opens (or finds) the deck's chat session
 * and posts a message to it, and the quick actions about the current slide.
 */
export function useDeckChat({ api, selected, preview, buildInfo, current, locale, t, bumpReload, bumpNotes }: Args) {
  const [chatOpen, setChatOpen] = useCollapsed('chat', false)
  const [chatRefresh, setChatRefresh] = useState(0)
  const bumpChat = useCallback(() => setChatRefresh((k) => k + 1), [])

  /** Open the deck's chat session (creating it if needed) and post one message; returns the slot key. */
  const post = useCallback(
    async (deck: Deck, message: string, ctx?: { preview: PreviewInfo | null; build: BuildInfo | null }) => {
      const { key } = await openDeckChat(api, { deck, preview: ctx?.preview ?? preview, build: ctx?.build ?? buildInfo, language: locale }, t('chat.title', { name: deck.name }))
      await api.post('/api/chat?ws=1', { message, slot: key, agent: '' })
      return key
    },
    [api, preview, buildInfo, locale, t],
  )

  // Quick actions about the current slide, sent to the deck chat.
  const runQuickAction = useCallback(
    async (id: QuickActionId) => {
      if (!selected || !preview) return
      const name = preview.slides[current] ?? String(current + 1)
      const slideFile = selected.kind === 'single' ? selected.entry ?? name : `${selected.slidesDir}/${name}`
      const notesFile = `notes/${name.replace(/\.html?$/i, '').replace(/#/g, '-')}.md`
      const prompt = quickActionPrompt(id, {
        slideFile,
        slideNumber: current + 1,
        slideCount: preview.slides.length,
        notesFile,
        language: locale,
        hasDesignMd: selected.hasDesignMd,
      })
      await post(selected, prompt)
      bumpChat()
      setChatOpen(true)
      // Actions that edit files: refresh the preview after a moment so the change shows.
      if (id === 'tighten' || id === 'draft-next') setTimeout(bumpReload, 8000)
      if (id === 'notes') setTimeout(bumpNotes, 8000)
    },
    [selected, preview, current, locale, post, bumpChat, setChatOpen, bumpReload, bumpNotes],
  )

  return { chatOpen, setChatOpen, chatRefresh, bumpChat, post, runQuickAction }
}
