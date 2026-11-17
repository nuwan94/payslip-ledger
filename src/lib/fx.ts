import { fyStartYear } from './period'

/**
 * Central Bank of Sri Lanka (CBSL) indicative rates, one JSON file per currency per year of assessment in
 * rules/fx. Inland Revenue Act s.27: translate at the CBSL rate on the date the amount is taken into account;
 * the monthly average is the estimate when the exact date is not known.
 */
export interface FxRates {
  currency: string
  yearOfAssessment: string
  series: string
  source: string
  retrievedOn: string
  coveredTo?: string
  legalBasis: string
  note: string
  monthly: Record<string, { average: number; days: number }>
  daily: Record<string, number>
}

/** Currencies CBSL publishes, most common first. */
export const FX_CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British pound' },
  { code: 'AUD', name: 'Australian dollar' }, { code: 'CAD', name: 'Canadian dollar' }, { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'SGD', name: 'Singapore dollar' }, { code: 'AED', name: 'UAE dirham' }, { code: 'SAR', name: 'Saudi riyal' },
  { code: 'QAR', name: 'Qatari riyal' }, { code: 'JPY', name: 'Japanese yen' }, { code: 'INR', name: 'Indian rupee' },
  { code: 'CHF', name: 'Swiss franc' }, { code: 'SEK', name: 'Swedish krona' }, { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' }, { code: 'HKD', name: 'Hong Kong dollar' }, { code: 'CNY', name: 'Chinese yuan' },
  { code: 'MYR', name: 'Malaysian ringgit' },
]

const files = import.meta.glob<FxRates>('../../rules/fx/*.json', { import: 'default' })
const cache = new Map<string, Promise<FxRates | null>>()

/** File key such as `usd-2026-27` for a currency and the year of assessment containing `month`. */
export function fxKey(currency: string, month: string): string {
  const y = fyStartYear(month)
  return `${currency.toLowerCase()}-${y}-${String((y + 1) % 100).padStart(2, '0')}`
}

/** Loads (and caches) the rates file for a currency and pay month. Resolves null when none exists. */
export function loadFx(currency: string, month: string): Promise<FxRates | null> {
  const key = fxKey(currency, month)
  let p = cache.get(key)
  if (!p) {
    const loader = files[`../../rules/fx/${key}.json`]
    p = loader ? loader().catch(() => null) : Promise.resolve(null)
    cache.set(key, p)
  }
  return p
}

export interface MonthlyRate { rate: number; days: number; /** true while the month is not over yet */ partial: boolean }

/** Mean of the business-day rates in `month` ('YYYY-MM'). */
export function monthlyAverage(r: FxRates | null, month: string): MonthlyRate | null {
  const m = r?.monthly[month]
  if (!r || !m) return null
  const partial = !!r.coveredTo && r.coveredTo.slice(0, 7) === month && r.coveredTo < lastDayOf(month)
  return { rate: m.average, days: m.days, partial }
}

function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

export interface DailyRate { rate: number; /** The business day the rate was published on. */ date: string }

/** CBSL rate for `date` ('YYYY-MM-DD'), or the latest earlier business day within 10 days (weekends, holidays). */
export function dailyRate(r: FxRates | null, date: string): DailyRate | null {
  if (!r) return null
  const d = new Date(`${date}T00:00:00Z`)
  for (let i = 0; i <= 10; i++) {
    const key = d.toISOString().slice(0, 10)
    const rate = r.daily[key]
    if (rate !== undefined) return { rate, date: key }
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return null
}
