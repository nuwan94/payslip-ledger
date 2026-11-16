import type { Line, LineKind, MapTarget, PdfTemplate, Section } from '../../types'
import { KIND_SECTION } from '../../types'
import { MONTH_NAMES, formatYm, ym } from '../dates'
import { r2 } from '../money'
import type { PdfRow } from './rows'

export interface MappedRow {
  id: string
  /** Label as printed. */
  label: string
  /** Normalised label used as the template key. */
  key: string
  /** Chosen amount (null for rows without one, e.g. the pay month). */
  amount: number | null
  candidates: number[]
  target: MapTarget
  status: 'ok' | 'check'
  note?: string
  /** Text value for non-numeric rows. */
  text?: string
}

export interface MapResult {
  rows: MappedRow[]
  /** 'YYYY-MM' if a pay month was found. */
  month?: string
  currency?: string
}

const MONTH_RE = new RegExp(`\\b(${MONTH_NAMES.map((m) => m.slice(0, 3)).join('|')})[a-z]*\\.?\\s+(\\d{4})\\b`, 'i')
const MONTH_STRIP = new RegExp(`[\\s\\-–,:]*\\b(${MONTH_NAMES.join('|')}|${MONTH_NAMES.map((m) => m.slice(0, 3)).join('|')})\\b\\.?\\s*\\d{0,4}`, 'gi')

export function detectMonth(text: string): string | undefined {
  const m = MONTH_RE.exec(text)
  if (!m) return undefined
  const idx = MONTH_NAMES.findIndex((n) => n.toLowerCase().startsWith(m[1].toLowerCase()))
  return idx >= 0 ? ym(Number(m[2]), idx) : undefined
}

/** Key that stays the same from month to month: drops month names and years, punctuation and case. */
export function labelKey(label: string): string {
  return label.replace(MONTH_STRIP, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim()
}

/** Printed label without a trailing month/year, used as the saved line name. */
export function cleanLabel(label: string): string {
  return label.replace(MONTH_STRIP, '').replace(/[\s\-–:]+$/, '').trim() || label
}

type Ctx = { section: Section }

function guess(label: string, ctx: Ctx): { target: MapTarget; sure: boolean } {
  const l = label.toLowerCase()
  if (/^(name|epf\s*(no|number)|employee\s*(no|name|id)|nic)\b/.test(l)) return { target: 'skip', sure: true }
  if (/total\s+deduction/.test(l)) return { target: 'total_deductions', sure: true }
  if (/gross/.test(l)) return { target: 'gross', sure: true }
  if (/^net\b|net\s+(pay|salary)|take.?home/.test(l)) return { target: 'net', sure: true }
  if (/\betf\b/.test(l)) return { target: 'er_etf', sure: true }
  if (/e\.?p\.?f\.?/.test(l) && (/12\s*%/.test(l) || ctx.section === 'employer')) return { target: 'er_epf', sure: true }
  if (/e\.?p\.?f\.?/.test(l)) return { target: 'epf', sure: ctx.section !== 'earning' }
  if (/a\.?p\.?i\.?t|paye|income\s*tax/.test(l)) return { target: 'apit', sure: true }
  if (/stamp/.test(l)) return { target: 'stamp', sure: true }
  if (/basic/.test(l)) return { target: 'basic', sure: true }
  if (/ex.?gratia|bonus|incentive|commission/.test(l)) return { target: 'bonus', sure: true }
  if (/allowance/.test(l)) return { target: 'allowance', sure: true }
  const other: Record<Section, LineKind> = { earning: 'earning_other', deduction: 'deduction_other', employer: 'employer_other' }
  return { target: other[ctx.section], sure: false }
}

export function autoMap(rows: PdfRow[], template?: PdfTemplate): MapResult {
  const out: MappedRow[] = []
  const ctx: Ctx = { section: 'earning' }
  let month: string | undefined
  let currency: string | undefined

  for (const r of rows) {
    currency ??= r.currency
    const label = r.label
    if (!r.amounts.length) {
      const m = detectMonth(r.text)
      if (m && /month|period|salary/i.test(r.text)) {
        month ??= m
        out.push({ id: r.id, label, key: labelKey(label), amount: null, candidates: [], target: 'month', status: 'ok', text: formatYm(m) })
      } else if (/^deductions?$/i.test(label)) ctx.section = 'deduction'
      else if (/employer/i.test(label)) ctx.section = 'employer'
      else if (/^(earnings?|allowances?)$/i.test(label)) ctx.section = 'earning'
      continue
    }
    if (!label) continue

    const key = labelKey(label)
    const saved = template?.labels[key]
    const g = guess(label, ctx)
    const target: MapTarget = saved ?? g.target
    let status: MappedRow['status'] = saved || g.sure ? 'ok' : 'check'
    let note = status === 'check' ? 'New label I have not seen. Confirm what it is.' : undefined

    let amount = r.amounts[r.amounts.length - 1]
    if (r.amounts.length > 1) {
      status = 'check'
      note = `Several amounts on this row (${r.amounts.join(', ')}). I picked the right-most. Choose the right one.`
    }
    // Section follows the printed totals so unknown lines land where they were printed.
    if (target === 'gross') ctx.section = 'deduction'
    if (target === 'total_deductions') ctx.section = 'employer'
    out.push({ id: r.id, label, key, amount, candidates: r.amounts, target, status, note })
  }
  return { rows: out, month, currency }
}

export interface Check { label: string; a: number; b: number; ok: boolean }

const kindOf = (t: MapTarget): Section | 'skip' | 'verify' | 'month' =>
  t === 'skip' ? 'skip' : t === 'month' ? 'month' : t in KIND_SECTION ? KIND_SECTION[t as LineKind] : 'verify'

/** Compares line sums with the totals printed on the slip. */
export function reconcile(rows: MappedRow[]): { checks: Check[]; ok: boolean } {
  const sum = (s: Section) => r2(rows.filter((r) => kindOf(r.target) === s).reduce((a, r) => a + (r.amount ?? 0), 0))
  const val = (t: MapTarget) => rows.find((r) => r.target === t)?.amount ?? null
  const gross = val('gross'), ded = val('total_deductions'), net = val('net')
  const checks: Check[] = []
  const add = (label: string, a: number, b: number | null) => { if (b !== null) checks.push({ label, a: r2(a), b, ok: Math.abs(a - b) < 0.005 }) }
  add('Earnings add up to gross', sum('earning'), gross)
  add('Deductions add up to total deductions', sum('deduction'), ded)
  if (gross !== null && ded !== null) add('Gross minus deductions equals net pay', gross - ded, net)
  return { checks, ok: checks.every((c) => c.ok) }
}

export function rowsToLines(rows: MappedRow[]): Line[] {
  return rows
    .filter((r) => r.amount !== null && r.target in KIND_SECTION)
    .map((r) => ({ name: cleanLabel(r.label), kind: r.target as LineKind, amount: r.amount as number }))
}

export function buildTemplate(employerId: string, rows: MappedRow[]): PdfTemplate {
  const labels: PdfTemplate['labels'] = {}
  for (const r of rows) if (r.target !== 'month') labels[r.key] = r.target
  return { employerId, labels }
}

/** True when every numeric row of a new PDF was already known to the saved map and the totals add up. */
export function fullyKnown(rows: MappedRow[], template: PdfTemplate | undefined): boolean {
  if (!template) return false
  return rows.every((r) => r.target === 'month' || (r.key in template.labels && r.status === 'ok')) && reconcile(rows).ok
}
