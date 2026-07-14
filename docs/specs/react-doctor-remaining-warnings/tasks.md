# React Doctor Remaining Warnings Tasks

## Setup

- [x] Create branch `refactor/client-react-doctor-remaining-warnings`.
- [x] Run full React Doctor baseline scan.
- [x] Record baseline counts and warning groups.

## Implementation

- [x] Fix receipt scanner `no-pass-data-to-parent`.
- [x] Fix Recharts `prefer-dynamic-import`.
- [x] Fix single-select `only-export-components`.
- [x] Split `SingleSelector`.
- [x] Split `ConfirmationStep`.
- [x] Split `EditForm`.
- [x] Split `ReceiptScanner`.
- [x] Split `TransactionForm`.
- [x] Split `TransactionTable`.
- [x] Split `ForgotPasswordForm`.
- [x] Split `SignUpForm`.

## Validation

- [x] `pnpm.cmd --dir client run type-check` - pass.
- [x] `pnpm.cmd --dir client run lint` - pass.
- [x] `pnpm.cmd --dir client run test` - pass, `7` files and `24` tests.
- [x] `pnpm.cmd --dir client run build` - pass, no chunk warning over `500 kB`.
- [x] Full React Doctor final scan - `0 errors`, `0 warnings`, score `100/100`.
- [x] Recheck dashboard chart regression after replacing `React.lazy` primitive wrappers with dynamic module loading.
- [x] Update specs with final counts.
- [x] Remove temporary scan artifacts.

## Manual Test Checklist

- [ ] Receipt scanner upload/success/background close behavior.
- [ ] Add transaction manual and AI-prefilled save.
- [ ] Transaction table search/filter/date range/pagination/expand/bulk delete.
- [ ] Dashboard chart loading and date range updates.
- [ ] Import transaction modal upload/mapping/confirmation/edit.
- [ ] Single select open/search/select/create/clear.
- [ ] Forgot password flow.
- [ ] Sign up flow.
