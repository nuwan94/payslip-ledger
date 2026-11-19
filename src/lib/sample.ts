import { db, uid } from '../db'
import { r2 } from './money'
import type { Employer, Line, Payslip } from '../types'

/** Fictional demo data so the dashboard has something to show. Dates are relative to `today`. */
export async function loadSample(today: string): Promise<void> {
  const [y, m] = today.split('-').map(Number)
  const ym = (offset: number) => { const t = y * 12 + (m - 1) + offset; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}` }
  const lkr: Employer = {
    id: uid(), name: 'Lanka Software (Pvt) Ltd', endedOn: ym(-4),
    currencies: [{ from: ym(-12), currency: 'LKR' }],
    lines: [
      { name: 'Basic Salary', kind: 'basic', amount: 350000 }, { name: 'Variable Allowance', kind: 'allowance' }, { name: 'Ex Gratia', kind: 'bonus' },
      { name: 'EPF 8%', kind: 'epf', amount: 28000 }, { name: 'APIT', kind: 'apit' }, { name: 'Sports Club', kind: 'deduction_other', amount: 250 }, { name: 'Stamp Duty', kind: 'stamp', amount: 25 },
      { name: 'EPF 12%', kind: 'er_epf' }, { name: 'ETF 3%', kind: 'er_etf' },
    ],
  }
  const fx: Employer = {
    id: uid(), name: 'Northwind Labs',
    currencies: [{ from: ym(-3), currency: 'USD' }],
    lines: [{ name: 'Basic Salary', kind: 'basic' }, { name: 'Bonus', kind: 'bonus' }],
  }
  const slips: Payslip[] = []
  const variable = [198200, 204350.5, 190880.25, 215400, 201000, 207500, 196300, 210100]
  const apit = [124880.12, 128020.4, 121430.77, 140890.3, 126500.1, 129900.55, 123010.2, 134700.4]
  for (let i = 0; i < 8; i++) {
    const basic = 350000
    const lines: Line[] = [
      { name: 'Basic Salary', kind: 'basic', amount: basic },
      { name: 'Variable Allowance', kind: 'allowance', amount: variable[i] },
      ...(i === 3 ? [{ name: 'Ex Gratia', kind: 'bonus' as const, amount: 25000 }] : []),
      { name: 'EPF 8%', kind: 'epf', amount: r2(basic * 0.08) },
      { name: 'APIT', kind: 'apit', amount: apit[i] },
      { name: 'Sports Club', kind: 'deduction_other', amount: 250 },
      { name: 'Stamp Duty', kind: 'stamp', amount: 25 },
      { name: 'EPF 12%', kind: 'er_epf', amount: r2(basic * 0.12) },
      { name: 'ETF 3%', kind: 'er_etf', amount: r2(basic * 0.03) },
    ]
    slips.push({ id: uid(), employerId: lkr.id, month: ym(-12 + i), currency: 'LKR', rate: 1, lines, source: i % 2 ? 'pdf' : 'manual', createdAt: Date.now() })
  }
  const rates = [301.4, 300.85, 299.9]
  for (let i = 0; i < 3; i++) {
    slips.push({
      id: uid(), employerId: fx.id, month: ym(-3 + i), currency: 'USD', rate: rates[i], source: 'manual', createdAt: Date.now(),
      lines: [{ name: 'Basic Salary', kind: 'basic', amount: 3800 }, ...(i === 2 ? [{ name: 'Bonus', kind: 'bonus' as const, amount: 300 }] : [])],
    })
  }
  await db.transaction('rw', db.employers, db.payslips, async () => {
    await db.employers.bulkAdd([lkr, fx])
    await db.payslips.bulkAdd(slips)
  })
}
