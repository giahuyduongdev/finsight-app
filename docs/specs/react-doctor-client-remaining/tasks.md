# React Doctor Client Remaining Tasks

## Setup

- [x] Create branch `fix/react-doctor-client-remaining`.
- [x] Create remaining React Doctor cleanup spec.
- [x] Confirm open decisions before implementation.
- [x] Run full React Doctor baseline scan on this branch.
- [x] Record baseline counts and affected files.

## Implementation Plan

### Batch 1 - Errors

- [x] Fix `no-impure-state-updater` in import transaction modal.
- [x] Fix `no-impure-state-updater` in shared controls.
- [x] Fix `no-impure-state-updater` in theme/debounce/rates/settings files.
- [x] Run targeted tests or smoke checks for touched areas.

### Batch 2 - Shared-Control Warnings

- [x] Fix or defer `no-chain-state-updates` in `single-select`.
- [x] Fix or defer `no-chain-state-updates` in date range select.
- [x] Fix or defer `no-mirror-prop-effect` in `single-select`.
- [x] Finish low-risk `no-pass-data-to-parent` cleanup in date range select.
- [x] Defer receipt scanner `no-pass-data-to-parent` because it changes scanner result ownership and notification UX.

### Batch 3 - API And Maintainability Warnings

- [x] Decide whether `DataTable` boolean API should be changed in this branch.
- [x] Fix or defer `no-many-boolean-props`.
- [x] Re-check `prefer-dynamic-import` after latest code state.
- [x] Defer deeper chart primitive dynamic imports to avoid another chart loading-state refactor in this branch.
- [x] Defer `no-giant-component` findings to smaller focused refactor branches.

## Validation

- [x] `pnpm.cmd --dir client run type-check` - pass.
- [x] `pnpm.cmd --dir client run lint` - pass.
- [x] `pnpm.cmd --dir client run build` - pass, no chunk warning over 500 kB.
- [x] Relevant `pnpm.cmd --dir client run test -- ...` targets - full client suite pass, `7` files and `24` tests.
- [x] Full `npx.cmd -y react-doctor@latest --json --yes` - `0 errors`, `12 warnings`, `11 affected files`, score `84/100`.
- [x] Update this spec with final counts and remaining diagnostics.
- [x] Update `docs/specs/react-doctor-client-triage/tasks.md`.

## Manual Test Checklist

- [ ] Import transaction modal flow, if touched.
- [ ] Single select open/search/select/create/clear behavior, if touched.
- [ ] Date range select behavior, if touched.
- [ ] DataTable search/loading/bulk delete behavior, if API changes.
- [ ] Settings email/password/theme dialogs, if touched.
- [ ] Rates refresh/update behavior, if touched.
- [x] Receipt scanner flow not required for this branch because receipt scanner code was not changed here.

Manual browser testing remains recommended before merge because this branch touches shared UI state, but automated validation is complete.

## Deferred Items

- [x] Record any React Doctor findings intentionally deferred due to behavior risk.
- [x] Record any follow-up branch names suggested after implementation.

Deferred follow-up branches:

- `refactor/client-receipt-scanner-data-flow`: address receipt scanner `no-pass-data-to-parent` together with scan-result persistence and notification behavior.
- `refactor/client-giant-components`: split large transaction/import/auth/shared-control components in smaller PRs.
- `perf/client-chart-primitive-splitting`: revisit direct Recharts imports only if future bundle analysis requires deeper chart-level lazy loading.
