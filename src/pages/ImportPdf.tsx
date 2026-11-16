import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { useLedger } from '../useLedger'
import { currencyFor } from '../lib/employer'
import { currentYm } from '../lib/dates'
import { fmt } from '../lib/money'
import { extractRows } from '../lib/pdf/extract'
import { autoMap, buildTemplate, cleanLabel, detectMonth, fullyKnown, reconcile, rowsToLines, type MappedRow } from '../lib/pdf/map'
import { KIND_LABEL, type LineKind, type MapTarget } from '../types'
import { Badge, Button, Card, Checkbox, Empty, FileDrop, LinkButton, PageHead } from '../components/ui'
import { Select, type Option } from '../components/Select'
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

interface Parsed { rows: MappedRow[]; month?: string; currency?: string; fileName: string }

export function ImportPdf() {
  const { ready, employers, templates } = useLedger()
  const [employerId, setEmployerId] = useState('')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [saveTpl, setSaveTpl] = useState(true)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const toast = useToast()

  const empId = employerId || (employers.length === 1 ? employers[0].id : '')
  const emp = employers.find((e) => e.id === empId)

  const goToForm = async (p: Parsed, remember: boolean) => {
    if (!emp) return
    const month = p.month ?? detectMonth(p.rows.map((r) => r.text ?? r.label).join(' ')) ?? currentYm()
    if (remember) await db.templates.put(buildTemplate(emp.id, p.rows))
    const draft: Draft = { employerId: emp.id, month, lines: rowsToLines(p.rows), source: 'pdf', pdfCurrency: p.currency }
    nav('/payslips/new', { state: { draft } })
  }

  const onFile = async (f: File) => {
    if (!emp) { toast('Choose the employer first', 'bad'); return }
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast('That is not a PDF file', 'bad'); return }
    setBusy(true)
    try {
      const rows = await extractRows(await f.arrayBuffer())
      const tpl = templates.find((t) => t.employerId === emp.id)
      const res = autoMap(rows, tpl)
      const p: Parsed = { ...res, fileName: f.name }
      if (fullyKnown(res.rows, tpl)) {
        toast('Matched your saved map. Check the numbers and save.', 'good')
        await goToForm(p, false)
      } else {
        setParsed(p)
        setSelected(null)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read this PDF', 'bad')
    } finally {
      setBusy(false)
    }
  }

  const update = (id: string, patch: Partial<MappedRow>) =>
    setParsed((p) => (p ? { ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : p))

  if (ready && !employers.length) {
    return (
      <div className="page">
        <PageHead title="Import payslip PDF" />
        <Empty title="Add an employer first" body="The saved field map belongs to an employer, so create one before importing." action={<LinkButton to="/employers" variant="primary">Go to employers</LinkButton>} />
      </div>
    )
  }

  const hasTemplate = !!templates.find((t) => t.employerId === empId)

  if (!parsed) {
    return (
      <div className="page">
        <PageHead title="Import payslip PDF" sub="The first PDF for an employer opens a field map. After you confirm it, later PDFs from that employer map automatically." >
          <div className="steps"><span className="step cur"><i>1</i>Upload</span><span className="step"><i>2</i>Map fields</span><span className="step"><i>3</i>Review &amp; save</span></div>
        </PageHead>
        <Card>
          <div style={{ maxWidth: 360, marginBottom: 16 }}>
            <label className="small muted" htmlFor="imp-emp" style={{ display: 'block', marginBottom: 5, fontWeight: 500 }}>Employer</label>
            <Select id="imp-emp" value={empId} placeholder="Choose employer" onChange={setEmployerId}
              options={employers.map((e) => ({ value: e.id, label: e.name, hint: currencyFor(e, currentYm()) }))} />
            <p className="hint" style={{ marginTop: 6 }}>{hasTemplate ? 'A saved map exists for this employer. Known payslips go straight to review.' : 'No saved map yet. You will confirm one on the next step.'}</p>
          </div>
          <FileDrop accept="application/pdf,.pdf" onFile={onFile} title={busy ? 'Reading PDF…' : 'Drop a payslip PDF here'} hint="Text PDFs only. The file is read in this browser and never uploaded." />
        </Card>
      </div>
    )
  }

  const rows = parsed.rows
  const rec = reconcile(rows)
  const pending = rows.filter((r) => r.status === 'check').length
  const shown = (r: MappedRow) => (r.target === 'month' ? r.text : r.amount === null ? '' : fmt(r.amount))
  const tokCls = (r: MappedRow) => (r.target === 'skip' ? 'skip' : r.status)

  return (
    <div className="page">
      <PageHead title="Import payslip PDF" sub="Check what was matched. Amber rows need a look; the totals below must add up.">
        <div className="steps"><span className="step done"><i>✓</i>Upload</span><span className="step cur"><i>2</i>Map fields</span><span className="step"><i>3</i>Review &amp; save</span></div>
      </PageHead>
      <div className="dropbar">
        <div><b>{parsed.fileName}</b> <span className="muted small">· read in this browser, never uploaded</span></div>
        <div className="row"><span className="muted small">{emp?.name}</span><Button onClick={() => setParsed(null)}>Choose another PDF</Button></div>
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
                <span><span className={`tok ${tokCls(r)} ${selected === r.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>{r.target === 'month' ? cleanLabel(r.label) || 'Pay month' : r.label}</span></span>
                <span><span className={`tok ${tokCls(r)} ${selected === r.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>{r.target === 'skip' && /name|epf\s*n|nic|employee/i.test(r.label) ? '••••' : shown(r)}</span></span>
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
                  <div className="lbl"><b>{r.target === 'month' ? cleanLabel(r.label) || 'Pay month' : r.label}</b><small>{r.target === 'skip' && /name|epf\s*n|nic|employee/i.test(r.label) ? 'hidden' : shown(r)}</small></div>
                  <Select ariaLabel={`Maps ${r.label} to`} value={r.target} options={TARGETS}
                    onChange={(target) => update(r.id, { target, status: 'ok' })} />
                  {r.status === 'check'
                    ? <Button small onClick={() => update(r.id, { status: 'ok' })}>Looks right</Button>
                    : <Badge tone={r.target === 'skip' ? 'neutral' : 'good'}>{r.target === 'skip' ? 'Not stored' : 'Matched'}</Badge>}
                  {r.status === 'check' && (
                    <div className="why">
                      {r.note}
                      {r.candidates.length > 1 && (
                        <div style={{ maxWidth: 220, marginTop: 6 }}>
                          <Select ariaLabel="Amount for this row" value={String(r.amount)} options={r.candidates.map((c) => ({ value: String(c), label: fmt(c) }))}
                            onChange={(v) => update(r.id, { amount: Number(v) })} />
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
                Save this map for {emp?.name}. The next PDF is mapped automatically, and this editor only reopens if a label is new or the totals stop adding up.
              </Checkbox>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <Button variant="primary" disabled={pending > 0} onClick={() => goToForm(parsed, saveTpl)}>
                {pending > 0 ? `Resolve ${pending} item${pending > 1 ? 's' : ''} first` : rec.ok ? 'Review payslip' : 'Continue anyway'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
