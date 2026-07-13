# React Doctor Client Triage Requirements

## Introduction

Tài liệu này lưu lại kết quả chạy React Doctor cho frontend trong `client` và định hướng xử lý các diagnostic còn lại. Đây là spec triage/remediation, không phải spec cho một feature mới.

Branch hiện tại:

- `react-doctor-client-scan`
- Base sau khi fetch: `origin/develop` tại `017f9fd`
- Phạm vi scan: `client`

## Scan Summary

Kết quả full scan trước khi xử lý batch này:

- Scope: full client scan
- Error: 2
- Warning: 76
- Affected files: 45
- Score: 49/100, `Critical`

Hai error ban đầu:

- `src/features/transaction/components/reciept-scanner.tsx:197` - `effect-needs-cleanup`
- `src/pages/reports/_component/schedule-report-form.tsx:84` - `effect-needs-cleanup`

Kết quả full scan sau batch hiện tại:

- Scope: full client scan
- Error: 0
- Warning: 28
- Affected files: 14
- Score: 69/100, `Needs work`

Follow-up branch:

- `chore/react-doctor-client-followup`
- Started from `develop` at merge commit `5dfbdd5`
- Reduced full scan from `0 errors / 47 warnings / score 63` to `0 errors / 28 warnings / score 69`

Build validation:

- `pnpm.cmd --dir client run type-check`: pass
- `pnpm.cmd --dir client run lint`: pass
- `pnpm.cmd --dir client run build`: pass
- Build vẫn còn warning chunk lớn: `assets/index-D9oDlAXl.js` khoảng 1,559.93 kB, gzip khoảng 459.24 kB.

Ghi chú: chunk warning không làm build fail. Hướng xử lý phù hợp là batch code-splitting riêng cho các entry Recharts/dashboard và xem xét `manualChunks`, không nên trộn vào batch cleanup cơ học.

## Goals

- Xóa toàn bộ error React Doctor trong `client`.
- Xử lý các diagnostic cơ học, ít rủi ro trước.
- Không thay đổi behavior lớn khi chưa có review riêng.
- Ghi lại các nhóm warning còn lại để xử lý theo thứ tự ưu tiên.
- Giữ validation frontend pass sau mỗi batch remediation.

## Non-Goals

- Không sửa backend.
- Không tách component lớn trong batch này.
- Không thêm CI React Doctor trong scope này.
- Không xử lý code-splitting lớn khi chưa có review loading behavior.

## Completed Remediation

Các nhóm đã xử lý trong branch hiện tại:

- `effect-needs-cleanup`: thêm cleanup cho OAuth callback, receipt scanner polling, và schedule report watcher.
- `button-has-type`: thêm explicit `type="button"` cho button không submit.
- `label-has-associated-control`: gắn label với input/select ở converter và import edit form.
- `prefer-module-scope-static-value`: đưa static arrays ra module scope.
- `prefer-module-scope-pure-function`: đưa pure helper ra module scope.
- `js-hoist-intl`: hoist reusable `Intl.DateTimeFormat` và `Intl.NumberFormat`.
- `js-set-map-lookups`: thay lookup lặp bằng `Set`.
- `no-redundant-roles`: bỏ role thừa trên `<nav>`.
- `control-has-associated-label`: thêm accessible label cho expand control.
- `jsx-no-constructed-context-values`: memoize provider values trong shared UI context.
- `public-env-secret-name`: bỏ cấu hình encrypt transform đã comment và secret-like env reference không còn dùng.
- `insecure-session-cookie`: bỏ thao tác clear cookie auth phía frontend, để backend logout API xử lý HttpOnly cookie.
- `unused-file`: xóa 16 file React Doctor xác nhận không còn reference.
- `unused-export`: bỏ các export không được import, giữ type/runtime cần thiết.
- `unused-dependency`: remove các dependency không còn import khỏi `client/package.json` và importer lockfile.
- Follow-up: version localStorage keys for auth refresh/logout coordination.
- Follow-up: fix mechanical accessibility/render warnings in `single-select`.
- Follow-up: replace small map/filter iteration patterns with `flatMap`.
- Follow-up: move dashboard legend out of component scope and replace index keys where stable names exist.
- Follow-up: split `buttonVariants` and `badgeVariants` out of component files for Fast Refresh.
- Follow-up: convert handler-only state in forgot password/account forms to refs.

## Remaining Diagnostic Groups

Các nhóm diagnostic còn lại sau full client scan final:

- Bugs/state effects:
  - `prefer-use-effect-event`: 8
  - `no-chain-state-updates`: 3
  - `no-pass-data-to-parent`: 1
  - `no-mirror-prop-effect`: 1
  - `no-prop-callback-in-effect`: 1
- Performance:
  - `prefer-dynamic-import`: 3
  - `rerender-memo-before-early-return`: 1
  - `rendering-usetransition-loading`: 1
- Maintainability:
  - `no-giant-component`: 8
  - `no-many-boolean-props`: 1

## Remaining Diagnostic Details

### State And Effect

- `prefer-use-effect-event` - `src/features/transaction/components/reciept-scanner.tsx:195`
- `prefer-use-effect-event` - `src/features/transaction/components/reciept-scanner.tsx:251`
- `no-chain-state-updates` - `src/components/date-range-select/index.tsx:163`
- `no-chain-state-updates` - `src/components/ui/single-select.tsx:194`
- `no-chain-state-updates` - `src/components/ui/single-select.tsx:223`
- `no-pass-data-to-parent` - `src/components/date-range-select/index.tsx:184`
- `no-mirror-prop-effect` - `src/components/ui/single-select.tsx:213`
- `no-prop-callback-in-effect` - `src/features/transaction/components/reciept-scanner.tsx:132`

### Performance And Bundle

- `prefer-dynamic-import` - `src/components/ui/chart.tsx:2`
- `prefer-dynamic-import` - `src/pages/dashboard/dashboard-data-chart.tsx:3`
- `prefer-dynamic-import` - `src/pages/dashboard/expense-pie-chart.tsx:1`
- `rerender-memo-before-early-return` - `src/components/ui/chart.tsx:160`
- `rendering-usetransition-loading` - `src/hooks/use-progress-loader.ts:23`
- Build chunk warning - `assets/index-D9oDlAXl.js` khoảng 1,559.93 kB.

### Maintainability

- `no-giant-component`:
  - `src/components/ui/single-select.tsx:114`
  - `src/features/transaction/components/import-transaction-modal/confirmation-step.tsx:136`
  - `src/features/transaction/components/import-transaction-modal/edit-form.tsx:37`
  - `src/features/transaction/components/reciept-scanner.tsx:24`
  - `src/features/transaction/components/transaction-form.tsx:122`
  - `src/features/transaction/components/transaction-table/index.tsx:56`
  - `src/pages/auth/_component/forgot-password-form.tsx:204`
  - `src/pages/auth/_component/signup-form.tsx:181`
- `no-many-boolean-props` - `src/components/data-table/index.tsx:96`

## User Stories

### Story 1 - Developer Triage

As a developer, I want React Doctor findings grouped by risk and effort so that I can choose the next remediation batch without re-reading the full scan output.

### Story 2 - Reviewer Safety

As a reviewer, I want mechanical fixes separated from behavior-changing refactors so that I can review the current branch without hidden scope creep.

### Story 3 - Frontend Quality Tracking

As a frontend maintainer, I want score movement and remaining categories recorded so that future cleanup work can measure progress.

## Acceptance Criteria

- [x] Spec records the React Doctor before/after counts and score.
- [x] Spec lists completed remediation categories.
- [x] Spec lists remaining diagnostic groups by priority.
- [x] Frontend validation passes: type-check, lint, build.
- [x] Behavior-changing fixes are split into separate reviewable follow-up batches.

## Constraints

- Work stays inside `client` unless a later task explicitly justifies broader scope.
- Vietnamese-content files must be backed up before editing, per `AGENTS.md`.
- Avoid large refactors in the same branch as mechanical diagnostic fixes.
- Do not commit, push, or open PR without explicit user instruction.
- Keep changes surgical and aligned with existing project patterns.

## Success Criteria

- React Doctor full client scan has 0 errors.
- Full client scan warning debt is tracked explicitly for follow-up batches.
- Score improves from `49/Critical` to `69/Needs work` without breaking validation.
- Remaining high-risk warnings have documented deferral reasons or follow-up tasks.
