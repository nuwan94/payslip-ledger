export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3))

export function ym(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}
export function parseYm(v: string): { year: number; month: number } {
  const [y, m] = v.split('-').map(Number)
  return { year: y, month: m - 1 }
}
export function currentYm(now = new Date()): string {
  return ym(now.getFullYear(), now.getMonth())
}
export function formatYm(v: string, short = false): string {
  const { year, month } = parseYm(v)
  return `${(short ? MONTH_SHORT : MONTH_NAMES)[month]} ${year}`
}
export function addMonths(v: string, n: number): string {
  const { year, month } = parseYm(v)
  const t = year * 12 + month + n
  return ym(Math.floor(t / 12), ((t % 12) + 12) % 12)
}
