# CodeRabbit PR #64 Fixes

Date: 2026-05-21
Branch: `feature/api-resilience-auth-hardening`
PR: `#64`

## Summary

Fixed CodeRabbit review comments for API resilience, OAuth hardening, response formatting, Sentry scrubbing, hooks, CI, and test coverage.

## Client Fixes

- `client/src/app/api-client.ts`
  - Normalized trailing slashes before checking/appending `/v1`.
  - Added an option to disable localhost fallback for browser OAuth redirects.
  - Changed the default API URL fallback to development only.
  - Added an explicit startup error when `VITE_API_URL` is missing outside development.

- `client/src/pages/auth/_component/signin-form.tsx`
- `client/src/pages/auth/_component/signup-form.tsx`
  - Prevented production OAuth redirects from falling back to localhost when `VITE_API_URL` is missing.
  - Show a user-facing error instead of redirecting with an invalid API base URL.

- `client/src/features/auth/authAPI.ts`
  - Made refresh response parsing accept both direct credentials and `{ data }` envelopes.

- `client/src/features/transaction/transactionType.ts`
- `client/src/features/transaction/components/reciept-scanner.tsx`
  - Modeled scan receipt response as either `{ jobId }` or `{ receipt }`.
  - Prioritized immediate `receipt` responses before background `jobId` handling.
  - Added fallback handling for unexpected scan responses.

- `client/src/features/transaction/components/transaction-table/index.tsx`
  - Recomputed child transaction `totalPages` after normalizing refreshed pagination to page size 10.

- `client/src/hooks/use-app-sockets.ts`
  - Stopped mutating every cached `getAllTransactions` query from socket events.
  - Switched transaction socket updates to invalidate `transactions` and `analytics` tags so filtered lists refetch correctly.

- `client/package.json`
  - Added `type-check` script for fast pre-push validation.

- `client/eslint.config.js`
  - Made Prettier options explicit in the client ESLint config so lint uses the repository style consistently when run from `client/`.

## Backend Fixes

- `backend/src/config/sentry.config.ts`
  - Redacted sensitive request headers instead of deleting only a small fixed set.
  - Added broader case-insensitive matching for auth/token/key style headers.

- `backend/src/utils/responseFormatter.util.ts`
  - Changed pagination links from request-host absolute URLs to safe relative URLs.
  - Preserved mounted route prefixes by building pagination links from `originalUrl` without query parameters.

- `backend/.env.example`
  - Added examples/comments for optional `SENTRY_DSN`.
  - Added example exchange-rate API endpoint comments.

- `backend/README.md`
  - Documented pre-push hook behavior and `SKIP_PRE_PUSH=1`.

## Test Fixes

- `backend/src/__tests__/integration/api-improvements-final.test.ts`
  - Replaced fixed future rate-limit reset timestamp with dynamic future time.

- `backend/src/__tests__/unit/api-versioning.test.ts`
- `backend/src/__tests__/unit/route-migration.test.ts`
  - Mounted real v1 route stack in tests.
  - Added auth enforcement checks.
  - Updated mocked controller responses to use `{ data }` envelope.
  - Mocked unrelated v1 routes so unit tests do not initialize BullMQ/Redis.

- `backend/src/__tests__/unit/bullmq-backoff.test.ts`
  - Extracted retention ages into `DAY_SECONDS` and `WEEK_SECONDS`.

- `backend/src/__tests__/unit/health.controller.test.ts`
  - Added partial/multiple dependency failure aggregation coverage.

- `backend/src/__tests__/unit/healthCheck.util.test.ts`
  - Replaced unsafe `as never` mongoose connection mocking with a typed helper.

- `backend/src/__tests__/unit/rateLimitHeaders.middleware.test.ts`
  - Wrapped fake timer assertions in `try/finally` to always restore real timers.

- `backend/src/__tests__/unit/responseFormatter.util.test.ts`
- `backend/src/__tests__/unit/transaction.controller.test.ts`
  - Updated pagination link expectations to relative URLs.

- `backend/src/__tests__/unit/sentry.config.test.ts`
  - Restored `NODE_ENV` after each test.
  - Updated expectations for redacted sensitive headers.

## CI And Tooling Fixes

- `.github/workflows/ci.yml`
  - Pinned GitHub Actions used by CI to commit SHAs.
  - Disabled persisted checkout credentials with `persist-credentials: false`.
  - Kept backend `npm ci --legacy-peer-deps` because the current lockfile still fails `npm ci` without it.
  - Added scheduled backend performance smoke test job with `RUN_PERF_TESTS=true`.

- `.husky/pre-push`
  - Replaced full client build with faster client type-check.
  - Added dependency checks for `client/node_modules` and `backend/node_modules`.
  - Kept backend type-check and unit tests.
  - Documented that integration tests run in CI for faster local feedback.

- `scripts/review.sh`
  - Added explicit `cr` CLI preflight check with a clear error message.

- `.gitattributes`
  - Added `.husky/* text eol=lf`.
  - Removed trailing whitespace in existing `.gitattributes` entries.

## Verification

Ran successfully:

```sh
npm.cmd run lint
```

In both `backend/` and `client/`.

```sh
npm.cmd run type-check
```

In both `backend/` and `client/`.

```sh
npm.cmd run test:unit -- api-versioning route-migration bullmq-backoff health.controller healthCheck.util rateLimitHeaders.middleware responseFormatter.util sentry.config transaction.controller
```

Result: 10 suites passed, 122 tests passed, performance tests skipped by design.

```sh
npm.cmd run test:unit
```

Result: 19 unit suites passed, 172 tests passed, 3 performance tests skipped by design.

```sh
npm.cmd run test:integration -- api-improvements-final
```

Result: 4 integration suites passed, 19 tests passed.

```sh
npm.cmd run test:integration
```

Result: 4 integration suites passed, 19 tests passed.

```sh
npm.cmd run build
```

Result: passed in `backend/`. In `client/`, `tsc -b` passed but Vite build was blocked by the local Windows sandbox with `Cannot read directory "../../..": Access is denied` while loading `client/vite.config.ts`.

```sh
git diff --check
```

Result: passed.

## Notes

- `coderabbit` CLI was not available locally, so the review was fetched from GitHub PR #64 comments.
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund` in `backend/` timed out after 120 seconds in this environment, so it was not counted as a successful verification step.
- GitHub Actions failed after removing backend `--legacy-peer-deps` because `backend/package-lock.json` is still missing npm's auto-installed peer dependency entries. The workflow keeps the flag until the backend lockfile can be regenerated in an environment with registry access.
- Latest CodeRabbit review on 2026-05-21 reported 3 actionable comments; all three were addressed in the workflow, client API base URL, and backend pagination formatter.
