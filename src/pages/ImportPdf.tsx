import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, uid } from '../db'
import { useLedger } from '../useLedger'
import { currencyFor } from '../lib/employer'
import { currentYm, formatYm } from '../lib/dates'
import { fmt, slipTotals } from '../lib/money'
import { extractRows } from '../lib/pdf/extract'
import type { PdfRow } from '../lib/pdf/rows'
import { autoMap, buildTemplate, cleanLabel, detectMonth, fullyKnown, reconcile, rowsToLines, type MappedRow } from '../lib/pdf/map'
import { KIND_LABEL, KIND_SECTION, type LineKind, type MapTarget, type Payslip } from '../types'
import { AmountInput, Badge, Button, Card, Checkbox, CurrencyBadge, Empty, FileDrop, LinkButton, PageHead } from '../components/ui'
import { Select, type Option } from '../components/Select'
import { MonthPicker } from '../components/MonthPicker'
import { loadFx, monthlyAverage } from '../lib/fx'
import { useToast } from '../components/Toast'
import type { Draft } from './PayslipForm'

const TARGETS: Option<MapTarget>[] = [
  ...(Object.keys(KIND_LABEL) as LineKind[]).map((k) => ({ value: k as MapTarget, label: KIND_LABEL[k] })),
  { value: 'gross', label: 'Check total · Gross' },
  { value: 'total_deductions', label: 'Check total · Deductions' },
  { value: 'net', label: 'Check total · Net pay' },
  { value: 'month', label: 'Pay month' },
  { value: 'skip', label: "Don't store" },
]

interface Item {
  id: string
  fileName: string
  raw: PdfRow[]
  rows: MappedRow[]
  month?: string
  /** Currency printed on the PDF. */
  currency?: string
  done: boolean
  error?: string
}
interface ReviewRow { include: boolean; month: string; rate: number; /** Rate follows the CBSL monthly average until you type one. */ auto: boolean }
type Stage = { type: 'upload' } | { type: 'map'; id: string } | { type: 'review' }

const PERSONAL = /name|epf\s*n|nic|employee/i

export function ImportPdf() {
  const { ready, employers, templates, payslips } = useLedger()
  const [employerId, setEmployerId] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [stage, setStage] = useState<Stage>({ type: 'upload' })
  const [review, setReview] = useState<Record<string, ReviewRow>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [saveTpl, setSaveTpl] = useState(true)
  const [busy, setBusy] = useState('')
  const nav = useNavigate()
  const toast = useToast()

  const empId = employerId || (employers.length === 1 ? employers[0].id : '')
  const emp = employers.find((e) => e.id === empId)
  const savedTemplate = templates.find((t) => t.employerId === empId)

  const lastRate = (cur: string) =>
    [...payslips].filter((p) => p.currency === cur).sort((a, b) => b.month.localeCompare(a.month))[0]?.rate ?? 0

  /** Sets the CBSL monthly average as the rate for a foreign-currency payslip, falling back to the last rate used. */
  const fillRate = async (id: string, month: string) => {
    if (!emp || !month) return
    const cur = currencyFor(emp, month)
    if (cur === 'LKR') return
    const avg = monthlyAverage(await loadFx(cur, month), month)
    setReview((r) => {
      const row = r[id]
      if (!row || !row.auto) return r
      return { ...r, [id]: avg ? { ...row, rate: avg.rate } : { ...row, rate: lastRate(cur), auto: false } }
    })
  }

  const enterReview = (list: Item[]) => {
    if (!emp) return
    const init: Record<string, ReviewRow> = {}
    const seen = new Set<string>()
    for (const it of list) {
      if (!it.done) continue
      const month = it.month ?? detectMonth(it.raw.map((r) => r.text).join(' ')) ?? ''
      const dupKey = `${month}`
      const exists = !!month && (payslips.some((p) => p.employerId === emp.id && p.month === month) || seen.has(dupKey))
      if (month) seen.add(dupKey)
      init[it.id] = { include: !exists && !!month, month, rate: 0, auto: true }
    }
    setReview(init)
    setStage({ type: 'review' })
    for (const [id, r] of Object.entries(init)) void fillRate(id, r.month)
  }

  const advance = (list: Item[]) => {
    const next = list.find((i) => !i.done && !i.error)
    setSelected(null)
    if (next) setStage({ type: 'map', id: next.id })
    else enterReview(list)
  }

  const onFiles = async (files: File[]) => {
    if (!emp) { toast('Choose the employer first', 'bad'); return }
    const list: Item[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setBusy(`Reading ${i + 1} of ${files.length}…`)
      try {
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') throw new Error('Not a PDF file')
        const raw = await extractRows(await f.arrayBuffer())
        const res = autoMap(raw, savedTemplate)
        list.push({ id: uid(), fileName: f.name, raw, rows: res.rows, month: res.month, currency: res.currency, done: fullyKnown(res.rows, savedTemplate) })
      } catch (e) {
        list.push({ id: uid(), fileName: f.name, raw: [], rows: [], done: false, error: e instanceof Error ? e.message : 'Could not read this PDF' })
      }
    }
    setBusy('')
    if (list.every((i) => i.error)) {
      toast(list[0].error ?? 'Could not read these files', 'bad')
      return
    }
    setItems(list)
    advance(list)
  }

  const updateRow = (itemId: string, rowId: string, patch: Partial<MappedRow>) =>
    setItems((l) => l.map((it) => (it.id === itemId ? { ...it, rows: it.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) } : it)))

  const finishCurrent = async (cur: Item) => {
    if (!emp) return
    let next = items.map((it) => (it.id === cur.id ? { ...it, done: true } : it))
    if (saveTpl) {
      const tpl = buildTemplate(emp.id, cur.rows)
      await db.templates.put(tpl)
      // The remaining files may now be fully known.
      next = next.map((it) => {
        if (it.done || it.error) return it
        const res = autoMap(it.raw, tpl)
        return { ...it, rows: res.rows, month: res.month ?? it.month, currency: res.currency ?? it.currency, done: fullyKnown(res.rows, tpl) }
      })
    }
    setItems(next)
    advance(next)
  }

  const reset = () => { setItems([]); setReview({}); setStage({ type: 'upload' }); setSelected(null) }

  if (ready && !employers.length) {
    return (
      <div className="page">
        <PageHead title="Import payslip PDFs" />
        <Empty title="Add an employer first" body="The saved field map belongs to an employer, so create one before importing." action={<LinkButton to="/employers" variant="primary">Go to employers</LinkButton>} />
      </div>
    )
  }

  const steps = (n: 1 | 2 | 3) => (
    <div className="steps">
      <span className={`step ${n === 1 ? 'cur' : 'done'}`}><i>{n === 1 ? '1' : '✓'}</i>Upload</span>
      <span className={`step ${n === 2 ? 'cur' : n > 2 ? 'done' : ''}`}><i>{n > 2 ? '✓' : '2'}</i>Map fields</span>
      <span className={`step ${n === 3 ? 'cur' : ''}`}><i>3</i>Review &amp; save</span>
    </div>
  )

  /* ---------- 1. upload ---------- */
  if (stage.type === 'upload') {
    return (
      <div className="page">
        <PageHead title="Import payslip PDFs" sub="Drop one PDF or a whole batch. The first unfamiliar layout opens a field map; once you confirm it, the rest of the batch maps by itself.">
          {steps(1)}
        </PageHead>
        <Card>
          <div style={{ maxWidth: 360, marginBottom: 16 }}>
            <label className="small muted" htmlFor="imp-emp" style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Employer (one per batch)</label>
            <Select id="imp-emp" value={empId} placeholder="Choose employer" onChange={setEmployerId}
              options={employers.map((e) => ({ value: e.id, label: e.name, hint: currencyFor(e, currentYm()) }))} />
            <p className="hint" style={{ marginTop: 6 }}>{savedTemplate ? 'A saved map exists for this employer. Known payslips skip the map editor.' : 'No saved map yet. You will confirm one on the next step.'}</p>
          </div>
          <FileDrop multiple accept="application/pdf,.pdf" onFiles={onFiles} title={busy || 'Drop payslip PDFs here'} hint="Text PDFs only. Files are read in this browser and never uploaded." />
        </Card>
      </div>
    )
  }

  /* ---------- 2. map one file ---------- */
  if (stage.type === 'map') {
    const cur = items.find((i) => i.id === stage.id)
    if (!cur) return null
    const rows = cur.rows
    const rec = reconcile(rows)
    const pending = rows.filter((r) => r.status === 'check').length
    const queue = items.filter((i) => !i.error)
    const pos = queue.findIndex((i) => i.id === cur.id) + 1
    const shown = (r: MappedRow) => (r.target === 'month' ? r.text : r.amount === null ? '' : fmt(r.amount))
    const tokCls = (r: MappedRow) => (r.target === 'skip' ? 'skip' : r.status)
    const hidden = (r: MappedRow) => r.target === 'skip' && PERSONAL.test(r.label)
    const rowLabel = (r: MappedRow) => (r.target === 'month' ? cleanLabel(r.label) || 'Pay month' : r.label)
    const waiting = items.filter((i) => !i.done && !i.error && i.id !== cur.id).length

    return (
      <div className="page">
        <PageHead title="Import payslip PDFs" sub="Check what was matched. Amber rows need a look; the totals below must add up.">
          {steps(2)}
        </PageHead>
        <div className="dropbar">
          <div><b>{cur.fileName}</b> <span className="muted small">· file {pos} of {queue.length}{waiting ? ` · confirming this map will also apply to ${waiting} more` : ''}</span></div>
          <div className="row"><span className="muted small">{emp?.name}</span><Button onClick={reset}>Start over</Button></div>
        </div>

        <div className="editor">
          <Card>
            <div className="card-head"><h3>Detected on the payslip</h3>
              <div className="legend">
                <span><i style={{ background: '#dff3e8', outline: '1px solid #9ad3b5' }} />Matched</span>
                <span><i style={{ background: '#fdecc4', outline: '1px solid #e5b44c' }} />Check</span>
                <span><i style={{ background: '#e9ecef', outline: '1px solid #c8cdd2' }} />Not stored</span>
              </div>
            </div>
            <div className="paper">
              {rows.map((r) => (
                <div className="prow" key={r.id}>
                  <span><span className={`tok ${tokCls(r)} ${selected === r.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>{rowLabel(r)}</span></span>
                  <span><span className={`tok ${tokCls(r)} ${selected === r.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>{hidden(r) ? '••••' : shown(r)}</span></span>
                </div>
              ))}
            </div>
          </Card>

          <div className="stack" style={{ gap: 16 }}>
            <Card className="nopad">
              <div className="card-head"><h2>Field map</h2>
                <span><Badge tone="good">{rows.length - pending} matched</Badge> {pending > 0 && <Badge tone="warn">{pending} need a look</Badge>}</span></div>
              <div>
                {rows.map((r) => (
                  <div key={r.id} className={`map ${r.status === 'check' ? 'check' : ''} ${selected === r.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>
                    <div className="lbl"><b>{rowLabel(r)}</b><small>{hidden(r) ? 'hidden' : shown(r)}</small></div>
                    <Select ariaLabel={`Maps ${r.label} to`} value={r.target} options={TARGETS}
                      onChange={(target) => updateRow(cur.id, r.id, { target, status: 'ok' })} />
                    {r.status === 'check'
                      ? <Button small onClick={() => updateRow(cur.id, r.id, { status: 'ok' })}>Looks right</Button>
                      : <Badge tone={r.target === 'skip' ? 'neutral' : 'good'}>{r.target === 'skip' ? 'Not stored' : 'Matched'}</Badge>}
                    {r.status === 'check' && (
                      <div className="why">
                        {r.note}
                        {r.candidates.length > 1 && (
                          <div style={{ maxWidth: 220, marginTop: 6 }}>
                            <Select ariaLabel="Amount for this row" value={String(r.amount)} options={r.candidates.map((c) => ({ value: String(c), label: fmt(c) }))}
                              onChange={(v) => updateRow(cur.id, r.id, { amount: Number(v) })} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="card-head"><h3>Do the numbers add up?</h3></div>
              <div className="recon">
                {rec.checks.length === 0 && <span className="muted">This payslip has no printed totals to compare against.</span>}
                {rec.checks.map((c) => (
                  <div key={c.label}>
                    <span>{c.label} <span className="num">{fmt(c.a)}</span> {c.ok ? '=' : '≠'} <span className="num">{fmt(c.b)}</span></span>
                    <Badge tone={c.ok ? 'good' : 'bad'}>{c.ok ? 'Adds up' : `Off by ${fmt(Math.abs(c.a - c.b))}`}</Badge>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <Checkbox checked={saveTpl} onChange={setSaveTpl}>
                  Save this map for {emp?.name} and apply it to the rest of the batch. Later imports also skip this editor unless a label is new or the totals stop adding up.
                </Checkbox>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
                <Button variant="primary" disabled={pending > 0} onClick={() => finishCurrent(cur)}>
                  {pending > 0 ? `Resolve ${pending} item${pending > 1 ? 's' : ''} first` : rec.ok ? (waiting ? 'Confirm and continue' : 'Review payslips') : 'Continue anyway'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- 3. review and save all ---------- */
  const ready_ = items.filter((i) => i.done)
  const failed = items.filter((i) => i.error)
  const setRow = (id: string, patch: Partial<ReviewRow>) => setReview((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  const meta = (it: Item) => {
    const r = review[it.id] ?? { include: false, month: '', rate: 0, auto: true }
    const cur = emp && r.month ? currencyFor(emp, r.month) : 'LKR'
    const lines = rowsToLines(it.rows)
    const totals = slipTotals(lines)
    const saved = !!emp && !!r.month && payslips.some((p) => p.employerId === emp.id && p.month === r.month)
    const inBatch = !!r.month && ready_.slice(0, ready_.indexOf(it)).some((o) => review[o.id]?.month === r.month)
    return { r, cur, fx: cur !== 'LKR', lines, totals, dup: saved ? 'Already saved' : inBatch ? 'Duplicate month in batch' : '', rec: reconcile(it.rows) }
  }
  const included = ready_.filter((i) => review[i.id]?.include)
  const problems = included.flatMap((i) => {
    const m = meta(i)
    if (!m.r.month) return [`${i.fileName}: choose the pay month`]
    if (m.fx && !(m.r.rate > 0)) return [`${i.fileName}: enter the ${m.cur} to LKR rate`]
    if (!m.lines.some((l) => KIND_SECTION[l.kind] === 'earning')) return [`${i.fileName}: no earnings found`]
    return []
  })

  const saveAll = async () => {
    if (!emp || problems.length) return
    const now = Date.now()
    const slips: Payslip[] = included.map((it) => {
      const m = meta(it)
      return { id: uid(), employerId: emp.id, month: m.r.month, currency: m.cur, rate: m.fx ? m.r.rate : 1, rateSource: m.fx ? (m.r.auto ? 'cbsl-average' : 'manual') : undefined, lines: m.lines, source: 'pdf', createdAt: now }
    })
    const known = new Set(emp.lines.map((l) => `${l.name}|${l.kind}`))
    const added: { name: string; kind: LineKind }[] = []
    for (const s of slips) for (const l of s.lines) {
      const k = `${l.name}|${l.kind}`
      if (!known.has(k)) { known.add(k); added.push({ name: l.name, kind: l.kind }) }
    }
    await db.transaction('rw', db.payslips, db.employers, async () => {
      await db.payslips.bulkAdd(slips)
      if (added.length) await db.employers.put({ ...emp, lines: [...emp.lines, ...added] })
    })
    toast(`Saved ${slips.length} payslip${slips.length === 1 ? '' : 's'}`, 'good')
    nav('/payslips')
  }

  const openInForm = (it: Item) => {
    const m = meta(it)
    const draft: Draft = { employerId: emp!.id, month: m.r.month || currentYm(), lines: m.lines, source: 'pdf', pdfCurrency: it.currency }
    nav('/payslips/new', { state: { draft } })
  }

  return (
    <div className="page">
      <PageHead title="Review imported payslips" sub={`${ready_.length} payslip${ready_.length === 1 ? '' : 's'} ready for ${emp?.name}. Untick any you do not want to save.`}>
        {steps(3)}
      </PageHead>

      {failed.length > 0 && (
        <div className="callout warn">
          {failed.length} file{failed.length > 1 ? 's' : ''} could not be read: {failed.map((f) => `${f.fileName} (${f.error})`).join('; ')}
        </div>
      )}

      <Card>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Save</th><th>File</th><th>Pay month</th><th className="r">Gross</th><th className="r">Net pay</th><th>Checks</th><th>Rate (LKR)</th><th /></tr>
            </thead>
            <tbody>
              {ready_.map((it) => {
                const m = meta(it)
                return (
                  <tr key={it.id}>
                    <td>
                      <Checkbox checked={m.r.include} onChange={(v) => setRow(it.id, { include: v })}><span className="sr-only">Save {it.fileName}</span></Checkbox>
                    </td>
                    <td style={{ maxWidth: 200, overflowWrap: 'anywhere' }}>{it.fileName}</td>
                    <td style={{ minWidth: 170 }}>
                      <MonthPicker ariaLabel={`Pay month for ${it.fileName}`} value={m.r.month} onChange={(v) => { setRow(it.id, { month: v, auto: true }); void fillRate(it.id, v) }} />
                      {m.dup && <div className="hint" style={{ marginTop: 4 }}><Badge tone="warn">{m.dup}</Badge></div>}
                    </td>
                    <td className="r num">{m.cur} {fmt(m.totals.gross)}</td>
                    <td className="r num"><b style={{ fontWeight: 600 }}>{m.cur} {fmt(m.totals.net)}</b></td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <Badge tone={m.rec.ok ? 'good' : 'bad'}>{m.rec.checks.length === 0 ? 'No totals' : m.rec.ok ? 'Adds up' : 'Totals differ'}</Badge>
                        {it.currency && it.currency !== m.cur && <Badge tone="warn">PDF shows {it.currency}</Badge>}
                      </div>
                    </td>
                    <td style={{ width: 130 }}>
                      {m.fx ? <div className="row" style={{ flexWrap: 'nowrap' }}><CurrencyBadge currency={m.cur} /><AmountInput ariaLabel={`Rate for ${it.fileName}`} value={m.r.rate} blankZero onChange={(rate) => setRow(it.id, { rate, auto: false })} /></div> : <span className="muted small">LKR</span>}
                    </td>
                    <td className="r"><Button small onClick={() => openInForm(it)}>Edit in form</Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {problems.length > 0 && <div className="callout warn" style={{ marginTop: 14 }}>{problems.map((p) => <div key={p}>{p}</div>)}</div>}
        <div className="spread" style={{ marginTop: 16 }}>
          <span className="muted small">{included.length} of {ready_.length} selected · {formatYm(currentYm())} is the current month</span>
          <div className="row">
            <Button onClick={reset}>Start over</Button>
            <Button variant="primary" disabled={!included.length || problems.length > 0} onClick={saveAll}>
              Save {included.length} payslip{included.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
