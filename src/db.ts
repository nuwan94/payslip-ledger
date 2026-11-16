import Dexie, { type EntityTable } from 'dexie'
import type { Employer, Meta, PdfTemplate, Payslip } from './types'

class LedgerDB extends Dexie {
  employers!: EntityTable<Employer, 'id'>
  payslips!: EntityTable<Payslip, 'id'>
  templates!: EntityTable<PdfTemplate, 'employerId'>
  meta!: EntityTable<Meta, 'key'>

  constructor() {
    super('payslip-ledger')
    this.version(1).stores({
      employers: 'id',
      payslips: 'id, employerId, month',
      templates: 'employerId',
      meta: 'key',
    })
  }
}

export const db = new LedgerDB()

export const uid = () => crypto.randomUUID()

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value })

export interface BackupFile {
  app: 'payslip-ledger'
  version: 1
  exportedAt: string
  employers: Employer[]
  payslips: Payslip[]
  templates: PdfTemplate[]
}

export async function buildBackup(): Promise<BackupFile> {
  const [employers, payslips, templates] = await Promise.all([
    db.employers.toArray(), db.payslips.toArray(), db.templates.toArray(),
  ])
  return { app: 'payslip-ledger', version: 1, exportedAt: new Date().toISOString(), employers, payslips, templates }
}

export function parseBackup(text: string): BackupFile {
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error('This file is not valid JSON.') }
  const b = data as Partial<BackupFile>
  if (b?.app !== 'payslip-ledger' || !Array.isArray(b.employers) || !Array.isArray(b.payslips)) {
    throw new Error('This is not a Payslip Ledger backup file.')
  }
  return { ...(b as BackupFile), templates: Array.isArray(b.templates) ? b.templates : [] }
}

/** Replaces everything in the database with the backup contents. */
export async function restoreBackup(b: BackupFile): Promise<void> {
  await db.transaction('rw', db.employers, db.payslips, db.templates, async () => {
    await Promise.all([db.employers.clear(), db.payslips.clear(), db.templates.clear()])
    await db.employers.bulkPut(b.employers)
    await db.payslips.bulkPut(b.payslips)
    await db.templates.bulkPut(b.templates)
  })
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.employers, db.payslips, db.templates, db.meta, async () => {
    await Promise.all([db.employers.clear(), db.payslips.clear(), db.templates.clear(), db.meta.clear()])
  })
}
