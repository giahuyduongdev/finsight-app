# Backend Test Tree Organization Design

## Summary

Reorganize backend tests by domain while preserving the existing Jest discovery model. This is a mechanical test-tree refactor: move files, update relative imports, update documentation, then verify the same commands still work.

## Current Structure

The current structure is flat under `unit/`:

```txt
backend/src/__tests__/
  integration/
  mocks/
  setup/
  unit/
    auth.controller.test.ts
    auth.service.test.ts
    transaction.service.test.ts
    report.service.test.ts
    redact.util.test.ts
    ...
    middlewares/
```

This makes `unit/` hard to scan because unrelated domains sit beside each other.

## Proposed Structure

Use domain folders under `unit/` and `integration/`:

```txt
backend/src/__tests__/
  unit/
    analytics/
    auth/
    config/
    middlewares/
    observability/
    receipts/
    reports/
    repositories/
    routing/
    transactions/
    users/
    utils/
    workers/
  integration/
    api/
    auth/
    bullmq/
    receipts/
    routing/
  mocks/
  setup/
```

Folder names should be plural for domains (`users`, `reports`, `transactions`) and singular for technical layers (`middleware`, `config`, `routing`).

## Placement Rules

- Auth/session/token tests go in `unit/auth` or `integration/auth`.
- User profile, user DTO, and user model tests go in `unit/users`.
- Transaction domain tests go in `unit/transactions`.
- Report domain tests go in `unit/reports`.
- Receipt scan/intake/upload tests go in `unit/receipts` or `integration/receipts`.
- Express middleware tests go in `unit/middlewares`.
- Generic helpers go in `unit/utils`.
- Metrics, Sentry, and monitoring tests go in `unit/observability`.
- Queue and worker tests go in `unit/workers` unless the test is clearly tied to one domain.
- API migration/versioning tests go in `unit/routing` or `integration/routing`.

When a test could fit in two folders, prefer the folder matching the production module under test.

## Implementation Approach

Use `git mv` or equivalent file moves so Git tracks renames cleanly.

Move files in small batches:

1. Move unit tests by folder.
2. Update relative imports for each batch.
3. Run targeted Jest paths for the moved batch.
4. Move integration tests by folder.
5. Update README.
6. Run full verification.

Because Jest uses `**/__tests__/**/*.test.ts`, no Jest config change should be required.

## Import Strategy

Relative imports will need one more `../` after moving from:

```txt
unit/example.test.ts
```

to:

```txt
unit/<folder>/example.test.ts
```

For example:

```ts
../../services/user.service
```

becomes:

```ts
../../../services/user.service
```

Do not introduce path aliases in this refactor. That would be a separate decision.

## Risks

- Moving many files can create a noisy diff.
- Relative import mistakes may compile but fail at runtime if mocks resolve incorrectly.
- Some Jest CLI invocations in developer habits may use old paths.

Mitigation:

- Move in batches.
- Run type-check and targeted tests after each batch.
- Update README with examples of the new paths.

## Verification

Run:

```txt
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run type-check
npm.cmd run lint
```

Also run:

```txt
git diff --check
```

No production behavior should change.
