import { describe, expect, it } from 'vitest'
import { fyStartYear, monthsIn, periodOf } from './period'
import { currencyFor, setCurrencyFrom } from './employer'
import { addMonths } from './dates'
import { slipLkr, slipTotals } from './money'
import { summarise } from './stats'
import type { Employer, Payslip } from '../types'

describe('year of assessment', () => {
  it('starts in April', () => {
    expect(fyStartYear('2026-03')).toBe(2025)
    expect(fyStartYear('2026-04')).toBe(2026)
    expect(periodOf('2026-11', 'fy').label).toBe('FY 2026/27')
    expect(periodOf('2027-02', 'fy').label).toBe('FY 2026/27')
  })
  it('lists twelve months Apr..Mar', () => {
    const m = monthsIn(periodOf('2026-11', 'fy'))
    expect(m[0]).toBe('2026-04')
    expect(m[11]).toBe('2027-03')
  })
  it('calendar basis', () => {
    expect(periodOf('2026-11', 'calendar').from).toBe('2026-01')
  })
  it('adds months across years', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('employer currency history', () => {
  const emp: Employer = { id: 'a', name: 'A', lines: [], currencies: [{ from: '2024-01', currency: 'LKR' }] }
  it('applies a change from the chosen month onward', () => {
    const e = setCurrencyFrom(emp, '2026-08', 'USD')
    expect(currencyFor(e, '2026-07')).toBe('LKR')
    expect(currencyFor(e, '2026-08')).toBe('USD')
    expect(currencyFor(e, '2027-01')).toBe('USD')
  })
  it('does not add a period when the currency is unchanged', () => {
    expect(setCurrencyFrom(emp, '2026-08', 'LKR').currencies).toHaveLength(1)
  })
})

const lkr: Payslip = {
  id: '1', employerId: 'a', month: '2025-11', currency: 'LKR', rate: 1, source: 'manual', createdAt: 0,
  lines: [
    { name: 'Basic', kind: 'basic', amount: 350000 },
    { name: 'Variable', kind: 'allowance', amount: 150000 },
    { name: 'Ex Gratia', kind: 'bonus', amount: 10000 },
    { name: 'EPF 8%', kind: 'epf', amount: 28000 },
    { name: 'APIT', kind: 'apit', amount: 95000 },
    { name: 'Club', kind: 'deduction_other', amount: 250 },
    { name: 'Stamp', kind: 'stamp', amount: 25 },
    { name: 'EPF 12%', kind: 'er_epf', amount: 42000 },
    { name: 'ETF 3%', kind: 'er_etf', amount: 10500 },
  ],
}
const usd: Payslip = {
  id: '2', employerId: 'b', month: '2025-12', currency: 'USD', rate: 300, source: 'manual', createdAt: 0,
  lines: [{ name: 'Basic', kind: 'basic', amount: 3000 }],
}

describe('slip totals', () => {
  it('matches a real-shaped payslip', () => {
    const t = slipTotals(lkr.lines)
    expect(t.gross).toBe(510000)
    expect(t.deductions).toBe(123275)
    expect(t.net).toBe(386725)
  })
  it('breaks out LKR amounts', () => {
    const l = slipLkr(lkr)
    expect(l.apit).toBe(95000)
    expect(l.other).toBe(275)
    expect(l.employerEpfEtf).toBe(52500)
  })
  it('converts foreign slips at the stored rate', () => {
    const l = slipLkr(usd)
    expect(l.gross).toBe(900000)
    expect(l.net).toBe(900000)
  })
})

describe('summarise', () => {
  it('combines currencies in LKR and reports the FX share', () => {
    const s = summarise([lkr, usd])
    expect(s.gross).toBe(1410000)
    expect(s.fxGross).toBe(900000)
    expect(s.fxByCurrency.USD).toEqual({ amount: 3000, lkr: 900000 })
    expect(s.avgRate.USD).toBe(300)
  })
})
