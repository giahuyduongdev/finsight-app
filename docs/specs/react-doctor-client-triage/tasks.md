# React Doctor Client Triage Tasks

## Overview

Batch hiện tại xử lý React Doctor cho `client` theo hướng an toàn trước: xóa error runtime, cảnh báo security rõ ràng, cleanup unused file/export/dependency, rồi xử lý thêm follow-up cơ học. Full scan đã đi từ `2 errors / 76 warnings / score 49 Critical` xuống `0 errors / 28 warnings / score 69 Needs work`.

## Completed In Current Branch

- [x] Fetch `origin/develop` mới nhất.
- [x] Đặt `react-doctor-client-scan` lên base `origin/develop`.
- [x] Apply lại patch React Doctor lên base mới.
- [x] Fix `effect-needs-cleanup` trong OAuth callback.
- [x] Fix `effect-needs-cleanup` trong `reciept-scanner.tsx`.
- [x] Fix `effect-needs-cleanup` trong `schedule-report-form.tsx`.
- [x] Fix explicit button type, accessible labels, static hoists, Set lookups.
- [x] Hoist reusable `Intl` formatters trong currency/percentage helpers.
- [x] Fix safe `prefer-use-effect-event` case in `AppAlert`, sau đó xóa file khi React Doctor xác nhận unused.
- [x] Memoize safe shared UI context provider values.
- [x] Review và xử lý security warnings trong store/logout flow.
- [x] Confirm và xóa 16 unused files.
- [x] Confirm và xóa unused exports an toàn.
- [x] Remove unused dependencies khỏi `client/package.json` và importer lockfile.
- [x] Run full client React Doctor scan final.
- [x] Run `pnpm.cmd --dir client run type-check`.
- [x] Run `pnpm.cmd --dir client run lint`.
- [x] Run `pnpm.cmd --dir client run build`.
- [x] Follow-up branch `chore/react-doctor-client-followup` created from `develop`.
- [x] Version localStorage keys in auth refresh/logout coordination.
- [x] Fix mechanical accessibility/render warnings in `single-select`.
- [x] Split `buttonVariants` and `badgeVariants` into companion files.
- [x] Move dashboard pie chart legend out of component scope.
- [x] Replace safe index keys with stable keys.
- [x] Convert handler-only state in forgot password/account forms to refs.

## Final Validation

- [x] `pnpm.cmd --dir client run type-check` - pass
- [x] `pnpm.cmd --dir client run lint` - pass
- [x] `pnpm.cmd --dir client run build` - pass
- [x] `npx.cmd -y react-doctor@latest --json --yes` - `0 errors`, `28 warnings`, `14 affected files`, score `69/100`

Build note:

- Vite build pass nhưng vẫn warning chunk lớn `assets/index-D9oDlAXl.js` khoảng 1,559.93 kB.
- Đây là follow-up performance/code-splitting, không phải build failure.

## Next Remediation Batches

### Batch 1 - State And Effect Bugs

- [ ] Review `prefer-use-effect-event` occurrences trong receipt scanner.
- [ ] Review `no-chain-state-updates` in date range select and single select.
- [ ] Review parent synchronization warnings before changing callback timing.
- [ ] Validate with type-check, lint, build, and full React Doctor scan.

### Batch 2 - Performance And Bundle

- [x] Evaluate Recharts `prefer-dynamic-import` findings.
- [x] Decide whether chart code-splitting should use `React.lazy` at page/component boundary.
- [x] Implement dashboard chart lazy loading in `fix/dashboard-chart-splitting`.
- [x] Consider `build.rollupOptions.output.manualChunks` only after measuring bundle impact.
- [x] Re-run build and check chunk warning movement.
- [x] Add dedicated vendor chunking in `fix/client-vendor-chunk-strategy`.
- [x] Bring main and vendor JS chunks below 500 kB without circular chunk warnings.
- [ ] Defer deeper chart primitive splitting.

### Batch 3 - Maintainability Refactors

- [ ] Plan separate refactors for the 8 `no-giant-component` files.
- [ ] Review `no-many-boolean-props` in `DataTable`.
- [ ] Avoid mixing giant-component refactors with small cleanup PRs.

## Deferred By Design

- `no-giant-component`: requires component boundary decisions and larger review.
- `prefer-dynamic-import`: may change loading states and bundle split behavior.
- Receipt scanner effect event changes: can affect async callback timing.
- `single-select` accessibility/state cleanup: should be manually tested because it is a shared control.

## Dependencies

- Current branch should stay based on latest `origin/develop`.
- React Doctor CLI remains available through `npx.cmd react-doctor@latest`.
- Frontend validation uses existing `client/package.json` scripts.

## Review Notes

- Current branch should not be committed until the user reviews both code diff and this spec.
- The next PR can be the current mechanical cleanup branch, then follow-up PRs can target bundle and shared-control refactors separately.
