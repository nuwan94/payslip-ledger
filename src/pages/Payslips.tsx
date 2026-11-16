import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db'
import { useLedger } from '../useLedger'
import { Button, Card, Empty, LinkButton, PageHead, Segmented } from '../components/ui'
import { SlipTable } from '../components/SlipTable'
import { useConfirm } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { formatYm } from '../lib/dates'

export function Payslips() {
  const { ready, employers, payslips } = useLedger()
  const [filter, setFilter] = useState<'all' | 'LKR' | 'FX'>('all')
  const nav = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const rows = payslips
    .filter((p) => filter === 'all' || (filter === 'LKR') === (p.currency === 'LKR'))
    .sort((a, b) => b.month.localeCompare(a.month))

  return (
    <div className="page">
      <PageHead title="Payslips" sub="Every payslip you have entered, newest first.">
        <Segmented ariaLabel="Currency filter" value={filter} onChange={setFilter}
          options={[{ value: 'all', label: 'All' }, { value: 'LKR', label: 'LKR' }, { value: 'FX', label: 'Foreign currency' }]} />
        <LinkButton to="/payslips/new" variant="primary">Add payslip</LinkButton>
      </PageHead>
      {ready && !rows.length ? (
        <Empty title="Nothing here" body={payslips.length ? 'No payslips match this filter.' : 'Add a payslip to see it listed.'} action={<LinkButton to="/payslips/new" variant="primary">Add payslip</LinkButton>} />
      ) : (
        <Card>
          <SlipTable
            slips={rows} employers={employers} showSource
            actions={(p) => (
              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                <Button small onClick={() => nav(`/payslips/${p.id}`)}>Open</Button>
                <Button small variant="ghost" onClick={async () => {
                  if (await confirm({ title: 'Delete payslip?', body: `The ${formatYm(p.month)} payslip will be removed from this browser. This cannot be undone.`, confirmLabel: 'Delete', danger: true })) {
                    await db.payslips.delete(p.id)
                    toast('Payslip deleted')
                  }
                }}>Delete</Button>
              </div>
            )}
          />
        </Card>
      )}
    </div>
  )
}
