# CodeRabbit PR #65 Review And Fix Plan

Date: 2026-05-28
Branch: `feat/circuit-breaker-external-services`
PR: `#65`
PR URL: https://github.com/giahuyduongdev/finsight-app/pull/65
CodeRabbit review: https://github.com/giahuyduongdev/finsight-app/pull/65#pullrequestreview-4378224235
Reviewed commit: `bf99fcc5a35bd9b0fb5410d631cdd668ca56ce29`

## Tóm tắt

CodeRabbit báo 16 actionable comments cho PR thêm circuit breaker, cache receipt scan, và các thay đổi resilience quanh external services.

## Trạng thái sau batch fix

Đã fix trong batch này:

- Bắt buộc `TOKEN_HASH_SECRET`, không fallback sang `ENCRYPTION_SECRET`.
- Refresh token lookup/revoke hỗ trợ digest mới và plaintext legacy, đồng thời migrate plaintext token sang digest khi dùng hợp lệ.
- Bảo vệ `POST /analytics/rates/refresh` bằng JWT middleware.
- Xóa các file `.bak`/`.bak2` tracked và thêm ignore rule.
- Sửa link docs crypto.
- Harden manual exchange rate refresh để Redis/network lỗi fallback về `getLatestRates()`.
- Validate cached/stale exchange rate payload bằng `Number.isFinite`, tránh trả `NaN`.
- Preserve `imageHash` khi worker compact job data.
- Normalize thrown value trong receipt scan background catch.
- Map Gemini invalid JSON thành `NonReceiptImageError`.
- Validate receipt scan cache TTL là số nguyên dương.
- Không hard-code TTL trong transaction controller unit test.
- Primitive error fallback đi qua redaction helper.
- Frontend `refreshExchangeRates` invalidate `analytics`.

Chưa fix trong batch này:

- Chuyển receipt scan background task sang BullMQ durable job. Đây vẫn là design decision riêng vì cần thiết kế lại payload/reference ảnh để không đưa base64 lớn vào Redis.

Các nhóm vấn đề chính:

- Bảo mật và auth: CodeRabbit đã báo secret hash token fallback sang encryption secret, refresh token migration chưa đọc được token plaintext cũ, endpoint refresh exchange rate chưa được bảo vệ.
- Độ bền hệ thống: manual refresh exchange rate có thể fail cứng khi Redis/network lỗi, cached exchange rates chưa validate numeric payload, worker receipt scan có thể mất `imageHash` khi update job data.
- Receipt scan hardening: catch block đang giả định thrown value là `Error`, Gemini JSON parse lỗi chưa được map thành non-receipt error, TTL cache cho phép số thập phân, test đang hard-code TTL.
- Repo hygiene: các file `.bak` vẫn nằm trong repo và có nội dung dễ mâu thuẫn với docs chính.
- Frontend cache: manual refresh exchange rate nên invalidate `analytics`.

## Priority 0 - Sửa trước

### 1. Tách `TOKEN_HASH_SECRET` khỏi `ENCRYPTION_SECRET`

File: `backend/src/config/env.config.ts`

Hiện tại `TOKEN_HASH_SECRET` fallback sang `ENCRYPTION_SECRET`. CodeRabbit xem đây là risk vì hash token và encryption dùng chung secret nếu env thiếu.

Plan:

- Bắt buộc đọc `TOKEN_HASH_SECRET` bằng `getEnv('TOKEN_HASH_SECRET')`.
- Giữ `.env.example` đã có biến này.
- Verify type-check và unit auth/refresh token nếu có.

### 2. Migration-safe refresh token lookup

File: `backend/src/repositories/refresh-token.repository.ts`

Nếu token cũ đang lưu plaintext, lookup mới chỉ theo token đã hash sẽ làm user bị logout hoặc refresh fail sau deploy.

Plan:

- Khi tìm refresh token, thử hash trước.
- Nếu không thấy, thử plaintext token cũ.
- Nếu thấy plaintext record, migrate record đó sang hashed token.
- Áp dụng cùng logic cho path revoke/lookup liên quan nếu có.
- Thêm unit test cho token hashed mới và plaintext cũ.

### 3. Bảo vệ endpoint manual refresh exchange rate

File: `backend/src/routes/v1/analytics.routes.ts`

`POST /rates/refresh` có thể trigger external API call và cache mutation, nên không nên public.

Plan:

- Thêm auth middleware đang dùng cho analytics routes.
- Nếu app có role/admin middleware, cân nhắc giới hạn admin; nếu chưa có role rõ ràng thì tối thiểu phải require authenticated user.
- Thêm unit/integration route test cho unauthenticated request bị reject.

### 4. Dọn file backup khỏi repo

Files:

- `backend/src/services/auth.service.ts.bak`
- `docs/crypto-security/crypto-summary.md.bak`
- `docs/receipt-scan-cache/*.bak`
- `docs/receipt-scan-cache/*.bak2`

CodeRabbit comment trên các file `.bak` vì nội dung backup có thể stale/mâu thuẫn với docs chính.

Plan:

- Xóa file `.bak` và `.bak2` đang tracked nếu không còn dùng.
- Thêm `*.bak` và `*.bak2` vào `.gitignore`.
- Không dùng backup file committed trong repo cho docs tiếng Việt; nếu cần backup tạm thì giữ ngoài repo hoặc stash.

## Priority 1 - Reliability và correctness

### 5. Manual refresh exchange rate không được fail cứng khi Redis lỗi

File: `backend/src/services/currency.service.ts`

Plan:

- Bọc Redis lock/cache operations bằng `try/catch`.
- Đảm bảo lock release nằm trong `finally`.
- Nếu refresh thất bại, fallback về `getLatestRates()` thay vì làm endpoint fail không cần thiết.
- Log lỗi đã serialize/redact.

### 6. Validate cached exchange rate payload

File: `backend/src/lib/exchange-rate-currency.ts`

Plan:

- Sau khi parse cached payload, validate numeric fields bằng `Number.isFinite`.
- Nếu payload stale/corrupt, log warning và bỏ cache entry đó thay vì trả `NaN`.
- Thêm unit test cho cached payload corrupt.

### 7. Preserve `imageHash` khi worker compact job payload

File: `backend/src/workers/receipt.worker.ts`

Plan:

- Khi gọi `job.updateData`, giữ lại `imageHash`.
- Thêm test hoặc mock assertion để retry path vẫn có hash cho cache reuse.

### 8. Normalize thrown value trong transaction controller

File: `backend/src/controllers/transaction.controller.ts`

Plan:

- Trong catch block, không assume `error instanceof Error`.
- Tạo `normalizedError = error instanceof Error ? error : new Error(String(error))`.
- Vẫn dùng `serializeError` cho log.
- Thêm unit test cho thrown string/object nếu hiện chưa có.

### 9. Map Gemini JSON parse failure thành non-receipt error

File: `backend/src/utils/receipt/ai.util.ts`

Plan:

- Bọc `JSON.parse(cleanedText)` trong `try/catch`.
- Khi parse fail, throw `NonReceiptImageError` để client nhận lỗi đúng nghĩa "ảnh không phải hóa đơn hoặc AI không đọc được hóa đơn".
- Thêm unit test cho invalid JSON response.

### 10. Validate receipt scan cache TTL là số nguyên dương

File: `backend/src/utils/receipt/scan-cache.util.ts`

Plan:

- Coerce TTL bằng integer parsing.
- Reject hoặc fallback default nếu TTL không phải finite positive integer.
- Thêm unit test cho decimal, zero, negative, và invalid env.

### 11. Không hard-code TTL trong test

File: `backend/src/__tests__/unit/transaction.controller.test.ts`

Plan:

- Dùng `getReceiptScanCacheTtlSeconds()` hoặc shared constant thay cho `86400`.
- Giữ test độc lập với default TTL nếu config đổi.

### 12. Redact primitive thrown values

File: `backend/src/utils/logging/serialize-error.util.ts`

Plan:

- Với primitive fallback, chạy qua redaction helper trước khi trả về message.
- Thêm unit test cho string chứa token/secret.

### 13. Frontend invalidates analytics sau manual refresh

File: `client/src/features/analytics/analyticsAPI.ts`

Plan:

- Thêm `invalidatesTags: ['analytics']` vào `refreshExchangeRates`.
- Verify client lint/type-check.

### 14. Fix docs link sai

File: `docs/crypto-security/crypto-improvements.md`

Plan:

- Sửa reference từ `docs/crypto-summary.md` sang `docs/crypto-security/crypto-summary.md`.

## Design Decision - Không nên sửa vội

### 15. Receipt scan background task nên chuyển sang BullMQ?

File: `backend/src/controllers/transaction.controller.ts`

CodeRabbit đề xuất không dùng in-process fire-and-forget `processReceiptScanInBackground`, vì process crash/restart có thể làm mất scan job.

Context hiện tại:

- PR này đã tối ưu Redis job payload bằng cách không nhét base64 image lớn vào BullMQ.
- Nếu chuyển hẳn receipt scan sang BullMQ, cần thiết kế lại cách truyền image cho worker: temp object storage, Cloudinary upload trước, local temp file, hoặc một queue payload chỉ chứa reference.
- Đây là thay đổi lớn hơn các comment còn lại và có risk đụng lại flow receipt scan/cache.

Plan đề xuất:

- Không gộp vào batch fix nhanh nếu mục tiêu là merge PR #65 sớm.
- Tạo issue/PR riêng: durable receipt scan queue.
- Thiết kế payload không chứa base64 lớn trong Redis.
- Acceptance criteria: crash/restart không mất job, retry giữ `imageHash`, không tăng Redis memory đáng kể.

## Thứ tự fix đề xuất

1. Repo hygiene và docs
   - Xóa `.bak`/`.bak2` tracked.
   - Thêm ignore rule.
   - Sửa link docs crypto.

2. Security/auth
   - Bắt buộc `TOKEN_HASH_SECRET`.
   - Thêm dual-read migration cho refresh token.
   - Protect `POST /rates/refresh`.

3. Currency reliability
   - Harden manual refresh lock/cache flow.
   - Validate stale cached payload.
   - Frontend invalidate analytics cache.

4. Receipt scan hardening
   - Normalize thrown value.
   - JSON parse failure thành `NonReceiptImageError`.
   - TTL integer validation.
   - Preserve `imageHash` in worker update.
   - Update unit tests.

5. Durable receipt scan queue
   - Tách PR/issue riêng nếu muốn xử lý triệt để comment BullMQ.

## Verification đã chạy

Backend:

```sh
npm.cmd test -- --runInBand --runTestsByPath src/__tests__/unit/receipt-scan-cache.util.test.ts src/__tests__/unit/receipt-ai.util.test.ts src/__tests__/unit/refresh-token.repository.test.ts src/__tests__/unit/analytics.routes.test.ts src/__tests__/unit/exchange-rate-currency.test.ts src/__tests__/unit/serialize-error.util.test.ts src/__tests__/unit/transaction.controller.test.ts
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Kết quả:

- Targeted backend unit tests: 7 suites passed, 29 tests passed.
- Backend type-check: pass.
- Backend lint: pass.
- Full backend unit tests: 26 suites passed, 195 tests passed, 3 skipped.

Frontend:

```sh
npm.cmd run type-check
npm.cmd run lint
```

Kết quả:

- Client type-check: pass.
- Client lint: pass.

Repo:

```sh
git diff --check
```

Kết quả:

- Pass, chỉ có warning CRLF cho `.gitignore`.

## Verification commands cho thay đổi tiếp theo

Backend:

```sh
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Targeted backend tests nên chạy thêm sau khi fix:

```sh
npm.cmd run test:unit -- --runInBand src/__tests__/unit/receipt-scan-cache.util.test.ts src/__tests__/unit/receipt-upload.util.test.ts src/__tests__/unit/transaction.controller.test.ts
```

Frontend:

```sh
npm.cmd run type-check
npm.cmd run lint
```

Integration:

- Nên thêm/chạy route test cho `POST /api/v1/analytics/rates/refresh` vì đây là thay đổi auth behavior.
- Unit test là đủ cho TTL, JSON parse, serialize error, exchange rate cache validation, và refresh token repository migration.
