# CodeRabbit Review PR #68

Date: 2026-05-28
PR: `#68`
Title: `Feature/circuit breaker external services`
Base: `develop`
Head: `feature/circuit-breaker-external-services`
Review: https://github.com/giahuyduongdev/finsight-app/pull/68#pullrequestreview-4380358985

## Summary By CodeRabbit

- Added manual exchange rates refresh endpoint.
- Cached receipt scan results to improve performance and reduce duplicate processing.
- Added circuit breaker status snapshots to health check.
- Improved token security with dedicated token hashing.
- Improved error handling and logging.
- Improved responsive UI on rates, transactions, and settings pages.
- Updated git commit convention from `feat` to `feature`.
- Added environment configuration for token hashing and service resilience controls.

## Actionable Comments

CodeRabbit reported 19 actionable comments.

## Trạng Thái Fix

Đã fix các nhóm vấn đề chính từ review:

- `backend/src/workers/receipt.worker.ts`
  - Sửa logic xác định lần retry cuối bằng `(job.attemptsMade ?? 0) + 1`.
  - Bọc Redis receipt scan cache write bằng `try/catch`, log lỗi cache nhưng không làm fail job.
  - Giữ `imageHash` trong job data để retry/reprocess vẫn dùng đúng cache key và Cloudinary public id.

- `backend/src/controllers/transaction.controller.ts`
  - Cache receipt scan chuyển sang best-effort.
  - Cache failure không còn emit `receipt:scan-failed` sau khi scan đã thành công.

- `backend/src/lib/exchange-rate-currency.ts`
  - Redis `get`/`set` cho exchange rate cache chuyển sang best-effort.
  - Validate provider rate là finite number trước khi cache hoặc return.
  - Cache write failure chỉ log warning, không chặn provider result.

- `backend/src/services/currency.service.ts`
  - Manual refresh lock dùng token riêng bằng `crypto.randomUUID()`.
  - Release lock bằng Redis Lua compare-and-delete, tránh xóa nhầm lock của process khác.

- `backend/src/utils/circuitBreaker.util.ts`
  - Tách parse env number/int.
  - Failure threshold chỉ nhận positive integer.
  - Timeout config chỉ nhận positive number hợp lệ.

- `backend/src/utils/logging/serialize-error.util.ts`
  - Serializer không throw khi gặp getter lỗi/proxy/object khó đọc.
  - Deep clone an toàn trước khi redact sensitive fields.
  - Có fallback object tối thiểu nếu serialize fail.

- `backend/src/utils/receipt/ai.util.ts`
  - Validate và normalize receipt date bằng ISO string.
  - Giới hạn text từ Gemini: `description`, `category`, `paymentMethod`.

- `backend/src/utils/receipt/scan-cache.util.ts`
  - Validate shape JSON cache trước khi return.
  - Invalid JSON hoặc thiếu field bắt buộc sẽ return `null`.

- `backend/src/routes/v1/analytics.routes.ts`
  - Thêm JWT auth cho các analytics read routes:
    - `/analytics/summary`
    - `/analytics/chart`
    - `/analytics/expense-breakdown`
    - `/analytics/rates`

- `backend/src/controllers/analytics.controller.ts`
  - Bổ sung `refreshExchangeRatesController` cho route refresh rates.

- `backend/src/controllers/health.controller.ts`
  - Health check response trả thêm `circuitBreakers`.

- `backend/src/config/env.config.ts`
  - Thêm env config cho `TOKEN_HASH_SECRET`, `ENCRYPTION_SECRET`, và `RECEIPT_SCAN_CACHE_TTL_SECONDS`.

- `backend/src/config/redis.config.ts`
  - Thêm Redis keys/TTL cho currency refresh metadata và manual refresh lock.

- `backend/src/utils/receipt/upload.util.ts`
  - Thêm util upload receipt qua Cloudinary có circuit breaker.
  - Hỗ trợ lookup existing asset theo deterministic public id.

- `backend/src/utils/logging/redact.util.ts`
  - Thêm util redact sensitive fields dùng chung cho logging.

- Frontend accessibility
  - `client/src/features/transaction/components/reciept-scanner.tsx`: thêm label/description cho file input, role/label cho preview, live region cho progress.
  - `client/src/pages/auth/oauth-callback.tsx`: thêm accessible loading status và screen-reader text.
  - `client/src/pages/settings/index.tsx`: thêm `aria-label` cho settings nav.

- Tests
  - Thêm coverage analytics routes auth.
  - Thêm coverage receipt upload với real `cloudinaryCircuitBreaker`.
  - Thêm coverage serialize error deep redaction và throwing getter.
  - Thêm coverage exchange-rate invalid provider rate và Redis cache write failure.
  - Cập nhật receipt AI date expectation theo ISO normalization.

- Docs
  - Sửa path docs circuit breaker bị sai.
  - Sửa markdown heading spacing trong receipt scan cache docs.

## Verification Sau Khi Fix

Đã chạy trên workspace hiện tại:

```sh
cd backend
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand analytics.routes serialize-error receipt-ai receipt-scan-cache exchange-rate-currency receipt-upload circuitBreaker

cd ../client
npm.cmd run type-check
npm.cmd run lint
```

Kết quả:

- Backend type-check: pass.
- Backend lint: pass.
- Backend targeted unit tests: pass, 6 suites / 26 tests.
- Client type-check: pass.
- Client lint: pass.

Lưu ý: workspace local đang ở branch `develop`. Nếu muốn cập nhật PR #68, cần đưa các thay đổi này sang branch `feature/circuit-breaker-external-services` rồi commit/push lên PR đó.

## Backend Issues

### `backend/src/workers/receipt.worker.ts`

- Fix final-attempt failure emission.
- Current logic uses `job.attemptsMade >= maxAttempts`.
- In BullMQ v5, `attemptsMade` counts previous failed attempts and does not include the current attempt.
- Suggested fix: use `(job.attemptsMade ?? 0) + 1 >= maxAttempts`.

### `backend/src/controllers/transaction.controller.ts`

- `cacheReceiptScan` should not make a successful receipt scan fail.
- Move cache write into its own `try/catch` after `receipt:scan-completed`.
- Log Redis cache errors, but do not emit `receipt:scan-failed` for cache-only failures.

### `backend/src/lib/exchange-rate-currency.ts`

- Redis cache access should be best-effort.
- Wrap `redis.get` and `redis.set` in `try/catch`.
- Cache failures should not block provider result or stale fallback.
- Validate exchange rate values before caching.
- Only cache and return finite numeric rates.

### `backend/src/services/currency.service.ts`

- Manual refresh Redis lock currently risks deleting a lock owned by another process.
- Store a unique lock token when acquiring the lock.
- Release lock with atomic compare-and-delete, such as Lua `eval`.
- Only delete the lock if the stored value matches the owner token.

### `backend/src/utils/circuitBreaker.util.ts`

- Circuit breaker failure threshold should accept only positive integers.
- Decimal, zero, negative, or invalid values should fall back to default.
- Consider adding a `getIntEnv` helper or tightening validation in existing env parsing.

### `backend/src/utils/encryption.util.ts`

- `decrypt` currently uses only `Env.ENCRYPTION_SECRET`.
- If there are payloads encrypted with a previous secret, decrypt will fail after migration.
- Add fallback decryption with the legacy secret source if this migration path is still required.

### `backend/src/utils/logging/serialize-error.util.ts`

- Make `serializeError` fully non-throwing.
- Guard property reads and object enumeration with `try/catch`.
- Handle objects with throwing getters or proxies.
- Return a minimal safe object if serialization itself fails.

### `backend/src/utils/receipt/ai.util.ts`

- Truncate free-text Gemini fields before insertion.
- Suggested caps:
  - `description`: around 2000 chars.
  - `category`: around 100 chars.
  - `paymentMethod`: around 50 chars.
- Validate `data.date` before assigning it.
- Normalize valid dates or omit/null invalid dates.

### `backend/src/utils/receipt/scan-cache.util.ts`

- `parseCachedReceiptScan` should validate parsed JSON shape.
- Return `null` on parse errors.
- Ensure parsed value is an object.
- Ensure `data.receiptUrl` is a non-empty string.
- Validate other mandatory `CachedReceiptScan` fields before returning.

### `backend/src/workers/receipt.worker.ts`

- Redis cache writes in worker should not fail the whole scan job.
- Wrap `redis.set` cache writes in `try/catch`.
- Log context such as `userId`, `imageHash`, and cache key.
- Swallow Redis cache errors after logging.

### `backend/src/config/cloudinary.config.ts`

- Check possible dangling stream when circuit breaker timeout happens before Cloudinary upload finishes.
- Consider cleanup path that:
  - destroys `uploadStream`,
  - unpipes `file.stream`,
  - removes stream listeners,
  - prevents late callbacks from touching settled resources.

## Test Issues

### `backend/src/__tests__/unit/analytics.routes.test.ts`

- Current test protects only `/analytics/rates/refresh`.
- Add auth coverage for:
  - `/analytics/summary`
  - `/analytics/chart`
  - `/analytics/expense-breakdown`
  - `/analytics/rates`
- For each route, assert unauthenticated request returns `401`.
- Assert authenticated request returns `200` and expected mocked response.

### `backend/src/__tests__/unit/receipt-upload.util.test.ts`

- Tests currently mock `cloudinaryCircuitBreaker.execute`.
- Add coverage using the real `cloudinaryCircuitBreaker`.
- Verify:
  - repeated Cloudinary failures open the circuit,
  - open circuit returns `CIRCUIT_BREAKER_OPEN`,
  - Cloudinary is not called while circuit is open,
  - half-open probe closes on success and reopens on failure.

### `backend/src/__tests__/unit/serialize-error.util.test.ts`

- Add test for deeply nested sensitive fields.
- Example: nested `request_options.auth` and nested `token.inner`.
- Assert all sensitive values become `[REDACTED]`.

## Frontend Accessibility Issues

### `client/src/features/transaction/components/reciept-scanner.tsx`

- Add `aria-label` to file input, such as `Upload receipt image`.
- Add `aria-describedby` pointing to file restriction text.
- Add accessible label/role for receipt preview.
- Add ARIA live region for scan progress updates:
  - `role="status"`
  - `aria-live="polite"`
  - `aria-atomic="true"` where appropriate.

### `client/src/pages/auth/oauth-callback.tsx`

- Add accessible loading state for spinner.
- Suggested additions:
  - `role="status"`
  - `aria-live="polite"`
  - screen-reader-only loading text.

### `client/src/pages/settings/index.tsx`

- Add accessible label to settings nav.
- Example: `aria-label="Settings sections"`.

## Documentation Issues

### `docs/circuit-breaker/circuit-breaker-improvements.md`

- Fix broken path reference.
- Replace:

```text
docs/circuit-breaker-retry-summary.md
```

- With:

```text
docs/circuit-breaker/circuit-breaker-retry-summary.md
```

### `docs/receipt-scan-cache/receipt-scan-redis-optimization.md`

- Add a blank line before heading:

```md
## Cập nhật Cloudinary lookup 404
```

- This fixes markdownlint rule `MD022`.

## Suggested Fix Order

1. Fix backend correctness issues:
   - receipt worker final attempt,
   - Redis best-effort cache handling,
   - exchange rate validation,
   - manual refresh lock ownership.
2. Fix serialization and cache parsing hardening.
3. Add/adjust tests for analytics routes, receipt upload circuit breaker, and deep redaction.
4. Fix frontend accessibility comments.
5. Fix docs markdown/path comments.
6. Run verification:

```sh
cd backend
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand

cd ../client
npm.cmd run type-check
npm.cmd run lint
```

## Notes

- PR #66 was merged into `main` by mistake and then reverted by PR #67.
- PR #68 is the active PR into `develop`.
- CodeRabbit status later showed `Review skipped`, but the detailed review comments remain available on PR #68.
