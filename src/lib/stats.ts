import type { Payslip } from '../types'
import { r2, slipLkr, slipTotals, type SlipLkr } from './money'

export interface Summary {
  count: number
  gross: number
  net: number
  apit: number
  epf: number
  other: number
  employerEpfEtf: number
  fxGross: number
  /** Per foreign currency: amount in that currency and its LKR value. */
  fxByCurrency: Record<string, { amount: number; lkr: number }>
  /** Weighted average LKR per unit, per foreign currency. */
  avgRate: Record<string, number>
  rateRange: Record<string, [number, number]>
}

export function summarise(slips: Payslip[]): Summary {
  const s: Summary = {
    count: slips.length, gross: 0, net: 0, apit: 0, epf: 0, other: 0, employerEpfEtf: 0,
    fxGross: 0, fxByCurrency: {}, avgRate: {}, rateRange: {},
  }
  for (const p of slips) {
    const l = slipLkr(p)
    s.gross += l.gross; s.net += l.net; s.apit += l.apit; s.epf += l.epf; s.other += l.other
    s.employerEpfEtf += l.employerEpfEtf
    if (p.currency !== 'LKR') {
      const amount = slipTotals(p.lines).gross
      const cur = (s.fxByCurrency[p.currency] ??= { amount: 0, lkr: 0 })
      cur.amount = r2(cur.amount + amount)
      cur.lkr = r2(cur.lkr + l.gross)
      s.fxGross += l.gross
      const r = s.rateRange[p.currency]
      s.rateRange[p.currency] = r ? [Math.min(r[0], p.rate), Math.max(r[1], p.rate)] : [p.rate, p.rate]
    }
  }
  for (const [c, v] of Object.entries(s.fxByCurrency)) s.avgRate[c] = v.amount ? r2(v.lkr / v.amount) : 0
  for (const k of ['gross', 'net', 'apit', 'epf', 'other', 'employerEpfEtf', 'fxGross'] as const) s[k] = r2(s[k])
  return s
}

export type { SlipLkr }
