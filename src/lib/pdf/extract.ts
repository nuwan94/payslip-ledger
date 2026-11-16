import { rowsFromItems, type PdfRow, type TextItem } from './rows'

/** Reads the first page of a text PDF in the browser. The file never leaves the device. */
export async function extractRows(data: ArrayBuffer): Promise<PdfRow[]> {
  const pdfjs = await import('pdfjs-dist')
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const page = await doc.getPage(1)
  const content = await page.getTextContent()
  const items: TextItem[] = []
  for (const it of content.items) {
    if ('str' in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5] })
  }
  const rows = rowsFromItems(items)
  if (!rows.some((r) => r.amounts.length)) {
    throw new Error('No text found in this PDF. Scanned or image-only payslips are not supported yet.')
  }
  return rows
}
