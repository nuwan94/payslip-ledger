import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
  align?: 'start' | 'end'
  matchWidth?: boolean
  className?: string
  id?: string
  role?: string
  label?: string
}

/** Floating panel anchored to an element. Closes on outside press, Escape, and when the page scrolls or resizes. */
export function Popover({ anchor, open, onClose, children, align = 'start', matchWidth, className = '', id, role, label }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return
    const a = anchor.getBoundingClientRect()
    const p = ref.current.getBoundingClientRect()
    const gap = 6
    const below = window.innerHeight - a.bottom - gap
    const above = a.top - gap
    const flip = p.height > below && above > below
    const top = flip ? Math.max(8, a.top - gap - Math.min(p.height, above)) : a.bottom + gap
    let left = align === 'end' ? a.right - p.width : a.left
    left = Math.min(Math.max(8, left), window.innerWidth - p.width - 8)
    setStyle({
      top, left,
      minWidth: matchWidth ? a.width : undefined,
      maxHeight: Math.max(160, (flip ? above : below) - 8),
    })
  }, [open, anchor, align, matchWidth, children])

  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || anchor?.contains(t)) return
      onClose()
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    const dismiss = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open, anchor, onClose])

  if (!open) return null
  return createPortal(
    <div ref={ref} id={id} role={role} aria-label={label} className={`popover ${className}`} style={style}>
      {children}
    </div>,
    document.body,
  )
}
