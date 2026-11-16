import type { Line, Payslip, Section } from '../types'
import { KIND_SECTION } from '../types'

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function fmt0(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
export function parseAmount(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function sectionTotal(lines: Line[], section: Section): number {
  return r2(lines.filter((l) => KIND_SECTION[l.kind] === section).reduce((s, l) => s + l.amount, 0))
}

export interface SlipTotals {
  /** In the slip currency. */
  gross: number
  deductions: number
  net: number
  employer: number
}
export function slipTotals(lines: Line[]): SlipTotals {
  const gross = sectionTotal(lines, 'earning')
  const deductions = sectionTotal(lines, 'deduction')
  return { gross, deductions, net: r2(gross - deductions), employer: sectionTotal(lines, 'employer') }
}

/** LKR value of one slip, broken down for reporting. */
export interface SlipLkr {
  gross: number
  net: number
  apit: number
  epf: number
  other: number
  employerEpfEtf: number
}
export function slipLkr(p: Payslip): SlipLkr {
  const sum = (pred: (l: Line) => boolean) => p.lines.filter(pred).reduce((s, l) => s + l.amount, 0) * p.rate
  const t = slipTotals(p.lines)
  const apit = sum((l) => l.kind === 'apit')
  const epf = sum((l) => l.kind === 'epf')
  const deductionsLkr = t.deductions * p.rate
  return {
    gross: r2(t.gross * p.rate),
    net: r2(t.net * p.rate),
    apit: r2(apit),
    epf: r2(epf),
    other: r2(deductionsLkr - apit - epf),
    employerEpfEtf: r2(sum((l) => l.kind === 'er_epf' || l.kind === 'er_etf')),
  }
}
