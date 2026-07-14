# Receipt Scanner Effects Tasks

## Implementation

- [x] Create branch `fix/receipt-scanner-effects`.
- [x] Back up `reciept-scanner.tsx` before editing.
- [x] Introduce `useEffectEvent` in `reciept-scanner.tsx`.
- [x] Update socket effect dependencies to avoid callback-driven re-subscription.
- [x] Update polling effect dependencies to avoid callback-driven re-subscription.
- [x] Keep upload handler behavior unchanged.
- [x] Inline pending-job ref/state/sessionStorage updates to avoid React Doctor `no-impure-state-updater` false positive on the old helper.

## Validation

- [x] `pnpm.cmd --dir client run type-check` - pass.
- [x] `pnpm.cmd --dir client run lint` - pass, no lint warnings.
- [x] `pnpm.cmd --dir client run build` - pass.
- [x] `pnpm.cmd --dir client run test -- src/features/transaction/components/reciept-scanner.test.tsx` - pass; current script ran `7` files / `24` tests.
- [x] Full `npx.cmd -y react-doctor@latest --json --yes` recorded.
- [x] Final React Doctor: `14 errors`, `20 warnings`, `21 affected files`, score `51/100`, label `Critical`.

React Doctor receipt scanner result:

- Cleared targeted `prefer-use-effect-event` findings.
- Cleared targeted `no-prop-callback-in-effect` finding.
- Cleared receipt scanner `no-impure-state-updater` after removing the pending-job helper.
- Remaining receipt scanner findings: `no-giant-component` and `no-pass-data-to-parent`.

React Doctor note:

- The CLI version used in this branch reports new global `no-impure-state-updater` errors outside the branch scope. These remain in files such as import transaction modal, single select, data table, theme provider, debounce search, rates, and settings dialogs.

## Manual Test

- [ ] Valid receipt upload manually tested.
- [ ] Background processing completion manually tested.
- [x] Failure/timeout behavior manually tested, or explicitly marked not run with reason.

Manual test note:

- Browser upload receipt flow was not manually executed in this session because it requires a running app with backend/auth/provider state. Component recovery coverage was validated by the existing receipt scanner tests.
