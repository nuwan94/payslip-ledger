# Payslip Ledger

Track Sri Lankan salary income from payslips: month by month, by year of assessment (1 Apr – 31 Mar) or calendar year, across several employers, including employers paid in a foreign currency.

Everything is stored in the browser (IndexedDB). Nothing is uploaded. Use **Backup & data** to export a JSON file.

## Stack

React, Vite, TypeScript, pnpm, Dexie (IndexedDB), pdf.js (PDF import, read on the device), Vitest.
All UI controls are custom components in `src/components` (select, month picker, tooltip, dialog, toast, checkbox, file drop). No native dropdowns, `title` tooltips or `alert`/`confirm` dialogs.

## Develop

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## Deploy to GitHub Pages

1. Push to a GitHub repository on the `main` branch.
2. In the repo settings, set **Pages → Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds with `VITE_BASE=/` (the app is served from the root of the custom domain `income.nuwan.dev`) and publishes `dist`. Without a custom domain, set `VITE_BASE` to `/<repo-name>/`.

The app uses hash routing, so deep links work without server rewrites.

## How it models income

- An **employer** has a currency history: "USD from Aug 2026" applies to that month onward; older payslips keep their currency.
- A **payslip** stores lines in its own currency plus the LKR-per-unit rate you enter, so past months never change when rates move.
- **Exchange rates**: `rules/fx/<ccy>-<yyyy>-<yy>.json` holds Central Bank of Sri Lanka (CBSL) daily indicative rates and monthly averages for 19 currencies, one file per year of assessment (same layout as `nuwan94/tax-simplified`). The payslip form offers the CBSL monthly average or the rate on the day you were paid; you can still type your bank's rate. Refresh with `node scripts/fx-rates.mjs [startYear] [CCY…]`; a scheduled workflow does this monthly and redeploys.
- **PDF import**: the first PDF for an employer opens a field map (auto-matched, questionable rows flagged, totals reconciled). Saving the map lets later PDFs skip the editor when every label is known and the totals add up. Text PDFs only; scanned images are not supported.
- Name and EPF number on a payslip are never stored.
