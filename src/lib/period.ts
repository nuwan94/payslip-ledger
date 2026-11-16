import type { Payslip } from '../types'
import { parseYm, ym } from './dates'

export type Basis = 'fy' | 'calendar'

export interface Period {
  key: string
  label: string
  /** inclusive 'YYYY-MM' */
  from: string
  to: string
}

/** Sri Lankan year of assessment: 1 April – 31 March, named by the year it starts. */
export function fyStartYear(month: string): number {
  const { year, month: m } = parseYm(month)
  return m >= 3 ? year : year - 1
}

export function periodOf(month: string, basis: Basis): Period {
  if (basis === 'calendar') {
    const { year } = parseYm(month)
    return { key: `cal-${year}`, label: `Calendar ${year}`, from: ym(year, 0), to: ym(year, 11) }
  }
  const y = fyStartYear(month)
  return { key: `fy-${y}`, label: `FY ${y}/${String((y + 1) % 100).padStart(2, '0')}`, from: ym(y, 3), to: ym(y + 1, 2) }
}

/** Periods that contain data, newest first. Always includes the period of `today`. */
export function periodsFor(slips: Payslip[], basis: Basis, today: string): Period[] {
  const map = new Map<string, Period>()
  for (const m of [today, ...slips.map((s) => s.month)]) {
    const p = periodOf(m, basis)
    map.set(p.key, p)
  }
  return [...map.values()].sort((a, b) => b.from.localeCompare(a.from))
}

export function monthsIn(p: Period): string[] {
  const out: string[] = []
  let { year, month } = parseYm(p.from)
  for (let i = 0; i < 12; i++) {
    out.push(ym(year, month))
    month++
    if (month > 11) { month = 0; year++ }
  }
  return out
}
