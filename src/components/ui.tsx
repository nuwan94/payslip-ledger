import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { IconCheck, IconUpload } from './Icons'
import { fmt, parseAmount } from '../lib/money'

type Variant = 'default' | 'primary' | 'danger' | 'ghost'

export function Button({ variant = 'default', small, className = '', type = 'button', ...p }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return <button type={type} className={`btn ${variant} ${small ? 'small' : ''} ${className}`} {...p} />
}

export function LinkButton({ variant = 'default', className = '', ...p }: LinkProps & { variant?: Variant }) {
  return <Link className={`btn ${variant} ${className}`} {...p} />
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'fx'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function CurrencyBadge({ currency }: { currency: string }) {
  return <Badge tone={currency === 'LKR' ? 'neutral' : 'fx'}>{currency}</Badge>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="controls">{children}</div>}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {action}
    </div>
  )
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

/** Custom checkbox (button with role=checkbox). */
export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const id = useId()
  return (
    <div className="checkbox-row">
      <button id={id} type="button" role="checkbox" aria-checked={checked} className={`checkbox ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        {checked && <IconCheck />}
      </button>
      <label htmlFor={id} onClick={() => onChange(!checked)}>{children}</label>
    </div>
  )
}

/** Single-choice toggle group rendered as pill buttons. */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel }:
  { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} className="seg" onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

/** Text field for money. Keeps what you type while focused, formats with 2 decimals on blur. */
export function AmountInput({ value, onChange, id, ariaLabel, placeholder = '0.00', blankZero, className = '' }:
  { value: number; onChange: (n: number) => void; id?: string; ariaLabel?: string; placeholder?: string; blankZero?: boolean; className?: string }) {
  const show = (n: number) => (blankZero && n === 0 ? '' : fmt(n))
  const [text, setText] = useState(show(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(show(value)) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      className={`input amt ${className}`}
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onFocus={(e) => { focused.current = true; e.currentTarget.select() }}
      onChange={(e) => { setText(e.target.value); onChange(parseAmount(e.target.value)) }}
      onBlur={() => { focused.current = false; setText(show(value)) }}
    />
  )
}

/** Drop zone with a custom button. The real file input is hidden and driven by the button. */
export function FileDrop({ accept, onFile, title, hint }: { accept: string; onFile: (f: File) => void; title: string; hint?: ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
    >
      <IconUpload width={22} height={22} />
      <b>{title}</b>
      {hint && <span className="muted small">{hint}</span>}
      <Button variant="primary" onClick={() => input.current?.click()}>Choose file</Button>
      <input ref={input} type="file" accept={accept} hidden tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}
