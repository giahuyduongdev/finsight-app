# Logging fix plan

## Trạng thái implement

Plan này đã được implement cho lỗi receipt scan hiện tại.

Các thay đổi đã làm:

- Thêm `backend/src/utils/logging/serialize-error.util.ts`.
- Circuit breaker log lỗi bằng `serializeError(error)` thay vì `String(error)`.
- Receipt scan catch log object lỗi đầy đủ.
- Tách format console và file:
  - Console dev vẫn pretty + color.
  - File log dùng JSON, không màu ANSI.
- Redact metadata toàn bộ log info, không chỉ `body` và `meta`.
- Bổ sung redact cho `auth`, `api_key`, `api_secret`.
- Thêm/cập nhật unit test cho serializer, circuit breaker, receipt upload.

Kết quả sau khi scan lại receipt:

```json
{
  "error": {
    "http_code": 404,
    "message": "Resource not found - receipts/{userId}/{imageHash}"
  }
}
```

Root cause thật là Cloudinary SDK trả 404 dạng nested `error.error.http_code`, trong khi helper cũ chỉ check `error.http_code`.

Fix tiếp theo đã làm ở:

```text
backend/src/utils/receipt/upload.util.ts
```

Helper giờ nhận cả:

```ts
err.http_code === 404
err.error?.http_code === 404
```

Vì vậy lookup 404 sẽ được xem là asset chưa tồn tại và flow sẽ tiếp tục upload ảnh mới.

## Mục tiêu

Sửa logging để debug lỗi dễ hơn, đặc biệt là lỗi third-party như Cloudinary, Gemini, Redis, MongoDB.

Vấn đề cần giải quyết trước mắt:

```text
"error": "[object Object]"
```

Khi log như vậy, mình không biết lỗi thật là auth, permission, timeout, quota hay lỗi khác.

## Phạm vi nên sửa

Ưu tiên sửa nhỏ, không refactor toàn bộ logging.

Các file liên quan chính:

```text
backend/src/config/logger.config.ts
backend/src/utils/logging/redact.util.ts
backend/src/utils/circuitBreaker.util.ts
backend/src/controllers/transaction.controller.ts
backend/src/utils/receipt/upload.util.ts
```

## Hướng giải quyết đề xuất

### Bước 1: Tạo helper serialize error

Tạo helper mới, ví dụ:

```text
backend/src/utils/logging/serialize-error.util.ts
```

Helper này nhận `unknown` và trả về object dễ log.

Nên giữ các field:

```text
name
message
stack
code
status
statusCode
http_code
errno
syscall
response
```

Với Error thường:

```ts
serializeError(new Error('Upload failed'))
```

Kết quả mong muốn:

```json
{
  "name": "Error",
  "message": "Upload failed",
  "stack": "..."
}
```

Với Cloudinary object error:

```ts
serializeError({
  message: "Invalid Signature",
  http_code: 401
})
```

Kết quả mong muốn:

```json
{
  "message": "Invalid Signature",
  "http_code": 401
}
```

Với value lạ:

```ts
serializeError("timeout")
```

Kết quả:

```json
{
  "message": "timeout"
}
```

Primitive fallback cũng đi qua redaction helper trước khi ghi log. Với primitive không có field name nhạy cảm, output vẫn là `{ "message": "..." }`; mục tiêu là giữ cùng một đường xử lý redaction cho mọi dạng thrown value.

### Bước 2: Dùng helper trong circuit breaker

Hiện tại `circuitBreaker.util.ts` đang log:

```ts
error: error instanceof Error ? error.message : String(error)
```

Nên đổi thành:

```ts
error: serializeError(error)
```

Lợi ích:

- Cloudinary lỗi object không còn bị thành `[object Object]`.
- Vẫn log được `message`, `http_code`, `code`.
- Không cần sửa từng service ngay lập tức.

Đây là bước quan trọng nhất cho lỗi receipt scan hiện tại.

### Bước 3: Dùng helper trong receipt scan catch

Trong `transaction.controller.ts`, đoạn:

```ts
logger.error('[APP:Transaction] Receipt scan failed', {
  error: err.message,
  ...
})
```

Nên đổi thành:

```ts
logger.error('[APP:Transaction] Receipt scan failed', {
  error: serializeError(error),
  ...
})
```

Lưu ý: vẫn có thể dùng `err.message` để tạo message thân thiện cho frontend, nhưng log nên giữ object lỗi đầy đủ.

### Bước 4: Tách format console và file

Hiện `devFormat` có:

```ts
winston.format.colorize({ all: true })
```

Format này đang áp dụng cho cả console và file. Vì vậy file log có ký tự màu ANSI.

Nên tách thành:

```text
consoleFormat = pretty + color
fileFormat = JSON hoặc pretty không màu
```

Đề xuất đơn giản:

- Console transport dùng `devConsoleFormat`.
- File transport dùng `fileFormat`.
- Production vẫn dùng JSON.

Ví dụ hướng thiết kế:

```ts
const consoleFormat = winston.format.combine(
  timestamp,
  enhancedFormat(),
  redactedFormat(),
  colorize,
  printf
)

const fileFormat = winston.format.combine(
  timestamp,
  errorsWithStack,
  enhancedFormat(),
  redactedFormat(),
  json
)
```

### Bước 5: Redact toàn bộ metadata

Hiện tại `logger.config.ts` chỉ redact:

```ts
info.body
info.meta
```

Nên đổi để redact toàn bộ log info, nhưng giữ lại field hệ thống:

```text
level
message
timestamp
```

Mục tiêu là tránh trường hợp log trực tiếp:

```ts
logger.error('Auth failed', {
  token: 'secret'
})
```

mà `token` không bị che.

### Bước 6: Chạy lại receipt scan để lấy lỗi thật

Sau khi sửa logging, chạy lại scan receipt.

Log mong muốn phải thấy được lỗi Cloudinary thật, ví dụ:

```json
{
  "error": {
    "message": "Invalid Signature",
    "http_code": 401
  }
}
```

Hoặc:

```json
{
  "error": {
    "message": "Resource not found",
    "http_code": 404
  }
}
```

Sau đó mới quyết định sửa behavior Cloudinary.

## Quyết định sau khi có lỗi thật

### Nếu lỗi là 401 hoặc 403

Khả năng cao là credential/quyền Cloudinary có vấn đề với Admin API.

Hướng xử lý:

- Kiểm tra `CLOUDINARY_CLOUD_NAME`.
- Kiểm tra `CLOUDINARY_API_KEY`.
- Kiểm tra `CLOUDINARY_API_SECRET`.
- Kiểm tra account/API permission.
- Nếu không muốn phụ thuộc Admin API, cân nhắc bỏ bước `api.resource()` lookup.

### Nếu lỗi là timeout hoặc network

Hướng xử lý:

- Tăng timeout nếu cần.
- Retry nhẹ.
- Có thể fallback sang upload nếu lookup fail do lỗi tạm thời.

### Nếu lỗi là quota/rate limit

Hướng xử lý:

- Giữ circuit breaker.
- Trả message thân thiện hơn cho frontend.
- Không retry dồn dập.

### Nếu lỗi là duplicate public id

Helper hiện đã có logic:

```text
upload duplicate -> lookup lại existing asset -> reuse secure_url
```

Nếu vẫn fail, cần xem `message/http_code` thật để chỉnh tiếp.

## Unit test nên thêm

Nên thêm unit test cho:

```text
serialize-error.util.ts
circuitBreaker.util.ts
logger redaction
```

Test tối thiểu:

- Serialize `Error`.
- Serialize object có `message` và `http_code`.
- Serialize string.
- Circuit breaker log dùng serialized error thay vì `[object Object]`.
- Redact top-level `token`.

## Verification

Sau khi implement:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd test -- --runInBand --runTestsByPath src/__tests__/unit/circuitBreaker.util.test.ts
```

Nếu có thêm test mới:

```bash
npm.cmd test -- --runInBand --runTestsByPath src/__tests__/unit/serialize-error.util.test.ts
```

Sau đó test thực tế:

```text
Scan lại receipt và xem backend/logs/combined-YYYY-MM-DD.log
```

Kỳ vọng:

```text
Không còn error: "[object Object]"
```
