import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  content: ReactNode
  children: ReactNode
  /** Where the tip sits relative to the trigger. */
  side?: 'top' | 'bottom'
}

/** Custom tooltip shown on hover and keyboard focus. Replaces the browser's title attribute. */
export function Tooltip({ content, children, side = 'top' }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  const timer = useRef<number>(0)
  const id = useId()

  const show = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = wrap.current?.getBoundingClientRect()
      if (r) setPos({ x: r.left + r.width / 2, y: side === 'top' ? r.top : r.bottom })
    }, 250)
  }, [side])
  const hide = useCallback(() => { window.clearTimeout(timer.current); setPos(null) }, [])

  useEffect(() => {
    if (!pos) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    document.addEventListener('keydown', k)
    window.addEventListener('scroll', hide, true)
    return () => { document.removeEventListener('keydown', k); window.removeEventListener('scroll', hide, true) }
  }, [pos, hide])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <span ref={wrap} className="tooltip-wrap" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} aria-describedby={pos ? id : undefined}>
      {children}
      {pos && createPortal(
        <div id={id} role="tooltip" className={`tooltip ${side}`} style={{ left: pos.x, top: pos.y }}>{content}</div>,
        document.body,
      )}
    </span>
  )
}
