# Các cải thiện circuit breaker/retry/fallback đã thực hiện

Tài liệu này ghi lại các thay đổi đã làm sau khi rà soát `docs/circuit-breaker-retry-summary.md`.

## Mục tiêu

- Áp dụng circuit breaker cho các dependency còn thiếu.
- Cho phép cấu hình threshold/timeout qua env.
- Tăng visibility trạng thái circuit breaker.
- Bổ sung fallback thực tế hơn cho exchange rate khi API ngoài lỗi.

## 1. Thêm circuit breaker cho Exchange Rate API

File liên quan:

- `backend/src/lib/exchange-rate-currency.ts`
- `backend/src/utils/circuitBreaker.util.ts`

Thay đổi:

- Thêm `exchangeRateCircuitBreaker`.
- Bọc `fetchExchangeRatesWithFallback()` bằng:

```ts
exchangeRateCircuitBreaker.execute(
  () => fetchExchangeRatesWithFallbackInternal(currency),
  'Exchange Rate API'
)
```

Kết quả:

- Nếu primary/fallback exchange rate API lỗi liên tục, circuit sẽ mở.
- Khi circuit mở, request mới fail nhanh thay vì tiếp tục gọi API ngoài.
- Nếu primary fail nhưng fallback thành công, operation vẫn được tính là thành công.

## 2. Thêm stale cache cho exchange rate

File liên quan:

- `backend/src/lib/exchange-rate-currency.ts`

Thay đổi:

- Vẫn giữ cache chính TTL `3600` giây.
- Thêm stale cache TTL `24` giờ.
- Khi API ngoài fail, nếu còn stale rate thì trả stale rate thay vì throw ngay.

Kết quả:

- Các flow tính toán tiền tệ bền hơn khi exchange rate provider tạm lỗi.
- User vẫn có thể nhận kết quả gần đúng dựa trên rate cũ.

## 2.1. Harden manual refresh và cached rate payload

File liên quan:

- `backend/src/services/currency.service.ts`
- `backend/src/lib/exchange-rate-currency.ts`
- `client/src/features/analytics/analyticsAPI.ts`

Thay đổi:

- `refreshRatesManually()` bọc Redis lock/cache flow bằng `try/catch/finally`.
- Nếu manual refresh lỗi do Redis/network/provider, endpoint fallback về `getLatestRates()` thay vì fail cứng.
- Manual refresh lock được release trong `finally`; nếu release lock lỗi thì log warning.
- Cached/stale exchange rate payload được parse bằng `Number()` và validate `Number.isFinite`.
- Nếu cache/stale cache corrupt, backend log warning và bỏ qua entry đó thay vì trả `NaN`.
- Frontend mutation `refreshExchangeRates` invalidate tag `analytics` để UI refetch dữ liệu liên quan sau khi refresh.

Kết quả:

- Manual refresh exchange rate ít làm gián đoạn UI hơn khi dependency tạm lỗi.
- Không trả rate `NaN` từ Redis cache corrupt.
- Frontend analytics cache đồng bộ lại sau manual refresh.

## 3. Thêm circuit breaker cho Cloudinary

File liên quan:

- `backend/src/config/cloudinary.config.ts`
- `backend/src/utils/circuitBreaker.util.ts`

Thay đổi:

- Bọc upload Cloudinary bằng `cloudinaryCircuitBreaker`.
- Bọc delete Cloudinary bằng `cloudinaryCircuitBreaker`.
- Tách upload stream thành promise helper để dễ bọc bằng breaker.

Kết quả:

- Nếu Cloudinary upload/delete lỗi liên tục, circuit sẽ mở.
- Khi circuit mở, request mới fail nhanh thay vì tiếp tục gọi Cloudinary.

## 4. Cho phép cấu hình circuit breaker bằng env

File liên quan:

- `backend/src/utils/circuitBreaker.util.ts`
- `backend/.env.example`
- `backend/samples/.env.sample`

Thay đổi:

- Thêm env chung:

```env
CIRCUIT_FAILURE_THRESHOLD=
CIRCUIT_RESET_TIMEOUT_MS=
```

- Thêm env riêng theo service:

```env
GEMINI_CIRCUIT_FAILURE_THRESHOLD=
GEMINI_CIRCUIT_RESET_TIMEOUT_MS=
RESEND_CIRCUIT_FAILURE_THRESHOLD=
RESEND_CIRCUIT_RESET_TIMEOUT_MS=
CLOUDINARY_CIRCUIT_FAILURE_THRESHOLD=
CLOUDINARY_CIRCUIT_RESET_TIMEOUT_MS=
EXCHANGE_RATE_CIRCUIT_FAILURE_THRESHOLD=
EXCHANGE_RATE_CIRCUIT_RESET_TIMEOUT_MS=
```

Rule:

- Env riêng theo service được ưu tiên.
- Nếu env riêng không có, fallback về env chung.
- Nếu env chung cũng không có, dùng default:
  - `failureThreshold = 5`
  - `resetTimeoutMs = 30000`

## 5. Thêm visibility vào health check

File liên quan:

- `backend/src/controllers/health.controller.ts`
- `backend/src/@types/index.d.ts`
- `backend/src/utils/circuitBreaker.util.ts`

Thay đổi:

- Thêm `getCircuitBreakerSnapshots()`.
- Endpoint `/health` trả thêm trạng thái các breaker:
  - `gemini`
  - `resend`
  - `cloudinary`
  - `exchangeRate`

Mỗi breaker trả:

```ts
{
  state,
  failureCount,
  failureThreshold,
  resetTimeoutMs
}
```

Kết quả:

- Có thể kiểm tra breaker nào đang `OPEN`, `HALF_OPEN`, hoặc `CLOSED`.
- Dễ debug hơn khi dependency ngoài bị lỗi.

## 6. Cập nhật tài liệu summary

File liên quan:

- `docs/circuit-breaker-retry-summary.md`

Thay đổi:

- Cập nhật trạng thái mới:
  - Exchange Rate API đã có circuit breaker.
  - Cloudinary đã có circuit breaker.
  - Exchange Rate có stale cache fallback.
  - `/health` có circuit breaker snapshot.
  - Env config cho circuit breaker đã được bổ sung.

## Verification

Đã chạy trong `backend`:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Kết quả:

- TypeScript type-check pass.
- ESLint pass.
- Unit test pass: 26 suites passed, 195 tests passed, 3 skipped.

## File đã chỉnh

- `backend/.env.example`
- `backend/samples/.env.sample`
- `backend/src/@types/index.d.ts`
- `backend/src/config/cloudinary.config.ts`
- `backend/src/controllers/health.controller.ts`
- `backend/src/lib/exchange-rate-currency.ts`
- `backend/src/services/currency.service.ts`
- `backend/src/utils/circuitBreaker.util.ts`
- `client/src/features/analytics/analyticsAPI.ts`
- `docs/circuit-breaker-retry-summary.md`

## Ghi chú còn lại

- Resend Email vẫn chỉ có circuit breaker, chưa có retry hoặc fallback provider.
- Gemini retry classification vẫn nên được rà riêng nếu muốn phân biệt rõ lỗi permission/config với lỗi provider tạm thời.
- Cloudinary hiện có circuit breaker nhưng chưa có retry riêng hoặc fallback storage provider.
