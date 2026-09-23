/**
 * Quick actions: one-click prompts about the CURRENT slide, sent to the deck's
 * chat session. Each prompt names the slide file so the agent needs no context
 * from the studio; the reply language follows the UI language.
 */

export type QuickActionId = 'summarize' | 'draft-next' | 'notes' | 'check' | 'tighten'

export const QUICK_ACTIONS: QuickActionId[] = ['summarize', 'draft-next', 'notes', 'check', 'tighten']

export type QuickActionInput = {
  /** Deck-relative path of the current slide's source (or the single-file entry). */
  slideFile: string
  /** 1-based position and total. */
  slideNumber: number
  slideCount: number
  /** Deck-relative path the agent should write speaker notes to. */
  notesFile: string
  language: string
  hasDesignMd: boolean
}

export function quickActionPrompt(id: QuickActionId, i: QuickActionInput): string {
  const lang = i.language.startsWith('ko') ? 'Korean' : 'English'
  const slide = `slide ${i.slideNumber} of ${i.slideCount} (${i.slideFile})`
  const design = i.hasDesignMd ? ' Follow DESIGN.md / tokens.css.' : ''
  const rules = ' No em/en dashes or middle dots in slide text; keep the slide inside its 1280x720 stage.'
  switch (id) {
    case 'summarize':
      return `Summarize ${slide} in ${lang}: three short bullets on what it says and one line on what a presenter should stress. Do not edit any file.`
    case 'draft-next':
      return (
        `Draft the NEXT slide after ${slide}. Read that slide and its neighbours for context and continuity, then create a new slide file right after it in the same folder, following the existing filename numbering (leave room between numbers) and the deck's existing markup patterns and classes.` +
        design +
        rules +
        ` Reply in ${lang} with the new file name and a one-line description.`
      )
    case 'notes':
      return `Write speaker notes for ${slide} into ${i.notesFile} (Markdown, in ${lang}): 4 to 6 talking points plus one transition sentence to the next slide. Do not touch the slide HTML. Reply with one line when done.`
    case 'check':
      return `Review ${slide} and reply in ${lang}, without editing anything: (1) text that overflows or is likely clipped, (2) wording that is vague, redundant or too long for a slide, (3) inconsistencies with the neighbouring slides. Keep it to at most six bullets; if all is fine say so in one line.`
    case 'tighten':
      return `Tighten the text of ${slide}: shorter sentences, fewer words, same meaning and structure. Edit the slide file directly; keep every heading, class and layout element.` + design + rules + ` Reply in ${lang} with one line on what changed.`
  }
}
