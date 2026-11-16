import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Dialog'
import { Badge } from './components/ui'
import { ThemeSwitch } from './components/ThemeSwitch'
import { useLedger } from './useLedger'
import { loadPref } from './prefs'
import { Overview } from './pages/Overview'
import { Payslips } from './pages/Payslips'
import { PayslipForm } from './pages/PayslipForm'
import { ImportPdf } from './pages/ImportPdf'
import { Employers } from './pages/Employers'
import { Backup } from './pages/Backup'

function backupBadge() {
  const last = loadPref('lastBackup', '')
  if (!last) return <Badge tone="warn">No backup yet</Badge>
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
  return days > 30 ? <Badge tone="warn">Backup {days} days old</Badge> : <Badge tone="good">Backed up</Badge>
}

function Shell() {
  const { payslips } = useLedger()
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined)
  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-top">
          <div className="brand"><b>Payslip Ledger</b><span>Sri Lanka · income tracker</span></div>
          <ThemeSwitch />
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className={link}>Overview</NavLink>
          <NavLink to="/payslips" end className={link}>Payslips <span className="count">{payslips.length}</span></NavLink>
          <NavLink to="/payslips/new" className={link}>Add payslip</NavLink>
          <NavLink to="/import" className={link}>Import PDF</NavLink>
          <NavLink to="/employers" className={link}>Employers</NavLink>
          <NavLink to="/backup" className={link}>Backup &amp; data</NavLink>
        </nav>
        <div className="rail-foot">
          {backupBadge()}
          <p className="privacy">Everything is stored in this browser. Nothing is uploaded; PDFs are read on your device.</p>
        </div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/payslips" element={<Payslips />} />
          <Route path="/payslips/:id" element={<PayslipForm />} />
          <Route path="/import" element={<ImportPdf />} />
          <Route path="/employers" element={<Employers />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </ToastProvider>
  )
}
