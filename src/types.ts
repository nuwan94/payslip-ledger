export type Section = 'earning' | 'deduction' | 'employer'

export type LineKind =
  | 'basic' | 'allowance' | 'bonus' | 'earning_other'
  | 'epf' | 'apit' | 'stamp' | 'deduction_other'
  | 'er_epf' | 'er_etf' | 'employer_other'

export interface Line {
  name: string
  kind: LineKind
  /** Amount in the payslip currency. */
  amount: number
}

export interface CurrencyPeriod {
  /** 'YYYY-MM' the currency applies from (inclusive). */
  from: string
  currency: string
}

export interface TemplateLine {
  name: string
  kind: LineKind
}

export interface Employer {
  id: string
  name: string
  /** Sorted ascending by `from`. */
  currencies: CurrencyPeriod[]
  /** 'YYYY-MM' of the last pay month, if the employment ended. */
  endedOn?: string
  lines: TemplateLine[]
}

export interface Payslip {
  id: string
  employerId: string
  /** 'YYYY-MM' */
  month: string
  currency: string
  /** LKR per 1 unit of `currency`. 1 for LKR. */
  rate: number
  lines: Line[]
  source: 'manual' | 'pdf'
  createdAt: number
}

export type MapTarget = LineKind | 'skip' | 'gross' | 'total_deductions' | 'net' | 'month'

/** Saved PDF field map for one employer: normalised label -> target. */
export interface PdfTemplate {
  employerId: string
  labels: Record<string, MapTarget>
}

export interface Meta { key: string; value: unknown }

export const KIND_SECTION: Record<LineKind, Section> = {
  basic: 'earning', allowance: 'earning', bonus: 'earning', earning_other: 'earning',
  epf: 'deduction', apit: 'deduction', stamp: 'deduction', deduction_other: 'deduction',
  er_epf: 'employer', er_etf: 'employer', employer_other: 'employer',
}

export const KIND_LABEL: Record<LineKind, string> = {
  basic: 'Earning · Basic salary',
  allowance: 'Earning · Allowance',
  bonus: 'Earning · Bonus / one-off',
  earning_other: 'Earning · Other',
  epf: 'Deduction · EPF (employee)',
  apit: 'Deduction · Income tax (APIT)',
  stamp: 'Deduction · Stamp duty',
  deduction_other: 'Deduction · Other',
  er_epf: 'Employer · EPF',
  er_etf: 'Employer · ETF',
  employer_other: 'Employer · Other',
}

export const CURRENCIES = ['LKR', 'USD', 'GBP', 'EUR', 'AUD', 'SGD', 'AED', 'CAD', 'INR']
