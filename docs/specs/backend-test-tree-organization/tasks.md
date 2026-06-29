# Backend Test Tree Organization Tasks

## 1. Preparation

- [x] Create a new branch for the refactor, for example `refactor/backend-test-tree-organization`.
- [x] Confirm the worktree is clean before moving files.
- [x] Record the current test counts from `npm.cmd run test:unit` if practical.

## 2. Create Folder Structure

- [x] Create `unit/auth`.
- [x] Create `unit/users`.
- [x] Create `unit/transactions`.
- [x] Create `unit/reports`.
- [x] Create `unit/receipts`.
- [x] Create `unit/middlewares`.
- [x] Create `unit/repositories`.
- [x] Create `unit/observability`.
- [x] Create `unit/utils`.
- [x] Create `unit/config`.
- [x] Create `unit/routing`.
- [x] Create `unit/analytics`.
- [x] Create `unit/workers`.
- [x] Create integration subfolders as needed.

## 3. Move Unit Tests

- [x] Move auth-related unit tests into `unit/auth`.
- [x] Move user-related unit tests into `unit/users`.
- [x] Move transaction-related unit tests into `unit/transactions`.
- [x] Move report-related unit tests into `unit/reports`.
- [x] Move receipt-related unit tests into `unit/receipts`.
- [x] Move middleware tests into `unit/middlewares`.
- [x] Move repository tests into `unit/repositories`.
- [x] Move observability and metrics tests into `unit/observability`.
- [x] Move generic utility tests into `unit/utils`.
- [x] Move config tests into `unit/config`.
- [x] Move routing and API versioning tests into `unit/routing`.
- [x] Move analytics tests into `unit/analytics`.
- [x] Move worker-specific tests into `unit/workers`.

## 4. Move Integration Tests

- [x] Move auth integration tests into `integration/auth`.
- [x] Move BullMQ integration tests into `integration/bullmq`.
- [x] Move receipt integration tests into `integration/receipts`.
- [x] Move routing integration tests into `integration/routing`.
- [x] Move broad API integration tests into `integration/api`.

## 5. Fix Imports

- [x] Update relative imports after each move batch.
- [x] Verify mocks still import correctly.
- [x] Verify setup helpers still import correctly.

## 6. Documentation

- [x] Update `backend/src/__tests__/README.md` with the new tree.
- [x] Add placement rules for new tests.
- [x] Include examples for running a domain folder test.

## 7. Verification

- [x] Run targeted tests for moved batches.
- [x] Run `npm.cmd run test:unit`.
- [x] Run `npm.cmd run test:integration`.
- [x] Run `npm.cmd run type-check`.
- [x] Run `npm.cmd run lint`.
- [x] Run `git diff --check`.

## 8. Completion

- [x] Confirm no tests remain directly under `unit/` unless intentionally documented.
- [x] Confirm CI scripts do not need changes.
- [x] Summarize moved folders and verification results.
