import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Popover } from './Popover'
import { IconCheck, IconChevronDown } from './Icons'

export interface Option<T extends string> {
  value: T
  label: ReactNode
  /** Secondary text on the right of the option. */
  hint?: string
  disabled?: boolean
}

interface SelectProps<T extends string> {
  value: T | ''
  options: Option<T>[]
  onChange: (v: T) => void
  id?: string
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  align?: 'start' | 'end'
  /** Shown in the trigger instead of the option label. */
  display?: (o: Option<T>) => ReactNode
}

/** Custom dropdown: a combobox button with a listbox popover. Keyboard: arrows, Home, End, Enter, Escape, type-ahead. */
export function Select<T extends string>({
  value, options, onChange, id, ariaLabel, placeholder = 'Select…', disabled, className = '', align, display,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [btn, setBtn] = useState<HTMLButtonElement | null>(null)
  const listId = useId()
  const typed = useRef({ s: '', t: 0 })
  const selected = options.find((o) => o.value === value)

  const close = useCallback(() => setOpen(false), [])
  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const pick = (i: number) => {
    const o = options[i]
    if (!o || o.disabled) return
    onChange(o.value)
    setOpen(false)
    btn?.focus()
  }
  const move = (from: number, dir: 1 | -1) => {
    let i = from
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) return i
    }
    return from
  }

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((a) => move(a, 1)); break
      case 'ArrowUp': e.preventDefault(); setActive((a) => move(a, -1)); break
      case 'Home': e.preventDefault(); setActive(move(-1, 1)); break
      case 'End': e.preventDefault(); setActive(move(options.length, -1)); break
      case 'Enter': case ' ': e.preventDefault(); pick(active); break
      case 'Tab': setOpen(false); break
      default:
        if (e.key.length === 1) {
          const now = Date.now()
          typed.current.s = now - typed.current.t > 700 ? e.key : typed.current.s + e.key
          typed.current.t = now
          const q = typed.current.s.toLowerCase()
          const i = options.findIndex((o) => typeof o.label === 'string' && o.label.toLowerCase().startsWith(q))
          if (i >= 0) setActive(i)
        }
    }
  }

  useEffect(() => {
    if (!open) return
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, listId])

  return (
    <>
      <button
        ref={setBtn}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        className={`select ${className}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKey}
      >
        <span className={selected ? 'select-value' : 'select-value placeholder'}>
          {selected ? (display ? display(selected) : selected.label) : placeholder}
        </span>
        <IconChevronDown className="select-chev" />
      </button>
      <Popover anchor={btn} open={open} onClose={close} matchWidth align={align} id={listId} role="listbox" label={ariaLabel}>
        {options.map((o, i) => (
          <div
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled}
            className={`option ${i === active ? 'active' : ''} ${o.disabled ? 'disabled' : ''}`}
            onPointerEnter={() => setActive(i)}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => pick(i)}
          >
            <span className="option-label">{o.label}</span>
            {o.hint && <span className="option-hint">{o.hint}</span>}
            {o.value === value && <IconCheck className="option-check" />}
          </div>
        ))}
      </Popover>
    </>
  )
}
