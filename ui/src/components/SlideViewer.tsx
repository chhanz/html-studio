import { useEffect } from 'react'
import type { PreviewInfo } from '../api'
import { SlideFrame } from './SlideFrame'
import { SmallBtn } from './SmallBtn'

type T = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  t: T
  preview: PreviewInfo
  current: number
  onChange: (index: number) => void
  reloadKey?: number
}

export function SlideViewer({ t, preview, current, onChange, reloadKey }: Props) {
  const total = preview.slides.length
  const prev = () => onChange(Math.max(0, current - 1))
  const next = () => onChange(Math.min(total - 1, current + 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        prev()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        next()
      } else if (e.key === 'Home') {
        onChange(0)
      } else if (e.key === 'End') {
        onChange(total - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, total])

  if (total === 0) {
    return <p className="text-sm text-muted">{t('deck.summary.no_slides')}</p>
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 flex-1">
      <div className="flex items-center gap-2 text-[12px] text-muted flex-none">
        <SmallBtn onClick={prev} disabled={current === 0} aria-label={t('viewer.prev')}>
          ◂
        </SmallBtn>
        <span className="tabular-nums" aria-live="polite">
          {current + 1} / {total}
        </span>
        <SmallBtn onClick={next} disabled={current >= total - 1} aria-label={t('viewer.next')}>
          ▸
        </SmallBtn>
        <span className="truncate ml-2" title={preview.slides[current]}>
          {preview.slides[current]}
        </span>
        <span className="ml-auto">{preview.css ? (preview.css === 'tokens.css' ? t('viewer.tokens_theme') : preview.css) : t('viewer.default_theme')}</span>
      </div>
      <div className="flex-1 min-h-0" style={{ minHeight: 120 }}>
        <SlideFrame
          src={`${preview.baseUrl}/slide/${current}`}
          stageWidth={preview.stage.width}
          stageHeight={preview.stage.height}
          title={preview.slides[current]}
          reloadKey={reloadKey}
          fit="contain"
          className="rounded-md border border-border"
        />
      </div>
    </div>
  )
}
