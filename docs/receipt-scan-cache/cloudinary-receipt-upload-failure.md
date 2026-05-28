# Ghi chú lỗi Cloudinary khi scan receipt

## Trạng thái mới nhất

Lỗi đã được xác định sau khi cải thiện logging.

Receipt scan không fail vì Gemini. Gemini đã đọc ảnh thành công. Lỗi xảy ra ở bước Cloudinary lookup trước upload.

Log mới cho thấy Cloudinary trả:

```json
{
  "error": {
    "http_code": 404,
    "message": "Resource not found - receipts/{userId}/{imageHash}"
  }
}
```

Đây là case bình thường khi ảnh receipt chưa từng được upload. Code đúng phải hiểu `404` là "asset chưa tồn tại", sau đó tiếp tục upload ảnh mới.

## Root cause

Helper receipt upload có logic:

```text
cloudinary.api.resource(publicId)
```

để kiểm tra asset đã tồn tại chưa.

Code cũ chỉ check:

```ts
err.http_code === 404
```

Nhưng Cloudinary SDK trong case này trả lỗi dạng nested:

```ts
{
  error: {
    http_code: 404,
    message: 'Resource not found ...'
  }
}
```

Vì vậy code không nhận ra đây là `404`, throw error luôn, và receipt scan fail trước khi kịp upload ảnh mới.

## Vì sao upload ảnh thường vẫn OK?

Upload ảnh thường và receipt scan đi hai flow khác nhau.

Upload ảnh thường dùng:

```text
backend/src/config/cloudinary.config.ts
```

Flow này upload trực tiếp bằng:

```ts
cloudinary.uploader.upload_stream(...)
```

Receipt scan dùng helper riêng:

```text
backend/src/utils/receipt/upload.util.ts
```

Flow receipt scan làm thêm bước lookup trước upload:

1. Tạo deterministic `public_id` theo `receipts/{userId}/{imageHash}`.
2. Gọi `cloudinary.api.resource(publicId)` để kiểm tra ảnh đã tồn tại chưa.
3. Nếu ảnh đã tồn tại, reuse `secure_url`.
4. Nếu Cloudinary trả `404`, upload ảnh mới bằng `upload_stream`.
5. Nếu Cloudinary trả lỗi khác `404`, receipt scan fail.

Do đó upload ảnh thường có thể vẫn thành công, còn receipt scan vẫn fail nếu lookup 404 không được xử lý đúng.

## Fix đã làm

File đã sửa:

```text
backend/src/utils/receipt/upload.util.ts
```

Logic mới nhận cả hai dạng 404:

```ts
err.http_code === 404
err.error?.http_code === 404
```

Khi gặp một trong hai dạng này, helper trả `null` để báo asset chưa tồn tại, rồi tiếp tục upload ảnh mới.

## Logging liên quan

Trước đó log chỉ hiện:

```json
"error": "[object Object]"
```

Đã thêm serializer lỗi để log rõ object lỗi Cloudinary:

```text
backend/src/utils/logging/serialize-error.util.ts
```

Circuit breaker và receipt scan catch đã dùng serializer này, nên log mới hiển thị được `http_code` và `message`.

## Redaction liên quan

Log Cloudinary mới cũng cho thấy SDK có thể đưa `request_options.auth` vào error object.

Đã cập nhật redaction để che thêm các field:

```text
auth
api_key
api_secret
```

File đã sửa:

```text
backend/src/utils/logging/redact.util.ts
```

## Verification

Đã chạy:

```bash
npm.cmd test -- --runInBand --runTestsByPath src/__tests__/unit/receipt-upload.util.test.ts src/__tests__/unit/serialize-error.util.test.ts src/__tests__/unit/circuitBreaker.util.test.ts
npm.cmd run type-check
npm.cmd run lint
```

Kết quả: pass.

## Cần làm sau khi restart backend

Restart backend rồi scan lại receipt.

Kỳ vọng:

```text
Cloudinary lookup 404 -> upload ảnh mới -> cache result -> emit receipt:scan-completed
```

Nếu vẫn fail, xem `backend/logs/combined-YYYY-MM-DD.log`. Lỗi mới sẽ có `http_code/message` rõ hơn để xử lý tiếp.
