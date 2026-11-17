// Downloads Central Bank of Sri Lanka (CBSL) daily indicative exchange rates and writes one file per currency
// for a year of assessment (1 April – 31 March) to rules/fx/<ccy>-<yyyy>-<yy>.json.
// Same file layout as nuwan94/tax-simplified, so the two projects can share data.
//
//   node scripts/fx-rates.mjs              current year of assessment, up to today
//   node scripts/fx-rates.mjs 2025         YA 2025/2026
//   node scripts/fx-rates.mjs 2026 USD EUR only these currencies
//
// A year that is still running gets a partial file; rerun the script to extend it.

import { mkdir, writeFile } from 'node:fs/promises'

const SOURCE = 'https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-indicative-exchange-rates'
const SOURCE_USD = 'https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-indicative-usd-spot-exchange-rates'
const ENDPOINT = 'https://www.cbsl.gov.lk/cbsl_custom/exrates/exrates_results.php'
const ENDPOINT_USD = 'https://www.cbsl.gov.lk/cbsl_custom/exrates/exrates_results_spot_mid.php'

export const CURRENCIES = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'Sterling Pound',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  NZD: 'New Zealand Dollar',
  SGD: 'Singapore Dollar',
  AED: 'UAE  Dirham',
  SAR: 'Saudi Arabian Riyal',
  QAR: 'Qatar Riyal',
  JPY: 'Japanese Yen',
  INR: 'Indian Rupee',
  CHF: 'Swiss Franc',
  SEK: 'Swedish Kroner',
  NOK: 'Norwegian Kroner',
  DKK: 'Danish Kroner',
  HKD: 'Hong Kong Dollar',
  CNY: 'Chinese Yuan (Renminbi)',
  MYR: 'Malaysia  Ringgit',
}

const args = process.argv.slice(2)
const today = new Date().toISOString().slice(0, 10)
const now = new Date()
const defaultYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
const startYear = Number(args.find((a) => /^\d{4}$/.test(a)) ?? defaultYear)
const only = args.filter((a) => /^[A-Za-z]{3}$/.test(a)).map((a) => a.toUpperCase())

const START = `${startYear}-04-01`
const yaEnd = `${startYear + 1}-03-31`
const END = yaEnd < today ? yaEnd : today
const YA = `${startYear}/${startYear + 1}`

async function post(url, body, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { method: 'POST', body })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

async function fetchDaily(code, name) {
  const body = new URLSearchParams({
    lookupPage: 'lookup_daily_exchange_rates.php',
    startRange: '2006-11-11',
    rangeType: 'dates',
    txtStart: START,
    txtEnd: END,
    'chk_cur[]': `${code}~${name}`,
    submit_button: 'Submit',
  })
  const text = (await post(code === 'USD' ? ENDPOINT_USD : ENDPOINT, body)).replace(/<[^>]*>/g, ' ')
  const daily = {}
  for (const [, date, rate] of text.matchAll(/(\d{4}-\d{2}-\d{2})\s+([\d.]+)\s+[\d.]+/g)) {
    if (date >= START && date <= END) daily[date] = Number(rate)
  }
  return Object.fromEntries(Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)))
}

const round4 = (n) => Math.round(n * 10_000) / 10_000
const outDir = new URL('../rules/fx/', import.meta.url)
await mkdir(outDir, { recursive: true })

let failed = 0
for (const [code, name] of Object.entries(CURRENCIES)) {
  if (only.length && !only.includes(code)) continue
  try {
    const daily = await fetchDaily(code, name)
    const days = Object.keys(daily)
    if (!days.length) throw new Error('no rates returned')
    const byMonth = {}
    for (const [date, rate] of Object.entries(daily)) (byMonth[date.slice(0, 7)] ??= []).push(rate)
    const file = {
      currency: code,
      yearOfAssessment: YA,
      series: `CBSL daily indicative ${code === 'USD' ? 'USD/LKR spot ' : ''}exchange rate (LKR per 1 ${code})`,
      source: code === 'USD' ? SOURCE_USD : SOURCE,
      retrievedOn: today,
      coveredTo: days[days.length - 1],
      legalBasis:
        'Inland Revenue Act No. 24 of 2017, s.27: translate at the Central Bank of Sri Lanka exchange rate on the date the amount is taken into account.',
      note: 'Monthly averages are the mean of the business-day rates in that month: an estimate when the exact date of receipt is not known.',
      monthly: Object.fromEntries(
        Object.entries(byMonth).map(([m, rs]) => [m, { average: round4(rs.reduce((s, r) => s + r, 0) / rs.length), days: rs.length }]),
      ),
      daily,
    }
    await writeFile(new URL(`${code.toLowerCase()}-${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}.json`, outDir), JSON.stringify(file, null, 2) + '\n')
    console.log(`${code}: ${days.length} days to ${file.coveredTo}`)
  } catch (e) {
    failed++
    console.error(`${code}: ${e.message}`)
  }
}
if (failed) process.exitCode = 1
