# Circuit breaker, retry và fallback trong Finsight

Tài liệu này tóm tắt hai nội dung:

- `CircuitBreaker` đang được dùng như thế nào trong dự án.
- Retry/fallback hiện nằm ở đâu và khác gì circuit breaker.

## 1. Circuit breaker là gì?

Circuit breaker là pattern dùng để bảo vệ hệ thống khi gọi dịch vụ bên ngoài bị lỗi liên tục.

Ý tưởng giống cầu dao điện:

- Bình thường request vẫn đi qua.
- Nếu lỗi liên tiếp vượt ngưỡng, circuit mở.
- Khi circuit mở, request mới fail nhanh, không gọi tiếp dịch vụ ngoài.
- Sau một khoảng chờ, hệ thống thử lại một request.
- Nếu request thử thành công, circuit đóng lại.
- Nếu request thử vẫn fail, circuit mở tiếp.

Trong dự án này, circuit breaker là utility tự viết ở:

- `backend/src/utils/circuitBreaker.util.ts`

Không phải package bên ngoài.

## 2. Cách `CircuitBreaker` hoạt động trong code

Các trạng thái:

| State | Ý nghĩa |
| --- | --- |
| `CLOSED` | Bình thường, operation được gọi |
| `OPEN` | Đã lỗi quá nhiều, request bị chặn ngay |
| `HALF_OPEN` | Cho đúng một request thử để kiểm tra dịch vụ đã hồi phục chưa |

Config mặc định:

| Config | Giá trị |
| --- | --- |
| `failureThreshold` | `5` lỗi liên tiếp |
| `resetTimeoutMs` | `30000ms` |

Flow:

1. Ban đầu breaker ở `CLOSED`.
2. Mỗi lần operation fail, `failureCount` tăng lên.
3. Khi `failureCount >= failureThreshold`, breaker chuyển sang `OPEN`.
4. Khi `OPEN`, request mới bị reject ngay bằng `AppError`.
5. Lỗi trả về có status `503` và error code `CIRCUIT_BREAKER_OPEN`.
6. Sau `resetTimeoutMs`, breaker chuyển sang `HALF_OPEN`.
7. Ở `HALF_OPEN`, chỉ một request được chạy thử.
8. Request thử thành công thì reset về `CLOSED`.
9. Request thử fail thì quay lại `OPEN`.

## 3. Circuit breaker đang áp dụng ở đâu?

### Gemini AI

File:

- `backend/src/config/google-ai.config.ts`

`generateWithFallback()` bọc toàn bộ flow gọi Gemini bằng:

```ts
geminiCircuitBreaker.execute(
  () => generateWithFallbackInternal(contents, config),
  'Gemini AI'
)
```

Điều này có nghĩa:

- Các call Gemini đi qua `generateWithFallback()` đều được breaker bảo vệ.
- Nếu toàn bộ flow Gemini lỗi liên tục, circuit sẽ mở.
- Khi circuit mở, request mới không gọi Gemini nữa mà fail nhanh.

### Resend Email

File:

- `backend/src/mailers/mailer.ts`

`sendEmail()` bọc call Resend bằng:

```ts
resendCircuitBreaker.execute(
  () => resend.emails.send(...),
  'Resend Email'
)
```

Các mail auth như verify account, reset password, change password, change email đều gọi qua `sendEmail()`, nên đều đi qua breaker này.

### Cloudinary

File:

- `backend/src/config/cloudinary.config.ts`

Upload và delete Cloudinary hiện được bọc bằng:

```ts
cloudinaryCircuitBreaker.execute(...)
```

Điều này có nghĩa:

- Nếu upload/delete Cloudinary fail liên tục, circuit sẽ mở.
- Khi circuit mở, request upload/delete mới fail nhanh thay vì tiếp tục gọi Cloudinary.

### Exchange Rate API

File:

- `backend/src/lib/exchange-rate-currency.ts`

`fetchExchangeRatesWithFallback()` hiện được bọc bằng:

```ts
exchangeRateCircuitBreaker.execute(...)
```

Circuit breaker bọc toàn bộ primary/fallback API flow. Nếu primary fail nhưng fallback thành công thì operation vẫn được tính là thành công. Nếu cả primary/fallback cùng fail liên tục, circuit sẽ mở.

### Các breaker hiện có

Hiện có export:

```ts
export const geminiCircuitBreaker = new CircuitBreaker()
export const resendCircuitBreaker = new CircuitBreaker()
export const cloudinaryCircuitBreaker = new CircuitBreaker()
export const exchangeRateCircuitBreaker = new CircuitBreaker()
```

## 4. Tại sao cần circuit breaker?

Nếu không có circuit breaker, khi Gemini hoặc Resend đang lỗi:

- Backend vẫn tiếp tục gọi dịch vụ ngoài liên tục.
- Request dễ bị chờ timeout lâu.
- Worker/API có thể bị nghẽn vì nhiều call đang treo.
- Log bị spam lỗi giống nhau.
- Dịch vụ ngoài đang rate limit hoặc downtime lại bị gọi dồn dập hơn.

Circuit breaker giúp:

- Fail nhanh khi dependency đang hỏng.
- Giảm tải cho backend.
- Tránh gọi dồn dập vào dịch vụ ngoài.
- Cho dịch vụ ngoài thời gian hồi phục.
- Tự thử lại sau một khoảng chờ.

## 5. Retry/fallback là gì?

Retry/fallback khác circuit breaker.

| Cơ chế | Mục đích |
| --- | --- |
| Retry | Thử lại khi lỗi có thể chỉ là tạm thời |
| Fallback | Chuyển sang phương án khác khi phương án chính fail |
| Circuit breaker | Ngừng gọi dependency một thời gian nếu nó fail liên tục |

Nói ngắn gọn:

- Retry/fallback xử lý lỗi trong một request.
- Circuit breaker bảo vệ hệ thống qua nhiều request liên tiếp.

## 6. Retry/fallback đang nằm ở đâu?

### Gemini AI: có retry và fallback

File:

- `backend/src/config/google-ai.config.ts`

Hàm chính:

```ts
generateWithFallbackInternal()
```

Fallback theo model và API key:

```ts
for (const modelName of AI_MODELS) {
  for (const { instance, keyIndex } of aiPool) {
    ...
  }
}
```

Danh sách model:

```ts
export const AI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview'
]
```

API key được lấy từ `GEMINI_API_KEY`, tách bằng dấu phẩy.

Nếu một model/key fail với lỗi retryable, code sẽ thử model/key tiếp theo.

Các lỗi retryable hiện gồm:

- `429`
- `RESOURCE_EXHAUSTED`
- `503`
- `504`
- `UNAVAILABLE`
- `DEADLINE_EXCEEDED`
- `403`
- `PERMISSION_DENIED`
- `404`
- `NOT_FOUND`

Với lỗi `429`, code dùng exponential backoff và jitter:

```ts
const backoffDelay = Math.min(
  baseDelay * Math.pow(2, attemptCount),
  maxDelay
)
await delay(backoffDelay + jitter)
```

Với lỗi server như `503`, `504`, `DEADLINE`, `UNAVAILABLE`, code delay cố định `2000ms`.

Các lỗi fatal không retry:

- `SAFETY`
- `BLOCKED`
- `API_KEY_INVALID`
- `invalid api key`
- `INVALID_ARGUMENT`

Sau khi thử hết model/key mà vẫn fail, function throw lỗi cuối cùng.

### Exchange rate: có fallback API, không có retry loop

File:

- `backend/src/lib/exchange-rate-currency.ts`

Hàm:

```ts
fetchExchangeRatesWithFallback(currency)
```

Flow:

1. Gọi primary API bằng `EXCHANGE_RATE_PRIMARY_API_URL`.
2. Timeout mỗi call là `10000ms`.
3. Nếu primary fail và có `EXCHANGE_RATE_FALLBACK_API_URL`, gọi fallback API.
4. Nếu không có fallback URL, throw lỗi primary.

Đây là fallback, không phải retry loop.

Nó chỉ thử:

- Primary một lần.
- Fallback một lần.

Ngoài ra `getExchangeRate()` có Redis cache. Nếu cache có rate thì không gọi API ngoài.

Hiện `getExchangeRate()` cũng lưu thêm stale cache. Nếu API ngoài fail nhưng còn stale rate, backend trả stale rate thay vì throw ngay.

### Resend Email: có circuit breaker, chưa có retry/fallback

File:

- `backend/src/mailers/mailer.ts`

Hiện `sendEmail()` chỉ bọc Resend bằng circuit breaker:

```ts
resendCircuitBreaker.execute(...)
```

Không thấy retry nhiều lần và không có fallback email provider khác.

### Cloudinary: có circuit breaker, chưa có retry/fallback

File:

- `backend/src/config/cloudinary.config.ts`

Upload/delete hiện đã được bọc bằng `cloudinaryCircuitBreaker`. Tuy nhiên vẫn chưa có retry riêng và chưa có fallback storage provider.

## 7. Circuit breaker config và visibility

Circuit breaker có thể cấu hình bằng env chung:

- `CIRCUIT_FAILURE_THRESHOLD`
- `CIRCUIT_RESET_TIMEOUT_MS`

Hoặc env riêng theo service:

- `GEMINI_CIRCUIT_FAILURE_THRESHOLD`
- `GEMINI_CIRCUIT_RESET_TIMEOUT_MS`
- `RESEND_CIRCUIT_FAILURE_THRESHOLD`
- `RESEND_CIRCUIT_RESET_TIMEOUT_MS`
- `CLOUDINARY_CIRCUIT_FAILURE_THRESHOLD`
- `CLOUDINARY_CIRCUIT_RESET_TIMEOUT_MS`
- `EXCHANGE_RATE_CIRCUIT_FAILURE_THRESHOLD`
- `EXCHANGE_RATE_CIRCUIT_RESET_TIMEOUT_MS`

Nếu env riêng không có, code fallback về env chung. Nếu env chung cũng không có, code dùng default:

- `failureThreshold = 5`
- `resetTimeoutMs = 30000`

Endpoint `/health` hiện trả thêm snapshot circuit breaker:

- `state`
- `failureCount`
- `failureThreshold`
- `resetTimeoutMs`

## 8. Bảng tổng hợp

| Service | Retry | Fallback | Circuit breaker |
| --- | --- | --- | --- |
| Gemini AI | Có | Có, qua nhiều model/API key | Có |
| Resend Email | Chưa thấy | Chưa thấy | Có |
| Exchange rate API | Không có retry loop | Có, primary sang fallback API; có stale cache | Có |
| Cloudinary | Chưa thấy | Chưa thấy | Có |

## 9. Test liên quan

File test:

- `backend/src/__tests__/unit/circuitBreaker.util.test.ts`

Test hiện cover:

- Bắt đầu ở `CLOSED`.
- Mở circuit sau 5 lỗi liên tiếp.
- Reject ngay khi `OPEN`.
- Chuyển sang `HALF_OPEN` sau timeout.
- Đóng lại khi request thử thành công.
- Mở lại khi request thử fail.
- Reset failure count sau success.
