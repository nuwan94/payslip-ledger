import { useState } from 'react'
import { buildBackup, db, parseBackup, restoreBackup, wipeAll } from '../db'
import { useLedger } from '../useLedger'
import { usePref, loadPref, savePref } from '../prefs'
import { currentYm } from '../lib/dates'
import { loadSample } from '../lib/sample'
import { Badge, Button, Card, FileDrop, PageHead, Segmented } from '../components/ui'
import { useConfirm } from '../components/Dialog'
import { useToast } from '../components/Toast'

export function Backup() {
  const { employers, payslips } = useLedger()
  const [basis, setBasis] = usePref('basis', 'fy')
  const [last, setLast] = useState(() => loadPref('lastBackup', ''))
  const confirm = useConfirm()
  const toast = useToast()

  const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null

  const exportFile = async () => {
    const data = await buildBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payslip-ledger-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    const now = new Date().toISOString()
    savePref('lastBackup', now); setLast(now)
    toast('Backup file downloaded', 'good')
  }

  const restore = async (f: File) => {
    try {
      const b = parseBackup(await f.text())
      const ok = await confirm({
        title: 'Replace everything with this backup?',
        body: `The file has ${b.employers.length} employer${b.employers.length === 1 ? '' : 's'} and ${b.payslips.length} payslip${b.payslips.length === 1 ? '' : 's'}. Data currently in this browser will be replaced.`,
        confirmLabel: 'Replace', danger: true,
      })
      if (!ok) return
      await restoreBackup(b)
      toast('Backup restored', 'good')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read this file', 'bad')
    }
  }

  return (
    <div className="page">
      <PageHead title="Backup & data" sub="Your data lives only in this browser. Clearing site data erases it, so keep a backup file." />
      <div className="grid g-2" style={{ alignItems: 'start' }}>
        <Card>
          <div className="stack">
            <h2>Backup file</h2>
            <p className="muted">One JSON file with every employer, payslip and saved PDF map. Keep it somewhere you trust, such as a private cloud drive.</p>
            <div className="row"><Button variant="primary" onClick={exportFile}>Export backup</Button></div>
            <p className="small">
              {days === null ? <Badge tone="warn">No backup yet</Badge> : <Badge tone={days > 30 ? 'warn' : 'good'}>{days === 0 ? 'Backed up today' : `Backed up ${days} day${days > 1 ? 's' : ''} ago`}</Badge>}{' '}
              <span className="muted">{employers.length} employers · {payslips.length} payslips stored</span>
            </p>
            <hr className="divider" style={{ margin: '4px 0' }} />
            <h3>Restore</h3>
            <FileDrop accept="application/json,.json" onFile={restore} title="Drop a backup file" hint="Replaces what is stored in this browser." />
          </div>
        </Card>
        <Card>
          <div className="stack">
            <h2>Preferences</h2>
            <div className="field"><label>Year basis</label>
              <Segmented ariaLabel="Year basis" value={basis} onChange={setBasis} options={[{ value: 'fy', label: 'Year of assessment (Apr–Mar)' }, { value: 'calendar', label: 'Calendar year' }]} /></div>
            <hr className="divider" style={{ margin: '4px 0' }} />
            <h3>Data</h3>
            <div className="row">
              <Button onClick={async () => {
                if (payslips.length && !(await confirm({ title: 'Add sample data?', body: 'Fictional employers and payslips will be added next to your own data. You can delete them from the Employers page.', confirmLabel: 'Add sample data' }))) return
                await loadSample(currentYm()); toast('Sample data added', 'good')
              }}>Load sample data</Button>
              <Button variant="danger" onClick={async () => {
                if (await confirm({ title: 'Erase everything?', body: 'All employers, payslips and saved PDF maps in this browser will be deleted. Export a backup first if you need one.', confirmLabel: 'Erase everything', danger: true })) {
                  await wipeAll(); await db.meta.clear(); toast('All data erased')
                }
              }}>Erase all data</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
