import type { ReactNode } from 'react'
import type { Employer, Payslip } from '../types'
import { formatYm } from '../lib/dates'
import { fmt, fmt0, slipLkr, slipTotals } from '../lib/money'
import { CurrencyBadge } from './ui'
import { Badge } from './ui'

/** Month-by-month table shared by Overview and Payslips. `actions` adds a trailing cell per row. */
export function SlipTable({ slips, employers, actions, showSource }: {
  slips: Payslip[]
  employers: Employer[]
  actions?: (p: Payslip) => ReactNode
  showSource?: boolean
}) {
  const name = (id: string) => employers.find((e) => e.id === id)?.name ?? 'Unknown employer'
  return (
    <div className="tbl-wrap">
      <table>
        <thead>
          <tr>
            <th>Month</th><th>Employer</th><th className="r">Gross (LKR)</th><th className="r">Deductions</th>
            <th className="r">Net pay</th><th className="r">APIT rate</th>
            {showSource && <th>Source</th>}
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {slips.map((p) => {
            const l = slipLkr(p)
            return (
              <tr key={p.id}>
                <td><b style={{ fontWeight: 600 }}>{formatYm(p.month)}</b></td>
                <td>{name(p.employerId)} <CurrencyBadge currency={p.currency} /></td>
                <td className="r num">
                  {fmt(l.gross)}
                  {p.currency !== 'LKR' && <span className="sub">{p.currency} {fmt0(slipTotals(p.lines).gross)} × {p.rate.toFixed(2)}</span>}
                </td>
                <td className="r num">{fmt(l.gross - l.net)}</td>
                <td className="r num"><b style={{ fontWeight: 600 }}>{fmt(l.net)}</b></td>
                <td className="r num">{l.gross ? `${((l.apit / l.gross) * 100).toFixed(1)}%` : '–'}</td>
                {showSource && <td><Badge>{p.source === 'pdf' ? 'PDF' : 'Manual'}</Badge></td>}
                {actions && <td className="r">{actions(p)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
