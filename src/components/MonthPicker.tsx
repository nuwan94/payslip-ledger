import { useCallback, useEffect, useId, useState } from 'react'
import { Popover } from './Popover'
import { IconCalendar, IconChevronLeft, IconChevronRight } from './Icons'
import { MONTH_SHORT, currentYm, formatYm, parseYm, ym } from '../lib/dates'

interface Props {
  value: string
  onChange: (v: string) => void
  id?: string
  ariaLabel?: string
  /** Inclusive 'YYYY-MM' bounds. */
  min?: string
  max?: string
  className?: string
  disabled?: boolean
}

/** Custom month picker: year stepper and a 12-month grid. */
export function MonthPicker({ value, onChange, id, ariaLabel, min, max, className = '', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null)
  const [year, setYear] = useState(() => parseYm(value || currentYm()).year)
  const gridId = useId()
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => { if (open) setYear(parseYm(value || currentYm()).year) }, [open, value])

  const sel = value ? parseYm(value) : null
  const today = parseYm(currentYm())
  const off = (v: string) => (min !== undefined && v < min) || (max !== undefined && v > max)

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
        <span className={value ? 'select-value' : 'select-value placeholder'}>{value ? formatYm(value) : 'Pick a month'}</span>
        <IconCalendar className="select-chev" />
      </button>
      <Popover anchor={btn} open={open} onClose={close} id={gridId} role="dialog" label="Choose month" className="month-pop">
        <div className="month-head">
          <button type="button" className="icon-btn" aria-label="Previous year" onClick={() => setYear((y) => y - 1)}><IconChevronLeft /></button>
          <b className="num">{year}</b>
          <button type="button" className="icon-btn" aria-label="Next year" onClick={() => setYear((y) => y + 1)}><IconChevronRight /></button>
        </div>
        <div className="month-grid">
          {MONTH_SHORT.map((name, i) => {
            const v = ym(year, i)
            const isSel = sel?.year === year && sel.month === i
            const isNow = today.year === year && today.month === i
            return (
              <button
                key={name}
                type="button"
                disabled={off(v)}
                aria-pressed={isSel}
                className={`month-cell ${isSel ? 'sel' : ''} ${isNow ? 'now' : ''}`}
                onClick={() => { onChange(v); setOpen(false); btn?.focus() }}
              >
                {name}
              </button>
            )
          })}
        </div>
      </Popover>
    </>
  )
}
