# CodeRabbit PR #68 - Fix Summary

Date: 2026-05-28
PR: `#68`
Branch: `feature/circuit-breaker-external-services`

## Đã Fix

### Backend

- `backend/src/workers/receipt.worker.ts`
  - Sửa logic xác định retry cuối bằng `(job.attemptsMade ?? 0) + 1`.
  - Redis cache write cho receipt scan là best-effort, lỗi cache chỉ log và không làm fail job.
  - Giữ `imageHash` trong job data để retry/reprocess dùng đúng cache key và Cloudinary public id.

- `backend/src/controllers/transaction.controller.ts`
  - Cache receipt scan không còn làm request scan thất bại nếu Redis lỗi.
  - Cache failure không còn emit `receipt:scan-failed` sau khi scan đã thành công.

- `backend/src/lib/exchange-rate-currency.ts`
  - Redis `get`/`set` cho exchange rate cache chuyển sang best-effort.
  - Validate provider rate là finite number trước khi cache hoặc return.
  - Redis cache write failure chỉ log warning.

- `backend/src/services/currency.service.ts`
  - Manual refresh lock dùng token riêng bằng `crypto.randomUUID()`.
  - Release lock bằng Redis Lua compare-and-delete để tránh xóa nhầm lock của process khác.

- `backend/src/utils/circuitBreaker.util.ts`
  - Failure threshold chỉ nhận positive integer.
  - Timeout config chỉ nhận positive number hợp lệ.

- `backend/src/utils/logging/serialize-error.util.ts`
  - Serializer không throw khi gặp getter lỗi, proxy, circular object, hoặc object khó đọc.
  - Deep redact sensitive fields an toàn hơn.

- `backend/src/utils/receipt/ai.util.ts`
  - Validate và normalize receipt date sang ISO string.
  - Giới hạn text từ Gemini cho `description`, `category`, `paymentMethod`.

- `backend/src/utils/receipt/scan-cache.util.ts`
  - Validate JSON cache shape trước khi return.
  - Invalid JSON hoặc thiếu field bắt buộc sẽ return `null`.

- `backend/src/routes/v1/analytics.routes.ts`
  - Thêm JWT auth cho:
    - `/analytics/summary`
    - `/analytics/chart`
    - `/analytics/expense-breakdown`
    - `/analytics/rates`

- `backend/src/controllers/analytics.controller.ts`
  - Thêm `refreshExchangeRatesController`.

- `backend/src/controllers/health.controller.ts`
  - Health check trả thêm `circuitBreakers`.

- `backend/src/config/env.config.ts`
  - Thêm `TOKEN_HASH_SECRET`, `ENCRYPTION_SECRET`, `RECEIPT_SCAN_CACHE_TTL_SECONDS`.

- `backend/src/config/redis.config.ts`
  - Thêm Redis keys/TTL cho currency refresh metadata và manual refresh lock.

- `backend/src/utils/receipt/upload.util.ts`
  - Thêm Cloudinary receipt upload util có circuit breaker.
  - Hỗ trợ lookup existing asset theo deterministic public id.

- `backend/src/utils/logging/redact.util.ts`
  - Thêm util redact sensitive fields dùng cho logging.

### Frontend

- `client/src/features/transaction/components/reciept-scanner.tsx`
  - Thêm accessible label/description cho file input.
  - Thêm accessible preview role/label.
  - Thêm live region cho scan progress.

- `client/src/pages/auth/oauth-callback.tsx`
  - Thêm accessible loading status và screen-reader text.

- `client/src/pages/settings/index.tsx`
  - Thêm `aria-label` cho settings nav.

### Tests

- `backend/src/__tests__/unit/analytics.routes.test.ts`
  - Thêm auth coverage cho analytics read routes.

- `backend/src/__tests__/unit/receipt-upload.util.test.ts`
  - Test real `cloudinaryCircuitBreaker`.
  - Cover open circuit, short-circuit, half-open success, half-open failure.

- `backend/src/__tests__/unit/serialize-error.util.test.ts`
  - Test deep redaction và throwing getter.

- `backend/src/__tests__/unit/exchange-rate-currency.test.ts`
  - Test invalid provider rate và Redis cache write failure.

- `backend/src/__tests__/unit/receipt-ai.util.test.ts`
  - Cập nhật expected date theo ISO normalization.

### Docs

- `docs/circuit-breaker/circuit-breaker-improvements.md`
  - Sửa path docs circuit breaker bị sai.

- `docs/receipt-scan-cache/receipt-scan-redis-optimization.md`
  - Sửa markdown heading spacing.

## Verification

Đã chạy:

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

## Lưu Ý

Workspace local hiện đang ở branch `develop`. Nếu muốn cập nhật PR #68, cần đưa các thay đổi này sang branch `feature/circuit-breaker-external-services` rồi commit/push lên PR đó.
