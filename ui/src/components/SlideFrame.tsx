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
}

/**
 * Renders a slide page in an iframe at its native stage size, then scales the
 * whole frame with CSS transform so it fits the container width. The container
 * keeps the stage aspect ratio so layout never depends on iframe content.
 */
export function SlideFrame({ src, stageWidth, stageHeight, lazy = false, title, className = '', reloadKey = 0 }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(!lazy)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width)
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

  const scale = width > 0 ? width / stageWidth : 0

  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${stageWidth} / ${stageHeight}`, background: '#fff' }}
    >
      {visible && scale > 0 && (
        <iframe
          key={reloadKey}
          src={src}
          title={title}
          sandbox="allow-same-origin"
          tabIndex={-1}
          className="absolute top-0 left-0 border-0 pointer-events-none"
          style={{
            width: stageWidth,
            height: stageHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      )}
    </div>
  )
}
