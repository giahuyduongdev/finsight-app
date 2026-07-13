# Dashboard Chart Splitting Tasks

## Implementation

- [x] Create branch `fix/dashboard-chart-splitting`.
- [x] Lazy-load `DashboardDataChart` from `client/src/pages/dashboard/index.tsx`.
- [x] Lazy-load `ExpensePieChart` from `client/src/pages/dashboard/index.tsx`.
- [x] Add local Suspense fallback skeletons for both dashboard chart slots.
- [x] Keep `manualChunks` unchanged for the final validation pass.

## Validation

- [x] Run `pnpm.cmd --dir client run type-check`.
- [x] Run `pnpm.cmd --dir client run lint`.
- [x] Run `pnpm.cmd --dir client run build`.
- [x] Run full `npx.cmd -y react-doctor@latest --json --yes`.
- [x] Record final warning count, score, and build chunk output.

## Decision Gate

- [x] Lazy loading materially improved chunk output, but did not remove the Vite warning.
- [x] `manualChunks` was tested and not kept because it introduced circular chunk warnings and still left an oversized chunk.
- [x] React Doctor still flags direct Recharts imports; deeper chart primitive splitting is deferred.

## Final Measurements

- React Doctor: `0 errors`, `28 warnings`, `14 affected files`, score `69/100`.
- Build: pass.
- Main JS chunk: `assets/index-CFfozVOz.js` - `1,125.05 kB`, gzip `341.68 kB`.
- Lazy chart chunks:
  - `assets/expense-pie-chart-7i80kPDD.js` - `29.77 kB`, gzip `8.33 kB`
  - `assets/dashboard-data-chart-Dgm8MHJx.js` - `40.00 kB`, gzip `10.49 kB`
  - `assets/chart-DOQdzNEJ.js` - `364.90 kB`, gzip `102.95 kB`
