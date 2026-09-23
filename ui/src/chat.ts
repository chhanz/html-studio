import type { AppApi } from '@kirocrew/app-sdk'
import type { BuildInfo, Deck, PreviewInfo } from './api'

/**
 * One chat session per deck.
 *
 * The dashboard's `POST /api/chat/slots` is get-or-create by `name`, so a
 * stable name derived from the deck path gives us the mapping for free: no
 * bookkeeping in the backend, and a session the user deleted is simply
 * recreated (and re-seeded) next time. The session's project directory is the
 * deck folder, so the agent reads and edits slides directly and file search is
 * scoped to the deck. The brief is sent only to a brand-new session.
 */

export type SlotInfo = { key: string; messages?: number; title?: string }

export const SLOT_PREFIX = 'html-studio-'

export async function slotNameFor(deckPath: string): Promise<string> {
  const bytes = new TextEncoder().encode(deckPath)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return SLOT_PREFIX + hex.slice(0, 12)
}

export type BriefInput = {
  deck: Deck
  preview: PreviewInfo | null
  build: BuildInfo | null
  /** Language the agent should answer in ('ko' | 'en'). */
  language: string
}

/** The first message of a deck session: what the deck is and how to work on it. */
export function deckBrief({ deck, preview, build, language }: BriefInput): string {
  const count = preview?.slides.length ?? deck.slideCount
  const layout =
    deck.kind === 'single'
      ? `single file: ${count} <section class="slide"> blocks in ${deck.entry ?? 'index.html'}`
      : `slides folder: ${count} slides in ${deck.slidesDir}/ (one <section class="slide"> fragment per file, ordered by filename)`
  const css = preview?.css ? `Stylesheet: ${preview.css}` : 'Stylesheet: none (the studio applies its default theme)'
  let buildLine = 'Build: not applicable'
  if (build?.command) buildLine = `Build: run \`${build.command}\`, which writes ${build.output}`
  else if (build?.builtin && build.buildable) buildLine = `Build: HTML Studio's built-in assembler writes ${build.output}`
  const lang = language.startsWith('ko') ? 'Korean' : 'English'
  return [
    'You are attached to an HTML slide deck managed by HTML Studio.',
    `Deck: ${deck.name}`,
    `Path: ${deck.path} (this session's project directory)`,
    `Layout: ${layout}`,
    css,
    buildLine,
    '',
    'Conventions:',
    '- Edit the slide source files, never the built output.',
    '- Every slide is a 1280×720 stage; keep content inside it.',
    '- Speaker notes belong in notes/<slide>.md, never inside slide HTML.',
    '- No em/en dashes and no eyebrow label lines (small uppercase text such as "ACME | INTRO" above a heading) in slide text.',
    '- The studio previews files as saved; no server restart is needed after edits.',
    ...(deck.hasDesignMd
      ? ['- Design rules: follow DESIGN.md in the deck folder (colours, type, spacing, radii). Its CSS variables live in tokens.css (--color-<name>, --font-sans, --space-<name>, --radius-<name>, --type-<name>-size/weight/leading/tracking); use them instead of hard-coded values.']
      : []),
    `- Answer in ${lang} throughout this session unless the user switches language.`,
    '',
    `Reply with a one-line acknowledgement in ${lang} and wait for instructions.`,
  ].join('\n')
}

export type OpenDeckChatResult = { key: string; created: boolean }

/** Existing session for this deck, if any — read-only, so browsing decks creates nothing. */
export async function findDeckChat(api: AppApi, deckPath: string): Promise<SlotInfo | null> {
  const name = await slotNameFor(deckPath)
  const list = (await api.get('/api/chat/slots')) as unknown
  const slots = Array.isArray(list) ? (list as SlotInfo[]) : []
  return slots.find((s) => s.key === name) ?? null
}

/**
 * Ensure the deck's session exists, points at the deck folder, and (if new)
 * carries the brief. Returns the slot key to navigate to (`/chat?sid=<key>`).
 */
export async function openDeckChat(api: AppApi, input: BriefInput, title: string): Promise<OpenDeckChatResult> {
  const name = await slotNameFor(input.deck.path)
  const slot = (await api.post('/api/chat/slots', { name, agent: '', title })) as SlotInfo
  const key = slot?.key || name
  await api.post(`/api/chat/slots/${encodeURIComponent(key)}/project`, { project: input.deck.path })
  const created = !slot?.messages
  if (created) {
    await api.post('/api/chat?ws=1', { message: deckBrief(input), slot: key, agent: '' })
  }
  return { key, created }
}
