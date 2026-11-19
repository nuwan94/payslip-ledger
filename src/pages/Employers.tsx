import { useState } from 'react'
import { db, uid } from '../db'
import { useLedger } from '../useLedger'
import { CURRENCIES, KIND_LABEL, type Employer, type LineKind, type TemplateLine } from '../types'
import { currencyFor, setCurrencyFrom } from '../lib/employer'
import { currentYm, formatYm } from '../lib/dates'
import { AmountInput, Badge, Button, Card, CurrencyBadge, Empty, Field, PageHead } from '../components/ui'
import { fmt } from '../lib/money'
import { Select } from '../components/Select'
import { MonthPicker } from '../components/MonthPicker'
import { Dialog, useConfirm } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { IconPlus, IconTrash } from '../components/Icons'

const CUR_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }))
const KIND_OPTIONS = (Object.keys(KIND_LABEL) as LineKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))

type Mode = { type: 'add' } | { type: 'currency' | 'lines' | 'left'; emp: Employer } | null

export function Employers() {
  const { employers, payslips } = useLedger()
  const [mode, setMode] = useState<Mode>(null)
  const confirm = useConfirm()
  const toast = useToast()
  const today = currentYm()

  const remove = async (e: Employer) => {
    const n = payslips.filter((p) => p.employerId === e.id).length
    const ok = await confirm({
      title: `Delete ${e.name}?`,
      body: n ? `This also deletes its ${n} payslip${n > 1 ? 's' : ''}. This cannot be undone.` : 'This employer has no payslips.',
      confirmLabel: 'Delete', danger: true,
    })
    if (!ok) return
    await db.transaction('rw', db.employers, db.payslips, db.templates, async () => {
      await db.payslips.where('employerId').equals(e.id).delete()
      await db.templates.delete(e.id)
      await db.employers.delete(e.id)
    })
    toast('Employer deleted')
  }

  return (
    <div className="page">
      <PageHead title="Employers" sub="Each employer has a salary currency. If it changes, set the month it starts; older payslips keep the currency they were paid in.">
        <Button variant="primary" onClick={() => setMode({ type: 'add' })}><IconPlus /> Add employer</Button>
      </PageHead>

      {!employers.length ? (
        <Empty title="No employers yet" body="Add the company you are paid by. Use a second employer for a foreign-currency job." action={<Button variant="primary" onClick={() => setMode({ type: 'add' })}>Add employer</Button>} />
      ) : (
        <div className="grid g-2" style={{ alignItems: 'start' }}>
          {employers.map((e) => {
            const count = payslips.filter((p) => p.employerId === e.id).length
            return (
              <Card key={e.id}>
                <div className="stack">
                  <div className="spread">
                    <h2>{e.name}</h2>
                    <span className="row">{e.endedOn && <Badge tone="neutral">Left {formatYm(e.endedOn, true)}</Badge>}<CurrencyBadge currency={currencyFor(e, e.endedOn ?? today)} /></span>
                  </div>
                  <div className="timeline">
                    {e.currencies.map((c, i) => (
                      <div key={c.from} className={`tl ${i === e.currencies.length - 1 && !e.endedOn ? 'now' : ''}`}>
                        <b>{c.currency} from {formatYm(c.from)}</b>
                        <p className="muted small">{i === e.currencies.length - 1 ? `${count} payslip${count === 1 ? '' : 's'} in total` : `until ${formatYm(e.currencies[i + 1].from)} (exclusive)`}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="small muted" style={{ marginBottom: 6 }}>Payslip lines</p>
                    <div className="chips">{e.lines.length ? e.lines.map((l) => <span className="tag" key={l.name + l.kind}>{l.name}{l.amount ? ` · ${fmt(l.amount)}` : ''}</span>) : <span className="muted small">None yet. They are learned from your payslips.</span>}</div>
                  </div>
                  <div className="row">
                    <Button small onClick={() => setMode({ type: 'currency', emp: e })}>Change currency</Button>
                    <Button small onClick={() => setMode({ type: 'lines', emp: e })}>Edit lines</Button>
                    {e.endedOn
                      ? <Button small onClick={async () => { await db.employers.put({ ...e, endedOn: undefined }); toast('Marked as current') }}>Mark as current</Button>
                      : <Button small onClick={() => setMode({ type: 'left', emp: e })}>Mark as left</Button>}
                    <Button small variant="ghost" onClick={() => remove(e)}>Delete</Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {mode?.type === 'add' && <AddDialog onClose={() => setMode(null)} />}
      {mode?.type === 'currency' && <CurrencyDialog emp={mode.emp} onClose={() => setMode(null)} />}
      {mode?.type === 'lines' && <LinesDialog emp={mode.emp} onClose={() => setMode(null)} />}
      {mode?.type === 'left' && <LeftDialog emp={mode.emp} onClose={() => setMode(null)} />}
    </div>
  )
}

function AddDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('LKR')
  const [from, setFrom] = useState(currentYm())
  const toast = useToast()
  const save = async () => {
    if (!name.trim()) { toast('Enter the employer name', 'bad'); return }
    await db.employers.add({ id: uid(), name: name.trim(), currencies: [{ from, currency }], lines: [] })
    toast('Employer added', 'good'); onClose()
  }
  return (
    <Dialog open onClose={onClose} title="Add employer" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Add employer</Button></>}>
      <Field label="Name" htmlFor="emp-name"><input id="emp-name" className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} /></Field>
      <Field label="Salary currency" htmlFor="emp-cur"><Select id="emp-cur" value={currency} options={CUR_OPTIONS} onChange={setCurrency} /></Field>
      <Field label="Paid in this currency from" htmlFor="emp-from" hint="Use the first month you have a payslip for."><MonthPicker id="emp-from" value={from} onChange={setFrom} /></Field>
    </Dialog>
  )
}

function CurrencyDialog({ emp, onClose }: { emp: Employer; onClose: () => void }) {
  const [currency, setCurrency] = useState(currencyFor(emp, currentYm()))
  const [from, setFrom] = useState(currentYm())
  const toast = useToast()
  const save = async () => {
    await db.employers.put(setCurrencyFrom(emp, from, currency))
    toast(`${emp.name} is paid in ${currency} from ${formatYm(from)}`, 'good'); onClose()
  }
  return (
    <Dialog open onClose={onClose} title={`Change currency · ${emp.name}`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Apply from this month</Button></>}>
      <Field label="New salary currency" htmlFor="cur-new"><Select id="cur-new" value={currency} options={CUR_OPTIONS} onChange={setCurrency} /></Field>
      <Field label="Applies from" htmlFor="cur-from"><MonthPicker id="cur-from" value={from} onChange={setFrom} /></Field>
      <div className="callout">Payslips before this month keep the currency they were paid in. New payslips from this month onward ask for an exchange rate if the currency is not LKR.</div>
    </Dialog>
  )
}

function LeftDialog({ emp, onClose }: { emp: Employer; onClose: () => void }) {
  const [last, setLast] = useState(currentYm())
  const toast = useToast()
  return (
    <Dialog open onClose={onClose} title={`Mark ${emp.name} as left`} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={async () => { await db.employers.put({ ...emp, endedOn: last }); toast('Marked as left', 'good'); onClose() }}>Save</Button></>}>
      <Field label="Last pay month" htmlFor="left-last"><MonthPicker id="left-last" value={last} onChange={setLast} /></Field>
    </Dialog>
  )
}

function LinesDialog({ emp, onClose }: { emp: Employer; onClose: () => void }) {
  const [name, setName] = useState(emp.name)
  const [lines, setLines] = useState<(TemplateLine & { key: string })[]>(emp.lines.map((l) => ({ ...l, key: uid() })))
  const toast = useToast()
  const set = (key: string, patch: Partial<TemplateLine>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const save = async () => {
    if (!name.trim()) { toast('Enter the employer name', 'bad'); return }
    const clean = lines.filter((l) => l.name.trim()).map(({ key: _k, ...l }) => ({ ...l, name: l.name.trim(), amount: l.amount || undefined }))
    await db.employers.put({ ...emp, name: name.trim(), lines: clean })
    toast('Saved', 'good'); onClose()
  }
  return (
    <Dialog open wide onClose={onClose} title="Edit employer" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <Field label="Name" htmlFor="lines-name"><input id="lines-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <p className="small muted">Lines pre-fill each new payslip for this employer. Give a line a default amount (in {currencyFor(emp, currentYm())}) for fixed items such as stamp duty or a club fee; leave it blank when it changes every month.</p>
      {lines.length > 0 && (
        <div className="row small muted" style={{ flexWrap: 'nowrap' }}>
          <span style={{ flex: 1 }}>Line</span><span style={{ width: 190 }}>Type</span><span style={{ width: 130, textAlign: 'right' }}>Default amount</span><span style={{ width: 28 }} />
        </div>
      )}
      {lines.map((l) => (
        <div className="row" key={l.key} style={{ flexWrap: 'nowrap' }}>
          <input className="input" aria-label="Line name" value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} />
          <div style={{ width: 190, flex: 'none' }}><Select ariaLabel="Line type" value={l.kind} options={KIND_OPTIONS} onChange={(kind) => set(l.key, { kind })} /></div>
          <div style={{ width: 130, flex: 'none' }}><AmountInput ariaLabel={`Default amount for ${l.name || 'line'}`} value={l.amount ?? 0} blankZero onChange={(amount) => set(l.key, { amount: amount || undefined })} /></div>
          <button type="button" className="icon-btn" aria-label={`Remove ${l.name || 'line'}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><IconTrash /></button>
        </div>
      ))}
      <div><Button onClick={() => setLines((ls) => [...ls, { key: uid(), name: '', kind: 'earning_other' }])}><IconPlus /> Add line</Button></div>
    </Dialog>
  )
}
