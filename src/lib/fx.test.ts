import { describe, expect, it } from 'vitest'
import { dailyRate, fxKey, loadFx, monthlyAverage, type FxRates } from './fx'

const rates: FxRates = {
  currency: 'USD', yearOfAssessment: '2026/2027', series: '', source: '', retrievedOn: '2026-11-17', coveredTo: '2026-11-17',
  legalBasis: '', note: '',
  monthly: { '2026-10': { average: 330.5, days: 21 }, '2026-11': { average: 332.5, days: 11 } },
  daily: { '2026-10-30': 330.1, '2026-11-02': 331.9, '2026-11-17': 332.6 },
}

describe('fx lookups', () => {
  it('names files by year of assessment', () => {
    expect(fxKey('USD', '2026-11')).toBe('usd-2026-27')
    expect(fxKey('GBP', '2027-02')).toBe('gbp-2026-27')
    expect(fxKey('EUR', '2026-03')).toBe('eur-2025-26')
  })
  it('returns the monthly average and flags a month still in progress', () => {
    expect(monthlyAverage(rates, '2026-10')).toEqual({ rate: 330.5, days: 21, partial: false })
    expect(monthlyAverage(rates, '2026-11')?.partial).toBe(true)
    expect(monthlyAverage(rates, '2026-09')).toBeNull()
    expect(monthlyAverage(null, '2026-10')).toBeNull()
  })
  it('falls back to the previous business day over a weekend', () => {
    expect(dailyRate(rates, '2026-11-02')).toEqual({ rate: 331.9, date: '2026-11-02' })
    // Sunday 1 Nov and Saturday 31 Oct have no rate; Friday 30 Oct does.
    expect(dailyRate(rates, '2026-11-01')).toEqual({ rate: 330.1, date: '2026-10-30' })
    expect(dailyRate(rates, '2026-01-01')).toBeNull()
  })
  it('loads the bundled files', async () => {
    const usd = await loadFx('USD', '2025-11')
    expect(usd?.currency).toBe('USD')
    expect(monthlyAverage(usd, '2025-11')?.days).toBeGreaterThan(15)
    expect(await loadFx('XXX', '2025-11')).toBeNull()
  })
})
