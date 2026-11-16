import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/** Live view of everything stored in this browser. `ready` is false until IndexedDB has answered. */
export function useLedger() {
  const employers = useLiveQuery(() => db.employers.toArray(), [])
  const payslips = useLiveQuery(() => db.payslips.toArray(), [])
  const templates = useLiveQuery(() => db.templates.toArray(), [])
  return {
    ready: employers !== undefined && payslips !== undefined && templates !== undefined,
    employers: employers ?? [],
    payslips: payslips ?? [],
    templates: templates ?? [],
  }
}
