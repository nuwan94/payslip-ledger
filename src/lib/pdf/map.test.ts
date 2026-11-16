import { describe, expect, it } from 'vitest'
import { rowsFromItems, parseNumber } from './rows'
import { autoMap, buildTemplate, cleanLabel, fullyKnown, labelKey, reconcile, rowsToLines } from './map'

// Positions mimic a real payslip: labels at x=62, values right aligned; the deductions use a second column.
const items = [
  ['Salary for the month of November 2025', 62, 609.8], ['LKR', 505, 609.8],
  ['Name', 62, 654.6], ['Some Person', 176, 654.6], ['EPF Number', 62, 639.5], ['595', 176, 639.5],
  ['Basic Salary', 62, 580], ['350,000.00', 487, 580],
  ['Variable Allowance', 62, 550], ['150,000.00', 487, 550],
  ['Ex Gratia - November 2025', 62, 534.9], ['10,000.00', 493, 534.9],
  ['Total Gross Earning', 62, 489.8], ['510,000.00', 487, 489.8],
  ['Deductions', 62, 460.5],
  ['E.P.F. 8%', 62, 430.4], ['28,000.00', 419, 430.4],
  ['APIT', 62, 415.4], ['95,000.00', 413, 415.4],
  ['Sports Club Contribution', 62, 400.3], ['250.00', 434, 400.3],
  ['Stamp Duty', 62, 385.3], ['25.00', 440, 385.3],
  ['Total Deductions', 62, 325], ['123,275.00', 487, 325],
  ['Net Pay', 62, 310], ['386,725.00', 487, 310],
  ['Employer Contribution', 62, 279.1],
  ['EPF 12%', 62, 248.9], ['42,000.00', 494, 248.9],
  ['ETF 3%', 62, 233.9], ['10,500.00', 494, 233.9],
].map(([str, x, y]) => ({ str: str as string, x: x as number, y: y as number }))

describe('row extraction', () => {
  it('parses numbers', () => {
    expect(parseNumber('350,000.00')).toBe(350000)
    expect(parseNumber('(1,000.00)')).toBe(-1000)
    expect(parseNumber('Basic')).toBeNull()
  })
  it('groups items on the same baseline', () => {
    const rows = rowsFromItems(items.slice().reverse())
    const basic = rows.find((r) => r.label === 'Basic Salary')!
    expect(basic.amounts).toEqual([350000])
  })
})

describe('auto map', () => {
  const { rows, month, currency } = autoMap(rowsFromItems(items))
  const t = (label: string) => rows.find((r) => r.label === label)

  it('finds month and currency', () => {
    expect(month).toBe('2025-11')
    expect(currency).toBe('LKR')
  })
  it('maps known labels', () => {
    expect(t('Basic Salary')?.target).toBe('basic')
    expect(t('Variable Allowance')?.target).toBe('allowance')
    expect(t('Ex Gratia - November 2025')?.target).toBe('bonus')
    expect(t('E.P.F. 8%')?.target).toBe('epf')
    expect(t('APIT')?.target).toBe('apit')
    expect(t('Stamp Duty')?.target).toBe('stamp')
    expect(t('EPF 12%')?.target).toBe('er_epf')
    expect(t('ETF 3%')?.target).toBe('er_etf')
    expect(t('Net Pay')?.target).toBe('net')
  })
  it('skips personal details', () => {
    expect(t('EPF Number')?.target).toBe('skip')
  })
  it('flags unknown labels by the section they were printed in', () => {
    const club = t('Sports Club Contribution')!
    expect(club.target).toBe('deduction_other')
    expect(club.status).toBe('check')
  })
  it('reconciles with the printed totals', () => {
    expect(reconcile(rows).ok).toBe(true)
    const broken = rows.map((r) => (r.label === 'Sports Club Contribution' ? { ...r, target: 'skip' as const } : r))
    expect(reconcile(broken).ok).toBe(false)
  })
  it('builds lines with clean names', () => {
    const lines = rowsToLines(rows)
    expect(lines.find((l) => l.kind === 'bonus')?.name).toBe('Ex Gratia')
    expect(lines.some((l) => l.name === 'Net Pay')).toBe(false)
  })
  it('skips the editor when a saved map covers every row', () => {
    const tpl = buildTemplate('e1', rows)
    const next = autoMap(rowsFromItems(items), tpl)
    expect(fullyKnown(next.rows, tpl)).toBe(true)
    expect(fullyKnown(next.rows, undefined)).toBe(false)
  })
  it('label keys ignore months', () => {
    expect(labelKey('Ex Gratia - December 2026')).toBe(labelKey('Ex Gratia - November 2025'))
    expect(cleanLabel('Ex Gratia - November 2025')).toBe('Ex Gratia')
  })
})
