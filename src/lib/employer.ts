import type { Employer } from '../types'

/** Salary currency in force for `month`, using the latest period that started on or before it. */
export function currencyFor(emp: Employer, month: string): string {
  let cur = emp.currencies[0]?.currency ?? 'LKR'
  for (const p of emp.currencies) if (p.from <= month) cur = p.currency
  return cur
}

/** Change the salary currency from `from` onward. Older payslips keep what they were paid in. */
export function setCurrencyFrom(emp: Employer, from: string, currency: string): Employer {
  const kept = emp.currencies.filter((p) => p.from < from)
  const prev = kept[kept.length - 1]
  const next = prev && prev.currency === currency ? kept : [...kept, { from, currency }]
  return { ...emp, currencies: next }
}
