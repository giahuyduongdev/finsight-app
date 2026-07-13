# Client Vendor Chunk Strategy Requirements

## Introduction

This spec covers the build-only follow-up after dashboard chart lazy loading. The branch is `fix/client-vendor-chunk-strategy`, created from `develop`, and targets the remaining Vite chunk-size warning in the client build.

## Baseline

Current build output passes but warns because the main JS chunk is still above 500 kB:

- `assets/index-CFfozVOz.js` - `1,125.05 kB`, gzip `341.68 kB`
- `assets/chart-DOQdzNEJ.js` - `364.90 kB`, gzip `102.95 kB`
- `assets/dashboard-data-chart-Dgm8MHJx.js` - `40.00 kB`, gzip `10.49 kB`
- `assets/expense-pie-chart-7i80kPDD.js` - `29.77 kB`, gzip `8.33 kB`

The prior `manualChunks` attempt in `fix/dashboard-chart-splitting` was not kept because it used broad dependency grouping and produced circular chunk warnings while still leaving an oversized vendor chunk.

## Final Results

The final strategy uses narrow package groups and no catch-all vendor chunk. Build passes without Vite chunk-size warnings and without circular chunk warnings.

Final build output:

- `assets/index-D1uAdHzY.js` - `491.43 kB`, gzip `142.31 kB`
- `assets/vendor-recharts-DpEcDH--.js` - `421.02 kB`, gzip `113.70 kB`
- `assets/vendor-react-core-BPMrEk6V.js` - `307.46 kB`, gzip `99.99 kB`
- `assets/vendor-radix-phDty-EI.js` - `99.97 kB`, gzip `29.98 kB`
- `assets/vendor-forms-7Mp9SbY4.js` - `90.88 kB`, gzip `25.31 kB`
- `assets/vendor-table-CUQadOZb.js` - `77.62 kB`, gzip `21.25 kB`
- `assets/vendor-react-router-Cs4ZLjpY.js` - `56.01 kB`, gzip `19.87 kB`
- Dashboard lazy chunks remain below `5 kB` each, while the shared chart chunk remains below `5 kB`.

React Doctor remains unchanged at `0 errors / 28 warnings / score 69`, which is expected because this branch changes build chunking rather than React source diagnostics.

## Goals

- Reduce the main `index` chunk below the Vite 500 kB warning threshold.
- Avoid Rollup circular chunk warnings.
- Keep total behavior unchanged.
- Keep chunk strategy easy to reason about and review.
- Record before/after build output.

## Non-Goals

- Do not lazy-load additional routes in this branch.
- Do not change dashboard chart rendering behavior.
- Do not raise `chunkSizeWarningLimit` just to silence the warning.
- Do not add bundle analyzer dependencies unless the current build output is insufficient.

## Strategy

Use `build.rollupOptions.output.manualChunks` with narrow package groups only:

- `vendor-react-core`: `react`, `react-dom`, `scheduler`
- `vendor-react-router`: `react-router`, `react-router-dom`
- `vendor-recharts`: `recharts`
- `vendor-radix`: `@radix-ui/*`
- `vendor-react-core`: also includes Redux state packages because splitting them separately introduced a circular chunk relationship with React.
- `vendor-forms`: `react-hook-form`, `@hookform/*`, `zod`
- `vendor-table`: `@tanstack/*`

Avoid a catch-all `vendor-misc` group. Unmatched packages should remain in Vite/Rollup default chunks so we do not force unrelated dependencies into circular relationships.

## Acceptance Criteria

- `pnpm.cmd --dir client run type-check` passes.
- `pnpm.cmd --dir client run lint` passes.
- `pnpm.cmd --dir client run build` passes.
- Build output has no circular chunk warnings.
- Main `index` JS chunk is below 500 kB.
- No vendor chunk remains above 500 kB.

## Rollback Criteria

Revert the manual chunk strategy if it:

- introduces circular chunk warnings;
- increases the main chunk materially;
- creates too many tiny chunks without reducing the warning;
- requires behavior changes outside `vite.config.ts`.
