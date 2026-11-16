import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLedger } from '../useLedger'
import { usePref } from '../prefs'
import { currentYm, formatYm } from '../lib/dates'
import { monthsIn, periodsFor } from '../lib/period'
import { summarise } from '../lib/stats'
import { fmt, fmt0 } from '../lib/money'
import { Card, CurrencyBadge, Empty, LinkButton, PageHead } from '../components/ui'
import { Select } from '../components/Select'
import { Legend, MonthlyChart } from '../components/MonthlyChart'
import { SlipTable } from '../components/SlipTable'
import { Button } from '../components/ui'
import { loadSample } from '../lib/sample'
import { useToast } from '../components/Toast'

export function Overview() {
  const { ready, employers, payslips } = useLedger()
  const [basis] = usePref('basis', 'fy')
  const today = currentYm()
  const periods = useMemo(() => periodsFor(payslips, basis, today), [payslips, basis, today])
  const [periodKey, setPeriodKey] = useState<string>('')
  const [empId, setEmpId] = useState<string>('all')
  const toast = useToast()

  const period = periods.find((p) => p.key === periodKey) ?? periods[0]
  const inPeriod = useMemo(
    () => payslips.filter((s) => s.month >= period.from && s.month <= period.to && (empId === 'all' || s.employerId === empId)),
    [payslips, period, empId],
  )
  const sum = useMemo(() => summarise(inPeriod), [inPeriod])
  const months = useMemo(() => monthsIn(period), [period])

  if (!ready) return <div className="page" />
  if (!payslips.length) {
    return (
      <div className="page">
        <PageHead title="Overview" sub="Your take-home pay, tax and contributions, month by month." />
        <Empty
          title="No payslips yet"
          body="Add your first payslip by hand or import a PDF. Everything stays in this browser."
          action={
            <div className="row">
              <LinkButton to="/payslips/new" variant="primary">Add payslip</LinkButton>
              <LinkButton to="/import">Import PDF</LinkButton>
              <Button onClick={async () => { await loadSample(today); toast('Sample data loaded', 'good') }}>Load sample data</Button>
            </div>
          }
        />
      </div>
    )
  }

  const bySplit = employers
    .map((e) => ({ e, rows: inPeriod.filter((s) => s.employerId === e.id) }))
    .filter((x) => x.rows.length)
    .map((x) => ({ ...x, s: summarise(x.rows), currency: x.rows[x.rows.length - 1].currency }))
  const fxEntries = Object.entries(sum.fxByCurrency)
  const recent = [...inPeriod].sort((a, b) => a.month.localeCompare(b.month))

  return (
    <div className="page">
      <PageHead title="Overview" sub={`Year of assessment ${period.label.replace('FY ', '')} · ${formatYm(period.from)} – ${formatYm(period.to)}`}>
        <div style={{ width: 150 }}>
          <Select className="pill" ariaLabel="Period" value={period.key} onChange={setPeriodKey} options={periods.map((p) => ({ value: p.key, label: p.label }))} />
        </div>
        <div style={{ width: 220 }}>
          <Select className="pill" ariaLabel="Employer" value={empId} onChange={setEmpId}
            options={[{ value: 'all', label: 'All employers' }, ...employers.map((e) => ({ value: e.id, label: e.name }))]} />
        </div>
      </PageHead>

      {!inPeriod.length ? (
        <Empty title={`No payslips in ${period.label}`} body="Pick another period or add a payslip for this one." action={<LinkButton to="/payslips/new" variant="primary">Add payslip</LinkButton>} />
      ) : (
        <>
          <div className="kpis">
            <div className="kpi lead">
              <span className="label">Take-home so far this period</span>
              <span className="value">LKR {fmt(sum.net)}</span>
              <span className="foot">{sum.count} payslip{sum.count > 1 ? 's' : ''} · avg LKR {fmt0(sum.net / sum.count)} a payslip</span>
            </div>
            <div className="kpi"><span className="label">Gross earned</span><span className="value">{fmt(sum.gross)}</span>
              <span className="foot">{sum.gross ? Math.round((sum.fxGross / sum.gross) * 100) : 0}% in foreign currency</span></div>
            <div className="kpi"><span className="label">APIT withheld</span><span className="value">{fmt(sum.apit)}</span>
              <span className="foot">{sum.gross ? ((sum.apit / sum.gross) * 100).toFixed(1) : '0.0'}% of all gross</span></div>
            <div className="kpi"><span className="label">EPF 8% paid by you</span><span className="value">{fmt(sum.epf)}</span>
              <span className="foot">+ employer EPF/ETF LKR {fmt(sum.employerEpfEtf)}</span></div>
          </div>

          <div className="grid g-main">
            <Card>
              <div className="card-head"><h2>Month by month</h2><Legend /></div>
              <MonthlyChart months={months} slips={inPeriod} employers={employers} />
            </Card>
            <Card>
              <div className="card-head"><h2>Where it came from</h2></div>
              <div className="split">
                {bySplit.map(({ e, s, currency }) => (
                  <div className="split-row" key={e.id}>
                    <div className="top"><span><b style={{ fontWeight: 600 }}>{e.name}</b> <CurrencyBadge currency={currency} /></span><span className="num">{fmt0(s.gross)}</span></div>
                    <div className="bar-track"><span style={{ width: `${sum.gross ? (s.gross / sum.gross) * 100 : 0}%`, background: currency === 'LKR' ? 'var(--accent)' : 'var(--fx)' }} /></div>
                    <p className="small muted" style={{ marginTop: 3 }}>{sum.gross ? Math.round((s.gross / sum.gross) * 100) : 0}% of gross · {s.count} payslip{s.count > 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
              {fxEntries.length > 0 && (
                <>
                  <hr className="divider" />
                  {fxEntries.map(([c, v]) => (
                    <dl className="facts" key={c} style={{ marginBottom: 10 }}>
                      <dt>Foreign income</dt><dd className="num">{c} {fmt0(v.amount)}</dd>
                      <dt>Average rate</dt><dd className="num">{sum.avgRate[c].toFixed(2)}</dd>
                      <dt>Rate range</dt><dd className="num">{sum.rateRange[c][0].toFixed(2)} – {sum.rateRange[c][1].toFixed(2)}</dd>
                      <dt>LKR value</dt><dd className="num">{fmt0(v.lkr)}</dd>
                    </dl>
                  ))}
                </>
              )}
            </Card>
          </div>

          <Card>
            <div className="card-head"><h2>Payslips this period</h2><Link to="/payslips" className="small" style={{ color: 'var(--accent)' }}>All payslips</Link></div>
            <SlipTable slips={recent} employers={employers} />
          </Card>
        </>
      )}
    </div>
  )
}
