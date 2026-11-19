import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../db'
import { useLedger } from '../useLedger'
import { KIND_LABEL, KIND_SECTION, type Employer, type Line, type LineKind, type Payslip, type Section } from '../types'
import { currencyFor } from '../lib/employer'
import { currentYm, formatYm } from '../lib/dates'
import { fmt, r2, slipTotals } from '../lib/money'
import { AmountInput, Badge, Button, Card, CurrencyBadge, Empty, Field, LinkButton, PageHead } from '../components/ui'
import { Select, type Option } from '../components/Select'
import { MonthPicker } from '../components/MonthPicker'
import { DatePicker, formatDate } from '../components/DatePicker'
import { dailyRate, loadFx, monthlyAverage, type FxRates } from '../lib/fx'
import { IconPin, IconPlus, IconTrash } from '../components/Icons'
import { Tooltip } from '../components/Tooltip'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Dialog'

export interface Draft {
  employerId: string
  month?: string
  lines: Line[]
  source: 'manual' | 'pdf'
  /** Currency printed on the PDF, for a mismatch warning. */
  pdfCurrency?: string
}

interface LineDraft extends Line { key: string }
const withKey = (l: Line): LineDraft => ({ ...l, key: uid() })

const kindOptions = (section: Section): Option<LineKind>[] =>
  (Object.keys(KIND_LABEL) as LineKind[]).filter((k) => KIND_SECTION[k] === section).map((k) => ({ value: k, label: KIND_LABEL[k].split(' · ')[1] }))

const SECTIONS: { section: Section; title: string; blank: LineKind; add: string }[] = [
  { section: 'earning', title: 'Earnings', blank: 'earning_other', add: 'Add earning line' },
  { section: 'deduction', title: 'Deductions', blank: 'deduction_other', add: 'Add deduction line' },
  { section: 'employer', title: 'Employer contributions', blank: 'employer_other', add: 'Add contribution line' },
]

export function PayslipForm() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const draft = (useLocation().state as { draft?: Draft } | null)?.draft
  const { ready, employers, payslips } = useLedger()
  const existing = useLiveQuery(() => (isNew ? undefined : db.payslips.get(id)), [id, isNew])
  const nav = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const [employerId, setEmployerId] = useState(draft?.employerId ?? '')
  const [month, setMonth] = useState(draft?.month ?? currentYm())
  const [rate, setRate] = useState(0)
  const [rateSource, setRateSource] = useState<'manual' | 'cbsl-average' | 'cbsl-daily'>('manual')
  const [rateDate, setRateDate] = useState('')
  const [fxState, setFxState] = useState<{ key: string; data: FxRates | null } | null>(null)
  const monthTouched = useRef(false)
  const [lines, setLines] = useState<LineDraft[]>(() => draft?.lines.map(withKey) ?? [])
  const [netPrinted, setNetPrinted] = useState(0)
  const [source, setSource] = useState<'manual' | 'pdf'>(draft?.source ?? 'manual')
  const dirty = useRef(!!draft)
  const loaded = useRef(false)
  const [storedCurrency, setStoredCurrency] = useState<string | null>(null)

  // Load an existing payslip once.
  useEffect(() => {
    if (!existing || loaded.current) return
    loaded.current = true
    setEmployerId(existing.employerId); setMonth(existing.month); setRate(existing.rate)
    setRateSource(existing.rateSource ?? 'manual'); setRateDate(existing.rateDate ?? '')
    setLines(existing.lines.map(withKey)); setSource(existing.source); setStoredCurrency(existing.currency)
    dirty.current = true
  }, [existing])

  // Pick the only employer automatically.
  useEffect(() => { if (ready && !employerId && employers.length === 1) setEmployerId(employers[0].id) }, [ready, employers, employerId])

  const emp: Employer | undefined = employers.find((e) => e.id === employerId)
  const currency = storedCurrency ?? (emp ? currencyFor(emp, month) : 'LKR')
  const fx = currency !== 'LKR'

  // Start a new payslip from the employer's saved lines.
  useEffect(() => {
    if (!isNew || !emp || dirty.current) return
    setLines(emp.lines.map((l) => withKey({ ...l, amount: l.amount ?? 0 })))
  }, [isNew, emp?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load the CBSL rates file for this currency and pay month. `fxData` is undefined until it matches the current key.
  const fxKeyNow = fx ? `${currency}|${month}` : ''
  useEffect(() => {
    if (!fx) return
    let live = true
    loadFx(currency, month).then((d) => { if (live) setFxState({ key: `${currency}|${month}`, data: d }) })
    return () => { live = false }
  }, [fx, currency, month])
  const fxData: FxRates | null | undefined = !fx ? null : fxState?.key === fxKeyNow ? fxState.data : undefined
  const avg = useMemo(() => monthlyAverage(fxData ?? null, month), [fxData, month])

  // Fill the rate: CBSL monthly average when known, otherwise the latest rate used in this currency.
  useEffect(() => {
    if (!fx || fxData === undefined) return
    const auto = isNew ? rate === 0 || rateSource === 'cbsl-average' : monthTouched.current && rateSource === 'cbsl-average'
    if (!auto) return
    if (avg) {
      if (rate !== avg.rate) setRate(avg.rate)
      if (rateSource !== 'cbsl-average') setRateSource('cbsl-average')
      return
    }
    if (rate === 0) {
      const last = [...payslips].filter((p) => p.currency === currency).sort((a, b) => b.month.localeCompare(a.month))[0]
      if (last) { setRate(last.rate); setRateSource('manual') }
    }
  }, [fx, fxData, avg, isNew, rate, rateSource, currency, payslips])

  const applyDaily = (date: string) => {
    const d = dailyRate(fxData ?? null, date)
    if (!d) { toast('No CBSL rate stored for that date', 'bad'); return }
    setRate(d.rate); setRateSource('cbsl-daily'); setRateDate(d.date)
  }

  const edit = (fn: (l: LineDraft[]) => LineDraft[]) => { dirty.current = true; setLines(fn) }
  const totals = useMemo(() => slipTotals(lines), [lines])
  const k = fx ? rate : 1
  const netOff = netPrinted > 0 ? r2(netPrinted - totals.net) : null

  const defaultOf = (l: LineDraft) => emp?.lines.find((t) => t.name === l.name.trim() && t.kind === l.kind)?.amount

  /** Pins this line's current amount as the employer's default for new payslips, or clears it. */
  const togglePin = async (l: LineDraft) => {
    const name = l.name.trim()
    if (!emp || !name) { toast('Give the line a name first', 'bad'); return }
    const idx = emp.lines.findIndex((t) => t.name === name && t.kind === l.kind)
    const pinned = defaultOf(l) !== undefined && defaultOf(l) === l.amount
    if (!pinned && l.amount === 0) { toast('Enter an amount to use as the default', 'bad'); return }
    const next = [...emp.lines]
    if (idx >= 0) next[idx] = { ...next[idx], amount: pinned ? undefined : l.amount }
    else next.push({ name, kind: l.kind, amount: l.amount })
    await db.employers.put({ ...emp, lines: next })
    toast(pinned ? `Default cleared for ${name}` : `${name} now starts at ${currency} ${fmt(l.amount)} on new payslips`, 'good')
  }

  const copyLast = () => {
    const prev = payslips.filter((p) => p.employerId === employerId && p.month < month).sort((a, b) => b.month.localeCompare(a.month))[0]
    if (!prev) { toast('No earlier payslip for this employer', 'bad'); return }
    dirty.current = true
    setLines(prev.lines.map(withKey))
    if (prev.currency === currency) { setRate(prev.rate); setRateSource(prev.rateSource ?? 'manual'); setRateDate(prev.rateDate ?? '') }
    toast(`Copied ${formatYm(prev.month)}`, 'good')
  }

  const save = async () => {
    if (!emp) { toast('Choose an employer first', 'bad'); return }
    const kept = lines.filter((l) => l.amount !== 0 && l.name.trim()).map(({ key: _k, ...l }) => ({ ...l, name: l.name.trim() }))
    if (!kept.some((l) => KIND_SECTION[l.kind] === 'earning')) { toast('Add at least one earning with an amount', 'bad'); return }
    if (fx && !(rate > 0)) { toast(`Enter the ${currency} to LKR rate`, 'bad'); return }
    const clash = payslips.some((p) => p.employerId === emp.id && p.month === month && p.id !== (isNew ? '' : id))
    if (clash && !(await confirm({
      title: 'Another payslip exists for this month',
      body: `You already have a ${formatYm(month)} payslip for ${emp.name}. Save this one as well? Both will count in the totals.`,
      confirmLabel: 'Save anyway',
    }))) return

    const slip: Payslip = {
      id: isNew ? uid() : id, employerId: emp.id, month, currency, rate: fx ? rate : 1,
      rateSource: fx ? rateSource : undefined, rateDate: fx && rateSource === 'cbsl-daily' ? rateDate : undefined,
      lines: kept, source, createdAt: existing?.createdAt ?? Date.now(),
    }
    const known = new Set(emp.lines.map((l) => `${l.name}|${l.kind}`))
    const added = kept.filter((l) => !known.has(`${l.name}|${l.kind}`)).map(({ name, kind }) => ({ name, kind }))
    await db.transaction('rw', db.payslips, db.employers, async () => {
      await db.payslips.put(slip)
      if (added.length) await db.employers.put({ ...emp, lines: [...emp.lines, ...added] })
    })
    toast('Payslip saved', 'good')
    nav('/payslips')
  }

  if (ready && !employers.length) {
    return (
      <div className="page">
        <PageHead title="Add payslip" />
        <Empty title="Add an employer first" body="Each payslip belongs to an employer, which also sets the salary currency." action={<LinkButton to="/employers" variant="primary">Go to employers</LinkButton>} />
      </div>
    )
  }
  if (!isNew && existing === undefined) return <div className="page" />
  if (!isNew && existing === null) return <div className="page"><Empty title="Payslip not found" body="It may have been deleted." action={<LinkButton to="/payslips">Back to payslips</LinkButton>} /></div>

  return (
    <div className="page">
      <PageHead title={isNew ? 'Add payslip' : 'Edit payslip'} sub="Lines come from the employer's saved template. Copy last month, then change what moved.">
        <Button onClick={copyLast} disabled={!emp}>Copy last month</Button>
        {isNew && <LinkButton to="/import">Import from PDF</LinkButton>}
      </PageHead>

      <Card>
        <div className="form-row">
          <Field label="Employer" htmlFor="f-emp">
            <Select id="f-emp" value={employerId} placeholder="Choose employer" onChange={(v) => { dirty.current = !isNew; setStoredCurrency(null); setEmployerId(v) }}
              options={employers.map((e) => ({ value: e.id, label: e.name }))} />
          </Field>
          <Field label="Pay month" htmlFor="f-month">
            <MonthPicker id="f-month" value={month} onChange={(m) => { monthTouched.current = true; setStoredCurrency(null); setMonth(m) }} />
          </Field>
          <Field label="Salary currency">
            <div className="row" style={{ minHeight: 36 }}>
              <CurrencyBadge currency={currency} />
              {emp && <span className="muted small">{fx ? 'set by the employer for this month' : 'Sri Lankan rupees'}</span>}
            </div>
          </Field>
          {fx && (
            <Field label={`Rate (LKR per ${currency})`} htmlFor="f-rate">
              <AmountInput id="f-rate" value={rate} onChange={(n) => { setRate(n); setRateSource('manual'); setRateDate('') }} />
            </Field>
          )}
        </div>
        {fx && (
          <div className="fxbox">
            <div className="row">
              <b>CBSL rate</b>
              {fxData === undefined ? <span className="muted small">Loading…</span> : avg ? (
                <>
                  <Button small onClick={() => { setRate(avg.rate); setRateSource('cbsl-average'); setRateDate('') }}>Use {formatYm(month, true)} average {avg.rate.toFixed(4)}</Button>
                  <span className="muted small">mean of {avg.days} business day{avg.days === 1 ? '' : 's'}{avg.partial ? ' so far this month' : ''}</span>
                </>
              ) : <span className="muted small">No {currency} rate stored for {formatYm(month)} yet. Type the rate your bank used.</span>}
            </div>
            {fxData && (
              <div className="row">
                <span className="small">Or the CBSL rate on the day you were paid</span>
                <div style={{ width: 170 }}><DatePicker ariaLabel="Date paid" viewMonth={month} value={rateDate} onChange={applyDaily} /></div>
              </div>
            )}
            <p className="small muted">
              Rate used: {rateSource === 'manual' ? 'typed by you' : rateSource === 'cbsl-average' ? `CBSL ${formatYm(month)} average` : `CBSL rate on ${rateDate ? formatDate(rateDate) : ''}`}.
              {' '}The Inland Revenue Act (s.27) uses the CBSL rate on the date the amount is taken into account; the monthly average is the estimate when you do not know it.
              The LKR values are stored with the payslip, so later rate changes never alter past months.
            </p>
          </div>
        )}
        {draft?.pdfCurrency && draft.pdfCurrency !== currency && (
          <div className="callout warn" style={{ marginTop: 14 }}>
            The PDF shows {draft.pdfCurrency} but this employer is set to {currency} for {formatYm(month)}. Check the employer's currency history if that is wrong.
          </div>
        )}
      </Card>

      <div className="stack" style={{ gap: 20 }}>
        {SECTIONS.map((s, idx) => {
          const rows = lines.filter((l) => KIND_SECTION[l.kind] === s.section)
          return (
            <Card key={s.section} className={idx === 2 ? '' : ''}>
              <div className="card-head">
                <h2>{s.title}</h2>
                {s.section === 'employer' && <span className="muted small">not part of your pay</span>}
              </div>
              <div className="lines">
                {rows.length > 0 && (
                  <div className={`line head ${fx ? '' : 'no-eq'}`}><span>Line</span><span>Type</span><span style={{ textAlign: 'right' }}>Amount ({currency})</span>{fx && <span style={{ textAlign: 'right' }}>LKR value</span>}<span /><span /></div>
                )}
                {rows.length === 0 && <p className="muted small">None on this employer's payslip.</p>}
                {rows.map((l) => (
                  <div className={`line ${fx ? '' : 'no-eq'}`} key={l.key}>
                    <input className="input" aria-label="Line name" value={l.name} placeholder="Name"
                      onChange={(e) => edit((all) => all.map((x) => (x.key === l.key ? { ...x, name: e.target.value } : x)))} />
                    <Select ariaLabel="Line type" value={l.kind} options={kindOptions(s.section)}
                      onChange={(kind) => edit((all) => all.map((x) => (x.key === l.key ? { ...x, kind } : x)))} />
                    <AmountInput ariaLabel={`${l.name || 'Line'} amount`} value={l.amount} blankZero
                      onChange={(amount) => edit((all) => all.map((x) => (x.key === l.key ? { ...x, amount } : x)))} />
                    {fx && <span className="eq num">{fmt(l.amount * k)}</span>}
                    <Tooltip content={defaultOf(l) !== undefined && defaultOf(l) === l.amount ? 'Default for new payslips. Click to clear' : 'Use this amount as the default for new payslips'}>
                      <button type="button" className="icon-btn pin" aria-pressed={defaultOf(l) !== undefined && defaultOf(l) === l.amount} aria-label={`Default amount for ${l.name || 'line'}`} onClick={() => togglePin(l)}><IconPin /></button>
                    </Tooltip>
                    <Tooltip content="Remove line">
                      <button type="button" className="icon-btn" aria-label={`Remove ${l.name || 'line'}`} onClick={() => edit((all) => all.filter((x) => x.key !== l.key))}><IconTrash /></button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              <Button style={{ marginTop: 12 }} onClick={() => edit((all) => [...all, withKey({ name: '', kind: s.blank, amount: 0 })])}><IconPlus /> {s.add}</Button>
            </Card>
          )
        })}
      </div>

      <Card>
        <div className="totals">
          <div className="tot"><span className="muted small">Gross</span><span className="num">{currency} {fmt(totals.gross)}</span>{fx && <span className="small muted num">LKR {fmt(totals.gross * k)}</span>}</div>
          <div className="tot"><span className="muted small">Deductions</span><span className="num">{currency} {fmt(totals.deductions)}</span>{fx && <span className="small muted num">LKR {fmt(totals.deductions * k)}</span>}</div>
          <div className="tot net"><span className="muted small">Net pay</span><span className="num"><b>{currency} {fmt(totals.net)}</b></span>{fx && <span className="small muted num">LKR {fmt(totals.net * k)}</span>}</div>
        </div>
        <div className="spread" style={{ marginTop: 16 }}>
          <div className="row">
            <div style={{ width: 240 }}>
              <Field label="Net pay printed on the slip (optional check)" htmlFor="f-net">
                <AmountInput id="f-net" value={netPrinted} onChange={setNetPrinted} blankZero />
              </Field>
            </div>
            {netOff !== null && (netOff === 0 ? <Badge tone="good">Matches the printed net pay</Badge> : <Badge tone="bad">Off by {fmt(Math.abs(netOff))}</Badge>)}
          </div>
          <div className="row">
            {!isNew && (
              <Button variant="ghost" onClick={async () => {
                if (await confirm({ title: 'Delete payslip?', body: `The ${formatYm(month)} payslip will be removed from this browser.`, confirmLabel: 'Delete', danger: true })) {
                  await db.payslips.delete(id); toast('Payslip deleted'); nav('/payslips')
                }
              }}>Delete</Button>
            )}
            <Button variant="primary" onClick={save}>Save payslip</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
