/**
 * Pins: comments attached to elements of a slide (P2 "point and edit").
 *
 * A pin remembers where it was placed in three ways so it can be found again
 * after the agent edits the file: a `data-studio-cid` the agent adds to new or
 * moved elements, a CSS selector relative to the slide, and the stage rect.
 * The overlay (backend/inject/select.js) re-anchors in that order and reports
 * how it managed (`how`), which the UI shows.
 */

export type PinStatus = 'new' | 'sent' | 'done' | 'question'
export type AnchorHow = 'cid' | 'selector' | 'point' | 'lost'

export type Capture = {
  slideIndex: number
  cid: string | null
  selector: string
  tag: string
  elementId: string | null
  classes: string[]
  text: string
  rect: { x: number; y: number; w: number; h: number }
  src: string | null
}

export type Pin = Capture & {
  id: string
  /** 1-based number shown on the marker, stable for the pin's lifetime. */
  index: number
  slideFile: string
  comment: string
  status: PinStatus
  how?: AnchorHow
  createdAt: number
  /** Set once sent: the batch and the comment id the agent reports with. */
  batchId?: string
  batchCid?: string
  /** Agent reports (and the user's replies) for this pin. */
  thread?: { role: 'agent' | 'user'; text: string; ts: number | null }[]
}

export function elementLabel(p: Capture): string {
  const cls = p.classes.length ? '.' + p.classes.slice(0, 2).join('.') : ''
  const idp = p.elementId ? `#${p.elementId}` : ''
  return `${p.tag}${idp}${cls}`
}

export function newPin(cap: Capture, slideFile: string, index: number): Pin {
  return {
    ...cap,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    index,
    slideFile,
    comment: '',
    status: 'new',
    createdAt: Date.now(),
  }
}

const KEY = 'hs.pins.'

export function loadPins(deckPath: string): Pin[] {
  try {
    const raw = localStorage.getItem(KEY + deckPath)
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(v) ? (v as Pin[]) : []
  } catch {
    return []
  }
}

export function savePins(deckPath: string, pins: Pin[]): void {
  try {
    if (pins.length) localStorage.setItem(KEY + deckPath, JSON.stringify(pins))
    else localStorage.removeItem(KEY + deckPath)
  } catch {
    /* storage unavailable: pins live for the session only */
  }
}
