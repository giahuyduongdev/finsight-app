# Dashboard Chart Splitting Requirements

## Introduction

This spec covers the next React Doctor remediation batch for client bundle performance. The branch is `fix/dashboard-chart-splitting`, created from `develop`, and targets the remaining Recharts-related `prefer-dynamic-import` findings and Vite chunk warning.

## Current Findings

React Doctor currently reports:

- `prefer-dynamic-import` - `client/src/components/ui/chart.tsx`
- `prefer-dynamic-import` - `client/src/pages/dashboard/dashboard-data-chart.tsx`
- `prefer-dynamic-import` - `client/src/pages/dashboard/expense-pie-chart.tsx`

Build currently passes but warns that the main JS chunk is larger than 500 kB. The previous measured chunk was approximately `1.56 MB`, gzip approximately `459 kB`.

## Final Results

After lazy-loading the two dashboard chart panels:

- Build passes.
- Main JS chunk changed from approximately `1.56 MB` to `1,125.05 kB`.
- New lazy chunks:
  - `assets/expense-pie-chart-7i80kPDD.js` - `29.77 kB`, gzip `8.33 kB`
  - `assets/dashboard-data-chart-Dgm8MHJx.js` - `40.00 kB`, gzip `10.49 kB`
  - `assets/chart-DOQdzNEJ.js` - `364.90 kB`, gzip `102.95 kB`
- Vite still warns because `assets/index-CFfozVOz.js` remains `1,125.05 kB`, gzip `341.68 kB`.
- React Doctor remains `0 errors / 28 warnings / score 69` because it still reports direct `recharts` imports in the lazy-loaded modules.

`manualChunks` was tested and not kept. It reduced the main chunk further, but introduced circular chunk warnings and still produced a chunk larger than 500 kB. The lazy-only change has a cleaner runtime/build profile.

## Goals

- Move dashboard chart panels out of the initial dashboard route chunk.
- Keep the dashboard visible and stable while chart code loads.
- Reuse existing skeleton/card visual patterns for loading states.
- Re-run React Doctor and build to measure score and chunk movement.
- Document whether `manualChunks` is still needed after lazy loading.

## Non-Goals

- Do not refactor chart rendering behavior beyond code-splitting.
- Do not change dashboard API queries or date range behavior.
- Do not split large components in this branch.
- Do not add `manualChunks` unless measurement shows lazy loading alone is insufficient and the change is clearly beneficial.

## Design Decision

Use `React.lazy` and `Suspense` at the dashboard page boundary:

- `DashboardDataChart` is dynamically imported from `dashboard-data-chart.tsx`.
- `ExpensePieChart` is dynamically imported from `expense-pie-chart.tsx`.
- Dashboard summary and recent transactions stay eager.
- Suspense fallback renders lightweight skeleton cards with matching heights.

`manualChunks` remains deferred. It can move dependencies into named vendor chunks, but the first measured attempt produced circular chunk warnings while still leaving an oversized vendor chunk. A future attempt should be broader and measured as a dedicated build-configuration change, not mixed with dashboard lazy loading.

## Acceptance Criteria

- Dashboard page still renders summary, two chart slots, and recent transactions.
- Chart panels lazy-load without a blank layout jump.
- `pnpm.cmd --dir client run type-check` passes.
- `pnpm.cmd --dir client run lint` passes.
- `pnpm.cmd --dir client run build` passes.
- React Doctor full client scan is recorded after the change.
- Build chunk output is recorded after the change.

## Follow-Up Criteria

The main chunk remains above the warning threshold and React Doctor still reports direct Recharts import findings. Decide separately whether to:

- add `manualChunks` for `recharts`;
- split shared chart primitives further;
- defer because total JS size did not improve enough to justify more complexity.
