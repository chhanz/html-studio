import { useEffect, useRef, useState } from 'react'

type Props = {
  src: string
  stageWidth: number
  stageHeight: number
  /** Load only once the frame scrolls into view (thumbnails). */
  lazy?: boolean
  title?: string
  className?: string
  /** Bump to force the iframe to reload (e.g. after a rebuild). */
  reloadKey?: number
  /**
   * 'width' (default): the box keeps the stage aspect ratio and scales to its
   * width — right for thumbnails in a scrolling list.
   * 'contain': the box fills whatever space its parent gives it and the stage
   * is scaled to fit BOTH dimensions, centred — right for the main viewer,
   * whose height depends on the chat pane below it.
   */
  fit?: 'width' | 'contain'
  /**
   * Let the page run scripts and receive the pointer (select-to-edit overlay).
   * Off by default: thumbnails and the plain viewer are inert pictures.
   */
  interactive?: boolean
  /** Receives the iframe element (to postMessage into it). */
  frameRef?: (el: HTMLIFrameElement | null) => void
}

/**
 * Renders a slide page in an iframe at its native stage size, then scales the
 * whole frame with CSS transform so it fits the container. Layout never depends
 * on iframe content.
 */
export function SlideFrame({ src, stageWidth, stageHeight, lazy = false, title, className = '', reloadKey = 0, fit = 'width', interactive = false, frameRef }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [visible, setVisible] = useState(!lazy)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!lazy || visible) return
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [lazy, visible])

  const scale =
    fit === 'contain'
      ? size.w > 0 && size.h > 0
        ? Math.min(size.w / stageWidth, size.h / stageHeight)
        : 0
      : size.w > 0
        ? size.w / stageWidth
        : 0

  const frame = visible && scale > 0 && (
    <iframe
      key={`${reloadKey}:${interactive ? 'i' : 's'}`}
      ref={frameRef}
      src={src}
      title={title}
      sandbox={interactive ? 'allow-scripts allow-same-origin' : 'allow-same-origin'}
      tabIndex={-1}
      className={`absolute top-0 left-0 border-0 ${interactive ? '' : 'pointer-events-none'}`}
      style={{ width: stageWidth, height: stageHeight, transform: `scale(${scale})`, transformOrigin: 'top left' }}
    />
  )

  if (fit === 'contain') {
    const w = Math.floor(stageWidth * scale)
    const h = Math.floor(stageHeight * scale)
    return (
      <div ref={boxRef} className="relative w-full h-full min-h-0 flex items-center justify-center" data-testid="slide-fit">
        {scale > 0 && (
          <div className={`relative overflow-hidden ${className}`} style={{ width: w, height: h, background: '#fff' }} data-testid="slide-stage">
            {frame}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={boxRef} className={`relative overflow-hidden ${className}`} style={{ aspectRatio: `${stageWidth} / ${stageHeight}`, background: '#fff' }}>
      {frame}
    </div>
  )
}
