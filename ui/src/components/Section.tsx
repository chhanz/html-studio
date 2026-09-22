import { type ReactNode, useCallback, useEffect, useState } from 'react'

const KEY = 'html-studio.collapsed'

function readCollapsed(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

/** Persisted open/closed state keyed by section id. */
export function useCollapsed(id: string, defaultOpen = true): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState<boolean>(() => {
    const v = readCollapsed()[id]
    return typeof v === 'boolean' ? !v : defaultOpen
  })
  const set = useCallback(
    (next: boolean) => {
      setOpen(next)
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...readCollapsed(), [id]: !next }))
      } catch {
        /* ignore */
      }
    },
    [id],
  )
  return [open, set]
}

type Props = {
  id: string
  title: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  /** Externally force open/closed (e.g. auto-collapse decks after selection). */
  forceOpen?: boolean | null
  /** When true the open body takes the remaining height and scrolls internally. */
  grow?: boolean
  children: ReactNode
}

export function Section({ id, title, badge, actions, defaultOpen = true, forceOpen = null, grow = false, children }: Props) {
  const [open, setOpen] = useCollapsed(id, defaultOpen)
  useEffect(() => {
    if (forceOpen !== null && forceOpen !== open) setOpen(forceOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen])

  return (
    <section data-grow={open && grow ? 'true' : 'false'} className={`flex flex-col min-h-0 ${open && grow ? 'flex-1' : 'flex-none'}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="flex-1 flex items-center gap-2 py-2 px-1 -mx-1 rounded-md text-[13px] font-semibold text-text hover:bg-bg-hover cursor-pointer bg-transparent border-0 text-left"
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center w-5 h-5 text-[14px] text-muted transition-transform"
            style={{ transform: open ? 'rotate(90deg)' : 'none' }}
          >
            ▸
          </span>
          {title}
          {badge !== undefined && <span className="font-normal text-muted">{badge}</span>}
        </button>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      {open && (
        <div id={`${id}-body`} className={`min-h-0 overflow-y-auto pl-1 pr-1 ${grow ? 'flex-1' : ''}`}>
          {children}
        </div>
      )}
    </section>
  )
}
