/** Pure helpers that turn positioned PDF text items into payslip rows. No pdf.js import here. */

export interface TextItem { str: string; x: number; y: number }

export interface PdfRow {
  id: string
  /** Text parts that are not numbers, joined left to right. */
  label: string
  /** Every numeric part on the row, left to right. */
  amounts: number[]
  /** Original text of the row, used when there is no amount (e.g. the pay month). */
  text: string
  /** ISO currency code printed on the row, if any. */
  currency?: string
}

const NUM = /^-?\(?\d[\d,]*(\.\d+)?\)?$/
const CODE = /^(LKR|USD|GBP|EUR|AUD|SGD|AED|CAD|INR|Rs\.?)$/i

export function parseNumber(s: string): number | null {
  const t = s.trim()
  if (!NUM.test(t)) return null
  const neg = t.startsWith('-') || (t.startsWith('(') && t.endsWith(')'))
  const n = parseFloat(t.replace(/[(),-]/g, ''))
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

/** Group items sharing a baseline (within `tol` points), ordered top to bottom. */
export function rowsFromItems(items: TextItem[], tol = 3): PdfRow[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
  const groups: TextItem[][] = []
  for (const it of sorted) {
    const g = groups[groups.length - 1]
    if (g && Math.abs(g[0].y - it.y) <= tol) g.push(it)
    else groups.push([it])
  }
  const rows: PdfRow[] = []
  groups.forEach((g, i) => {
    g.sort((a, b) => a.x - b.x)
    const labelParts: string[] = []
    const amounts: number[] = []
    let currency: string | undefined
    for (const it of g) {
      const s = it.str.trim()
      const n = parseNumber(s)
      if (n !== null) amounts.push(n)
      else if (CODE.test(s)) currency = s.toUpperCase().startsWith('RS') ? 'LKR' : s.toUpperCase()
      else labelParts.push(s)
    }
    rows.push({
      id: `r${i + 1}`,
      label: labelParts.join(' ').replace(/\s+/g, ' ').trim(),
      amounts,
      text: g.map((x) => x.str.trim()).join(' '),
      currency,
    })
  })
  return rows
}
