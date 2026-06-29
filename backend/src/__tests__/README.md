# Backend Tests

## Structure

```txt
__tests__/
  integration/
    api/
    auth/
    bullmq/
    receipts/
    routing/
  mocks/
  setup/
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
```

## Placement Rules

- Put auth, token, session, and login/register tests in `unit/auth` or `integration/auth`.
- Put user profile, user DTO, and user model tests in `unit/users`.
- Put transaction domain tests in `unit/transactions`.
- Put report domain tests in `unit/reports`.
- Put receipt scan/intake/upload tests in `unit/receipts` or `integration/receipts`.
- Put Express middleware tests in `unit/middlewares`.
- Put repository adapter tests in `unit/repositories`.
- Put metrics, health, Sentry, and monitoring tests in `unit/observability`.
- Put generic helper tests in `unit/utils`.
- Put route mounting, API versioning, and migration route tests in `unit/routing` or `integration/routing`.
- Put queue and worker orchestration tests in `unit/workers` unless the test is clearly owned by one domain.

When a test could fit in more than one folder, choose the folder that matches the production module under test.

## Running Tests

Run all backend tests:

```bash
npm test
```

Run unit tests:

```bash
npm run test:unit
```

Run integration tests:

```bash
npm run test:integration
```

Run one domain folder:

```bash
npm test -- unit/auth
npm test -- integration/auth
```

Run selected files:

```bash
npm test -- --runTestsByPath src/__tests__/unit/users/user.service.test.ts
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`:

```bash
npm.cmd run test:unit
```
