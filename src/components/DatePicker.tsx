import { useCallback, useEffect, useId, useState } from 'react'
import { Popover } from './Popover'
import { IconCalendar, IconChevronLeft, IconChevronRight } from './Icons'
import { MONTH_NAMES, MONTH_SHORT, parseYm, ym } from '../lib/dates'

interface Props {
  /** 'YYYY-MM-DD' or empty. */
  value: string
  onChange: (v: string) => void
  /** 'YYYY-MM' month shown when no date is selected. */
  viewMonth?: string
  id?: string
  ariaLabel?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const iso = (y: number, m: number, d: number) => `${ym(y, m)}-${String(d).padStart(2, '0')}`

export function formatDate(v: string): string {
  const [y, m, d] = v.split('-').map(Number)
  return `${d} ${MONTH_SHORT[m - 1]} ${y}`
}

/** Custom date picker: month stepper and a Monday-first day grid. */
export function DatePicker({ value, onChange, viewMonth, id, ariaLabel, placeholder = 'Pick a date', className = '', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null)
  const [view, setView] = useState(() => parseYm((value || '').slice(0, 7) || viewMonth || ym(new Date().getFullYear(), new Date().getMonth())))
  const popId = useId()
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (open) setView(parseYm(value.slice(0, 7) || viewMonth || ym(new Date().getFullYear(), new Date().getMonth())))
  }, [open, value, viewMonth])

  const step = (n: number) => setView((v) => {
    const t = v.year * 12 + v.month + n
    return { year: Math.floor(t / 12), month: ((t % 12) + 12) % 12 }
  })

  const first = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const t = new Date()
  const today = iso(t.getFullYear(), t.getMonth(), t.getDate())

  return (
    <>
      <button
        ref={setBtn}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        className={`select ${className}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? 'select-value' : 'select-value placeholder'}>{value ? formatDate(value) : placeholder}</span>
        <IconCalendar className="select-chev" />
      </button>
      <Popover anchor={btn} open={open} onClose={close} id={popId} role="dialog" label="Choose date" className="date-pop">
        <div className="month-head">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => step(-1)}><IconChevronLeft /></button>
          <b>{MONTH_NAMES[view.month]} <span className="num">{view.year}</span></b>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => step(1)}><IconChevronRight /></button>
        </div>
        <div className="date-grid">
          {DOW.map((d) => <span key={d} className="dow">{d}</span>)}
          {cells.map((d, i) => {
            if (d === null) return <span key={`b${i}`} />
            const v = iso(view.year, view.month, d)
            return (
              <button
                key={v}
                type="button"
                aria-pressed={v === value}
                className={`date-cell ${v === value ? 'sel' : ''} ${v === today ? 'now' : ''}`}
                onClick={() => { onChange(v); setOpen(false); btn?.focus() }}
              >
                {d}
              </button>
            )
          })}
        </div>
      </Popover>
    </>
  )
}
