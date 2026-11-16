import { useMemo, useState } from 'react'
import type { Employer, Payslip } from '../types'
import { MONTH_SHORT, formatYm, parseYm } from '../lib/dates'
import { fmt, fmt0, r2, slipLkr, slipTotals } from '../lib/money'

interface MonthAgg {
  month: string
  net: number; apit: number; epf: number; other: number; gross: number
  currencies: string[]
  /** e.g. "USD 3,800 × 301.40" for each foreign slip */
  fxNotes: string[]
  employers: string[]
}

export const SERIES = [
  { key: 'net', label: 'Net pay', color: 'var(--net)' },
  { key: 'apit', label: 'APIT', color: 'var(--apit)' },
  { key: 'epf', label: 'EPF 8%', color: 'var(--epf)' },
  { key: 'other', label: 'Other', color: 'var(--other)' },
] as const

export function Legend() {
  return (
    <div className="legend">
      {SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
    </div>
  )
}

function aggregate(months: string[], slips: Payslip[], employers: Employer[]): MonthAgg[] {
  const name = (id: string) => employers.find((e) => e.id === id)?.name ?? 'Unknown employer'
  return months.map((month) => {
    const rows = slips.filter((s) => s.month === month)
    const a: MonthAgg = { month, net: 0, apit: 0, epf: 0, other: 0, gross: 0, currencies: [], fxNotes: [], employers: [] }
    for (const s of rows) {
      const l = slipLkr(s)
      a.net += l.net; a.apit += l.apit; a.epf += l.epf; a.other += l.other; a.gross += l.gross
      if (!a.currencies.includes(s.currency)) a.currencies.push(s.currency)
      const em = name(s.employerId)
      if (!a.employers.includes(em)) a.employers.push(em)
      if (s.currency !== 'LKR') a.fxNotes.push(`${s.currency} ${fmt0(slipTotals(s.lines).gross)} × ${s.rate.toFixed(2)}`)
    }
    for (const k of ['net', 'apit', 'epf', 'other', 'gross'] as const) a[k] = r2(a[k])
    return a
  })
}

const W = 760, H = 310, PL = 58, PR = 10, PT = 12, PB = 58

export function MonthlyChart({ months, slips, employers }: { months: string[]; slips: Payslip[]; employers: Employer[] }) {
  const data = useMemo(() => aggregate(months, slips, employers), [months, slips, employers])
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null)

  const maxGross = Math.max(0, ...data.map((d) => d.gross))
  const step = maxGross > 1_500_000 ? 500_000 : maxGross > 600_000 ? 250_000 : maxGross > 200_000 ? 100_000 : 50_000
  const max = Math.max(step, Math.ceil(maxGross / step) * step)
  const iw = W - PL - PR, ih = H - PT - PB, bw = iw / 12
  const y = (v: number) => PT + ih - (v / max) * ih

  // A marker where the mix of employers/currencies changes between two months that have data.
  const markers: { i: number; label: string }[] = []
  let prev: MonthAgg | null = null
  data.forEach((d, i) => {
    if (!d.gross) return
    if (prev) {
      const sig = (x: MonthAgg) => [...x.employers].sort().join('|') + '#' + [...x.currencies].sort().join('|')
      if (sig(prev) !== sig(d)) {
        const added = d.employers.filter((e) => !prev!.employers.includes(e))
        const cur = d.currencies.join(' + ')
        markers.push({ i, label: added.length ? `New: ${added[0]} · ${cur}` : `Now paid in ${cur}` })
      }
    }
    prev = d
  })

  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  const label = (v: number) => (v === 0 ? '0' : v >= 1_000_000 ? `${(v / 1e6).toFixed(2)}M` : `${v / 1000}k`)

  const show = (i: number, e: React.PointerEvent<Element> | React.FocusEvent<Element>, wrap: DOMRect) => {
    const cx = 'clientX' in e ? e.clientX : wrap.left + PL + i * bw + bw / 2
    const cy = 'clientY' in e ? e.clientY : wrap.top + 40
    setTip({ i, x: cx - wrap.left, y: cy - wrap.top })
  }
  const d = tip ? data[tip.i] : null

  return (
    <div className="chart-wrap" onPointerLeave={() => setTip(null)}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly gross split into net pay, APIT, EPF and other deductions">
        {ticks.map((v) => (
          <g key={v}>
            <line className="gridline" x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end">{label(v)}</text>
          </g>
        ))}
        {data.map((m, i) => {
          const x = PL + i * bw + bw * 0.16, w = bw * 0.68
          const mi = parseYm(m.month).month
          let base = 0
          return (
            <g key={m.month}>
              <text x={x + w / 2} y={H - PB + 16} textAnchor="middle">{MONTH_SHORT[mi]}</text>
              {m.gross === 0 ? (
                <rect x={x} y={y(0) - 2} width={w} height={2} fill="var(--line)" />
              ) : (
                <g
                  className="bar" tabIndex={0}
                  aria-label={`${formatYm(m.month)}: gross ${fmt(m.gross)}, net ${fmt(m.net)}`}
                  onPointerMove={(e) => show(i, e, e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect())}
                  onFocus={(e) => show(i, e, e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect())}
                  onBlur={() => setTip(null)}
                >
                  <rect className="hit" x={PL + i * bw} y={PT} width={bw} height={ih + 22} fill="transparent" />
                  {SERIES.map((s) => {
                    const v = m[s.key]
                    if (v <= 0) return null
                    const r = <rect key={s.key} x={x} y={y(base + v)} width={w} height={(v / max) * ih} fill={s.color} />
                    base += v
                    return r
                  })}
                </g>
              )}
              {m.currencies.some((c) => c !== 'LKR') && (
                <g>
                  <rect x={x} y={H - PB + 24} width={w} height={16} rx={8} fill="var(--fx-bg)" />
                  <text x={x + w / 2} y={H - PB + 36} textAnchor="middle" style={{ fill: 'var(--fx)', fontWeight: 600, fontSize: 10 }}>
                    {m.currencies.find((c) => c !== 'LKR')}
                  </text>
                </g>
              )}
            </g>
          )
        })}
        {markers.map((mk) => {
          const x = PL + mk.i * bw
          return (
            <g key={mk.i}>
              <line x1={x} x2={x} y1={PT} y2={H - PB + 42} stroke="var(--fx)" strokeDasharray="3 4" />
              <text x={x + 6} y={PT + 12} style={{ fill: 'var(--fx)', fontWeight: 600 }}>{mk.label}</text>
            </g>
          )
        })}
      </svg>
      {d && tip && (
        <div className="chart-tip" style={{ left: tip.x > 420 ? tip.x - 220 : tip.x + 14, top: Math.max(0, tip.y - 20) }}>
          <b>{formatYm(d.month)}</b>
          <div style={{ opacity: 0.75 }}><span>{d.employers.join(', ')}</span></div>
          <div><span>Gross</span><span className="num">{fmt(d.gross)}</span></div>
          {d.fxNotes.map((n) => <div key={n} style={{ opacity: 0.75 }}><span>{n}</span></div>)}
          <div><span>APIT</span><span className="num">{fmt(d.apit)}</span></div>
          <div><span>EPF 8%</span><span className="num">{fmt(d.epf)}</span></div>
          <div><b>Net</b><span className="num">{fmt(d.net)}</span></div>
        </div>
      )}
    </div>
  )
}
