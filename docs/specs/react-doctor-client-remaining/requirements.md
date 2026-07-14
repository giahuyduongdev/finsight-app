# React Doctor Client Remaining Requirements

## Introduction

This spec covers a single larger cleanup branch: `fix/react-doctor-client-remaining`.

The goal is to reduce the remaining React Doctor diagnostics in `client` after the earlier focused branches for receipt scanner effects, dashboard chart splitting, and vendor chunking.

## Current Baseline

Latest recorded full React Doctor result from the receipt scanner branch:

- `14 errors`
- `20 warnings`
- `21 affected files`
- Score `51/100`
- Label `Critical`

The first implementation step must re-run React Doctor on the current branch and update this baseline if the CLI or source has changed.

Current branch scan history:

- Branch baseline: `14 errors`, `20 warnings`, `21 affected files`, score `51/100`, label `Critical`.
- Latest interim scan: `0 errors`, `13 warnings`, `12 affected files`, score `83/100`, label `Needs work`.
- Final scan: `0 errors`, `12 warnings`, `11 affected files`, score `84/100`, label `Needs work`.

Final remaining warning groups:

- `8` `no-giant-component` maintainability warnings.
- `3` `prefer-dynamic-import` Recharts warnings.
- `1` `no-pass-data-to-parent` warning in receipt scanner.

## Goals

- Fix all practical `no-impure-state-updater` errors.
- Fix shared-control state warnings where the behavior is clear.
- Finish the low-risk `DateRangeSelect` parent data flow cleanup.
- Reduce warning count for React Doctor findings that can be handled without redesigning product behavior.
- Keep the fixes frontend-only inside `client`.
- Preserve existing user workflows for transactions, settings, rates, charts, and import flows.
- Update React Doctor triage docs with before/after counts.

## Non-Goals

- Do not fix the receipt scanner background notification UX bug in this branch.
- Do not rewrite receipt scanner data ownership in this branch.
- Do not redesign transaction creation, import CSV, dashboard, or settings flows.
- Do not change backend APIs, socket event contracts, notification contracts, or data models.
- Do not add React Doctor CI enforcement in this branch.
- Do not chase cosmetic rewrites that do not reduce diagnostics or risk.

## Diagnostic Groups

### 1. State Updater Errors

Target `no-impure-state-updater` first because React Doctor reports these as errors.

Known affected areas from the last scan:

- `src/features/transaction/components/import-transaction-modal/index.tsx`
- `src/components/ui/single-select.tsx`
- `src/components/data-table/index.tsx`
- `src/context/theme-provider.tsx`
- `src/hooks/use-debounce-search.ts`
- `src/pages/rates/index.tsx`
- `src/pages/settings/_components/appearance-theme.tsx`
- `src/pages/settings/_components/change-email-dialog.tsx`
- `src/pages/settings/_components/change-password-dialog.tsx`

Expected fix shape:

- Keep state updater callbacks pure.
- Move ref writes, storage writes, timers, toast calls, and other side effects outside updater functions.
- Prefer small local edits over helper abstractions unless the same pattern repeats clearly.

### 2. Shared-Control State Warnings

Known warnings:

- `no-chain-state-updates`
- `no-mirror-prop-effect`
- `no-pass-data-to-parent`

Affected areas include:

- `src/components/ui/single-select.tsx`
- `src/components/date-range-select/index.tsx`
- `src/features/transaction/components/reciept-scanner.tsx`

Expected fix shape:

- Avoid changing component public APIs unless needed.
- Keep controlled/uncontrolled behavior stable.
- Add or run targeted tests where shared controls already have coverage.

Decision:

- Fixed `DateRangeSelect` by moving default range ownership to parents and keeping preset helpers outside the component module.
- Defer receipt scanner parent synchronization because it is tied to scanner result persistence and notification UX.

### 3. DataTable Boolean API

Known warning:

- `no-many-boolean-props` in `src/components/data-table/index.tsx`

Potential fix shape:

- Replace multiple boolean props with a named options object, if call sites are manageable.
- Keep the API change in this branch because there are only a few call sites and the behavior remains equivalent.

### 4. Dynamic Import Warnings

Known warning:

- `prefer-dynamic-import` around chart/Recharts modules.

Potential fix shape:

- Re-check after previous chart lazy-loading and vendor chunk work.
- Only change imports if it materially reduces diagnostics without harming chart loading states.

Decision:

- Defer deeper Recharts primitive splitting in this branch. Dashboard-level lazy loading and vendor chunking were already handled in previous branches; remaining direct imports would require a larger chart module split with extra loading-state review.
- Build output after this branch has no Vite chunk warning over 500 kB; the largest JS chunks are `index` about `492.24 kB` and `vendor-recharts` about `421.02 kB`.

### 5. Giant Components

Known warning:

- `no-giant-component` across large UI files.

Potential fix shape:

- Fix only if there are obvious extraction boundaries with low behavior risk.
- Avoid broad component surgery in this branch if it threatens validation or reviewability.

Decision:

- Defer `no-giant-component` findings. They are maintainability refactors, not runtime errors, and should be split into smaller branch-specific PRs.

## Acceptance Criteria

- Branch starts from current `develop`.
- Full React Doctor scan is recorded before implementation.
- Full React Doctor scan is recorded after implementation.
- `pnpm.cmd --dir client run type-check` passes.
- `pnpm.cmd --dir client run lint` passes.
- `pnpm.cmd --dir client run build` passes.
- Relevant targeted tests pass where touched files have existing tests.
- Specs are updated with final counts, deferred items, and manual-test notes.

## Manual Test Requirements

Manual test only flows touched by code changes. Likely candidates:

- Add transaction form if receipt scanner or transaction form changes again.
- Import transaction modal if state updater fixes touch import flow.
- Single select behavior in category/date/filter controls.
- Date range select behavior in dashboard/transactions filters.
- Settings dialogs if email/password/theme state changes.
- Rates page refresh/update behavior if rates state updater is changed.

Recommended manual smoke test before merge:

1. Dashboard date range filter changes summary/cards/charts/recent transactions.
2. Transactions table date range filter still filters rows and pagination/search continue working.
3. DataTable search, loading state, pagination, and bulk delete controls still render correctly.
4. Import transaction modal can open, step through CSV mapping, close, and reopen.
5. Single select controls can open, search, select, create, and clear options.
6. Settings theme, change email, and change password dialogs reset/close correctly.
7. Rates page loads and updates rates as before.

## Risks

- This is intentionally larger than previous cleanup branches.
- Shared controls can regress multiple screens if state timing changes.
- `no-giant-component` fixes can become a refactor branch by themselves.
- React Doctor CLI rules may change between scans, so the before/after comparison must record CLI output, not assumptions.

## Open Decisions

No user decision is currently blocking implementation.

Chosen scope:

1. Finish all React Doctor errors and low-risk warnings already touched in this branch.
2. Defer receipt scanner data-flow/notification behavior to a separate feature or bugfix branch.
3. Defer `no-giant-component` refactors to separate branches.
4. Defer deeper chart primitive dynamic imports unless a future bundle task requires it.
5. Require type-check, lint, build, targeted tests, full React Doctor scan, and documented manual-test notes before PR.
