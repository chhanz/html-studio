import { useEffect, useRef } from 'react'
import type { PreviewInfo } from '../api'
import { SlideFrame } from './SlideFrame'

type Props = {
  preview: PreviewInfo
  current: number
  onSelect: (index: number) => void
  reloadKey?: number
}

export function SlideStrip({ preview, current, onSelect, reloadKey }: Props) {
  const listRef = useRef<HTMLOListElement>(null)

  // Keep the selected thumbnail in view when navigating with the keyboard.
  useEffect(() => {
    const target = listRef.current?.querySelector(`[data-index="${current}"]`) as HTMLElement | null
    target?.scrollIntoView({ block: 'nearest' })
  }, [current])

  return (
    <ol ref={listRef} className="m-0 p-0 list-none grid gap-2" style={{ gridTemplateColumns: '1fr' }}>
      {preview.slides.map((name, i) => {
        const selected = i === current
        return (
          <li key={name} data-index={i}>
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
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
