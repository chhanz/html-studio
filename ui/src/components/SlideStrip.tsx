import { useEffect, useRef, useState } from 'react'
import type { PreviewInfo } from '../api'
import { SlideFrame } from './SlideFrame'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

export type ArrangeActions = {
  onReorder: (order: string[]) => void
  /** Open the layout picker to insert after ``after``. */
  onAdd: (after: string | null) => void
  onDuplicate: (slide: string) => void
  onArchive: (slide: string) => void
  onSaveLayout: (slide: string) => void
  busy: boolean
}

type Props = {
  t: T
  preview: PreviewInfo
  current: number
  onSelect: (index: number) => void
  reloadKey?: number
  /** Slide names that have a speaker note (marker on the thumbnail). */
  withNotes?: Set<string>
  notesLabel?: string
  arrange?: ArrangeActions
}

/**
 * Thumbnails in deck order. With ``arrange`` the strip also edits the order:
 * drag a thumbnail onto another to move it there, or use the current slide's
 * menu (up / down / duplicate / archive). "Add" inserts a blank slide after the
 * current one. Every change goes to the backend, which renames files; the
 * strip only reports the wanted order.
 */
export function SlideStrip({ t, preview, current, onSelect, reloadKey, withNotes, notesLabel = 'Has notes', arrange }: Props) {
  const listRef = useRef<HTMLOListElement>(null)
  // The dragged index lives in a ref: dragover handlers run before React has
  // re-rendered with the new state, and a drop is only accepted when they
  // preventDefault. The state copy is for styling.
  const dragRef = useRef<number | null>(null)
  const [dragFrom, setDragFromState] = useState<number | null>(null)
  const setDragFrom = (v: number | null) => {
    dragRef.current = v
    setDragFromState(v)
  }
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [menuFor, setMenuFor] = useState<number | null>(null)

  // Keep the selected thumbnail in view when navigating with the keyboard.
  useEffect(() => {
    const target = listRef.current?.querySelector(`[data-index="${current}"]`) as HTMLElement | null
    target?.scrollIntoView({ block: 'nearest' })
  }, [current])
  useEffect(() => {
    setMenuFor(null)
  }, [current, preview.slides])

  const move = (from: number, to: number) => {
    if (!arrange || from === to || to < 0 || to >= preview.slides.length) return
    const order = preview.slides.slice()
    const [item] = order.splice(from, 1)
    order.splice(to, 0, item)
    arrange.onReorder(order)
  }
  const onDrop = (to: number) => {
    const from = dragRef.current
    if (from === null) return
    // Dropping on a later item places the dragged one after it.
    move(from, to)
    setDragFrom(null)
    setDropAt(null)
  }
  const disabled = !arrange || arrange.busy

  return (
    <div className="flex flex-col gap-2">
      {arrange && (
        <button
          type="button"
          onClick={() => arrange.onAdd(preview.slides[current] ?? null)}
          disabled={disabled}
          className="w-full rounded-md py-1 text-[12px] cursor-pointer bg-transparent text-muted hover:text-text"
          style={{ border: '1px dashed var(--border)' }}
          data-testid="strip-add"
        >
          {t('strip.add')}
        </button>
      )}
      <ol ref={listRef} className="m-0 p-0 list-none grid gap-2" style={{ gridTemplateColumns: '1fr' }}>
        {preview.slides.map((name, i) => {
          const selected = i === current
          const isDrop = dropAt === i && dragFrom !== null && dragFrom !== i
          return (
            <li
              key={name}
              data-index={i}
              draggable={!!arrange && !arrange.busy}
              onDragStart={(e) => {
                setDragFrom(i)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', name)
              }}
              onDragOver={(e) => {
                if (dragRef.current === null) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dropAt !== i) setDropAt(i)
              }}
              onDragLeave={() => {
                if (dropAt === i) setDropAt(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(i)
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDropAt(null)
              }}
              className="relative"
              style={{
                opacity: dragFrom === i ? 0.5 : 1,
                boxShadow: isDrop ? (dragFrom !== null && dragFrom < i ? '0 3px 0 0 var(--accent)' : '0 -3px 0 0 var(--accent)') : undefined,
                borderRadius: 6,
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={selected ? 'true' : undefined}
                title={name}
                className="w-full text-left rounded-md p-1 cursor-pointer bg-transparent"
                style={{
                  border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <SlideFrame
                  src={`${preview.baseUrl}/slide/${i}`}
                  stageWidth={preview.stage.width}
                  stageHeight={preview.stage.height}
                  lazy
                  title={name}
                  reloadKey={reloadKey}
                  className="rounded-sm"
                />
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                  <span className="font-medium" style={{ color: selected ? 'var(--accent)' : undefined }}>
                    {i + 1}
                  </span>
                  <span className="truncate">{name}</span>
                  {withNotes?.has(name) && (
                    <span className="ml-auto flex-none" title={notesLabel} aria-label={notesLabel} data-testid="strip-note" style={{ color: 'var(--accent)' }}>
                      ≡
                    </span>
                  )}
                </div>
              </button>
              {arrange && selected && (
                <div className="absolute" style={{ right: 6, top: 6 }}>
                  <SmallBtn
                    onClick={() => setMenuFor(menuFor === i ? null : i)}
                    aria-haspopup="menu"
                    aria-expanded={menuFor === i}
                    aria-label={t('strip.menu')}
                    title={t('strip.menu')}
                    disabled={arrange.busy}
                    style={{ background: 'var(--bg)', padding: '0 6px' }}
                  >
                    ⋯
                  </SmallBtn>
                  {menuFor === i && (
                    <div role="menu" className="absolute right-0 mt-1 rounded-md border border-border flex flex-col p-1 text-[12px]" style={{ background: 'var(--bg)', minWidth: 140, zIndex: 20, boxShadow: '0 4px 14px rgba(0,0,0,.18)' }}>
                      {(
                        [
                          ['strip.move_up', () => move(i, i - 1), i === 0],
                          ['strip.move_down', () => move(i, i + 1), i >= preview.slides.length - 1],
                          ['strip.duplicate', () => arrange.onDuplicate(name), false],
                          ['strip.save_layout', () => arrange.onSaveLayout(name), false],
                          ['strip.archive', () => arrange.onArchive(name), preview.slides.length <= 1],
                        ] as [string, () => void, boolean][]
                      ).map(([key, run, off]) => (
                        <button
                          key={key}
                          type="button"
                          role="menuitem"
                          disabled={off || arrange.busy}
                          onClick={() => {
                            setMenuFor(null)
                            run()
                          }}
                          className="text-left px-2 py-1 rounded bg-transparent border-0 cursor-pointer hover:text-text"
                          style={{ color: off ? 'var(--muted)' : key === 'strip.archive' ? 'var(--danger)' : 'var(--text)', opacity: off ? 0.6 : 1 }}
                        >
                          {t(key)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
