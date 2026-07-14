# React Doctor Remaining Warnings Requirements

## Introduction

This spec covers branch `refactor/client-react-doctor-remaining-warnings`.

The goal is to remove the remaining React Doctor warnings in the client after `fix/react-doctor-client-remaining` was merged into `develop`.

## Baseline

Full React Doctor scan on this branch:

- `0 errors`
- `13 warnings`
- `11 affected files`
- Score `84/100`
- Label `Needs work`

Warning groups:

- `8` `no-giant-component`
- `3` `prefer-dynamic-import`
- `1` `no-pass-data-to-parent`
- `1` `only-export-components`

## Final Result

Full React Doctor final scan:

- `0 errors`
- `0 warnings`
- `0 affected files`
- Score `100/100`
- Label `Great`

Build result:

- Production build passes.
- No Vite chunk warning over `500 kB`.
- Largest JS chunks after final build: `index` about `493.28 kB`, `vendor-recharts` about `452.17 kB`, `vendor-react-core` about `307.46 kB`.

## Goals

- Reduce React Doctor warnings as close to `0` as possible without disabling rules.
- Preserve existing UI behavior unless the behavior is explicitly part of fixing receipt scanner background scan UX.
- Keep work frontend-only inside `client`, plus specs.
- Make component splits follow existing project style.
- Keep validation strict: type-check, lint, test, build, and full React Doctor scan.

## Scope

### Receipt Scanner Data Flow

Fix `no-pass-data-to-parent` in `src/features/transaction/components/reciept-scanner.tsx`.

The scanner should not push scan result data to the parent from an effect. Scan completion should call the parent callback directly from the async/socket completion path.

Implementation note: scan orchestration now lives in a receipt scanner hook owned by the transaction form, while the scanner component renders upload/progress UI.

### Recharts Dynamic Imports

Fix `prefer-dynamic-import` warnings in:

- `src/components/ui/chart.tsx`
- `src/pages/dashboard/dashboard-data-chart.tsx`
- `src/pages/dashboard/expense-pie-chart.tsx`

Chart rendering must keep existing loading behavior and avoid blank charts.

Implementation note: Recharts is loaded through a shared dynamic module hook. Dashboard charts render the actual Recharts primitive component references after the module loads, instead of wrapping primitives in `React.lazy`, because Recharts inspects child component identity. Chart dependencies are split into `vendor-recharts` and `vendor-chart-utils`.

### Single Select Export Boundary

Fix `only-export-components` in `src/components/ui/single-select.tsx` by moving non-component exports to companion modules.

### Giant Components

Split large components with natural boundaries:

- `src/components/ui/single-select.tsx`
- `src/features/transaction/components/import-transaction-modal/confirmation-step.tsx`
- `src/features/transaction/components/import-transaction-modal/edit-form.tsx`
- `src/features/transaction/components/reciept-scanner.tsx`
- `src/features/transaction/components/transaction-form.tsx`
- `src/features/transaction/components/transaction-table/index.tsx`
- `src/pages/auth/_component/forgot-password-form.tsx`
- `src/pages/auth/_component/signup-form.tsx`

The split should reduce file/component size without changing user-facing behavior.

Implementation note: large public components were reduced by extracting step components and hook-backed view implementations while preserving existing props and render behavior.

## Non-Goals

- Do not change backend APIs.
- Do not change database models.
- Do not add React Doctor CI enforcement.
- Do not redesign visual UI.
- Do not rewrite unrelated flows.

## Acceptance Criteria

- Branch name matches CI pattern: `refactor/**`.
- Full React Doctor baseline is recorded.
- Full React Doctor final scan is recorded.
- `pnpm.cmd --dir client run type-check` passes.
- `pnpm.cmd --dir client run lint` passes.
- `pnpm.cmd --dir client run test` passes.
- `pnpm.cmd --dir client run build` passes.
- Specs are updated with final counts and remaining risks.

## Manual Test Requirements

- Receipt scanner: upload image, scan success, close drawer during processing, confirm result notification/result behavior.
- Add transaction form: manual entry, AI scan prefill, save.
- Transactions table: search, filters, date range, pagination, expand recurring rows, bulk delete.
- Dashboard: charts load and update with date range.
- Import transaction modal: upload CSV, map columns, confirm/import, edit rows.
- Single select: open, search, select, create, clear.
- Auth forms: forgot password and signup flows still validate and submit.
