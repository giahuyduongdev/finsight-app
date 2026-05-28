# Receipt scan Redis optimization

Tài liệu này ghi lại thay đổi đã làm để giảm tải Redis/BullMQ trong flow AI Scan Receipt.

## Vấn đề trước khi sửa

Flow cũ:

1. Client upload ảnh receipt lên backend.
2. Backend compress ảnh bằng `sharp`.
3. Backend convert ảnh nén thành base64.
4. Backend enqueue BullMQ job với field `fileBuffer`.
5. BullMQ lưu job data trong Redis.
6. Worker đọc `fileBuffer`, decode lại thành `Buffer`.
7. Worker upload ảnh lên Cloudinary.
8. Worker update job data, thay `fileBuffer` bằng `imageUrl`.

Điểm tốn Redis nằm ở bước 4-5:

```ts
{
  fileBuffer: base64String
}
```

Base64 thường lớn hơn binary khoảng 33%. Nếu ảnh sau nén là 500KB, chuỗi base64 có thể khoảng 665KB. Khi nhiều job cùng chờ worker xử lý, Redis/BullMQ phải giữ các payload lớn này.

## Hướng đã đổi

Flow mới sau tối ưu response:

1. Client upload ảnh receipt lên backend.
2. Backend compress ảnh bằng `sharp`.
3. Backend tính `imageHash` từ compressed image để check cache.
4. Nếu cache miss, backend tạo `jobId` và trả response `202` ngay.
5. Backend tiếp tục gọi Gemini trên ảnh nén trong RAM ở background.
6. Nếu ảnh không phải receipt, backend emit `receipt:scan-failed` và không upload Cloudinary.
7. Nếu ảnh là receipt hợp lệ, backend check Cloudinary bằng deterministic `public_id = receipts/{userId}/{imageHash}`.
8. Nếu Cloudinary đã có ảnh này, backend dùng lại `secure_url` cũ và không upload lại.
9. Nếu Cloudinary chưa có ảnh này, backend upload với `overwrite: false`.
10. Backend lưu result vào Redis scan cache.
11. Backend emit `receipt:scan-completed` về client.

Scan mới không còn tạo BullMQ job chứa base64 image. Worker vẫn giữ code xử lý legacy job nếu Redis còn job cũ:

```ts
{
  userId,
  imageUrl,
  imageHash,
  fileName,
  fileSize,
  correlationId
}
```

## File đã chỉnh

### `backend/src/controllers/transaction.controller.ts`

Thay đổi:

- Sau khi compress ảnh, controller tính `imageHash`.
- Check Redis cache theo `userId + imageHash`.
- Nếu cache hit, trả ngay `data.receipt`.
- Nếu cache miss, tạo `jobId` và trả ngay cho frontend.
- Gọi Gemini ở background để validate ảnh trước.
- Nếu không phải receipt, emit `receipt:scan-failed` và không upload Cloudinary.
- Nếu là receipt hợp lệ, check Cloudinary bằng `public_id` ổn định theo `userId + imageHash`.
- Nếu Cloudinary đã có ảnh này, dùng lại `secure_url` cũ và không upload lại.
- Nếu Cloudinary chưa có ảnh này, upload ảnh nén với `overwrite: false`.
- Cache extracted data + `receiptUrl`.
- Emit `receipt:scan-completed` theo `jobId`.

Kết quả:

- Redis/BullMQ không phải giữ base64 image cho job mới.
- Endpoint không phải chờ Cloudinary upload trước khi trả `jobId`.
- Non-receipt image không bị upload lên Cloudinary.
- Cache hit không cần queue, không cần Cloudinary, không cần Gemini.

### `backend/src/workers/receipt.worker.ts`

Thay đổi:

- Worker vẫn giữ nhánh `fileBuffer` và `imageUrl` để xử lý các job cũ còn tồn trong Redis.
- Scan mới không phụ thuộc worker nữa; background task trong controller xử lý AI + Cloudinary + socket.

Kết quả:

- Không phá các job cũ chưa xử lý.
- Job mới nhẹ hơn trong Redis.

### `backend/src/utils/receipt/upload.util.ts`

Thay đổi:

- Tách helper upload receipt image lên Cloudinary.
- Controller và worker dùng chung helper này.
- Upload vẫn đi qua `cloudinaryCircuitBreaker`.
- Trước khi upload, helper check asset theo `public_id`.
- Nếu asset đã tồn tại, helper trả lại `secure_url` cũ và không gọi `upload_stream`.
- Khi upload mới, helper truyền `overwrite: false` để tránh ghi đè ảnh cũ.

### `backend/src/queues/receipt.queue.ts`

Thay đổi:

- Cập nhật comment type:
  - `fileBuffer`: legacy path cho job cũ.
  - `imageUrl`: preferred path cho job mới.

## Tradeoff

Đổi này giảm tải Redis nhưng chuyển AI/upload sang background task trong API process.

So sánh:

| Tiêu chí | Flow cũ | Flow mới |
| --- | --- | --- |
| Redis/BullMQ payload | Lớn vì chứa base64 image | Nhỏ vì chỉ chứa URL |
| Response controller | Nhanh hơn | Gần như nhanh như flow cũ; không chờ Cloudinary upload |
| Worker | Upload Cloudinary + AI | Chỉ xử lý legacy jobs; scan mới chạy background task |
| Cache hit | Không có trước đó | Trả ngay từ Redis |
| Cloudinary duplicate | Có thể upload lại | Dùng deterministic `public_id`, check asset cũ trước |

Tradeoff hiện tại là background AI/upload chạy trong API process. Nếu process crash ngay sau khi trả `jobId` nhưng trước khi emit socket event, frontend sẽ chờ đến safety timeout. Đổi lại, Redis không giữ ảnh base64 và non-receipt image không bị upload lên Cloudinary.

## Cache liên quan

Flow hiện cũng có cache result theo:

```text
receipt:scan-cache:{userId}:{imageHash}
```

TTL default:

```env
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
```

Cache chỉ lưu JSON kết quả scan, không lưu ảnh.

Sau batch fix CodeRabbit PR #65:

- `RECEIPT_SCAN_CACHE_TTL_SECONDS` chỉ nhận số nguyên dương; decimal/zero/negative/invalid fallback về `86400`.
- Gemini invalid JSON được map thành `NonReceiptImageError`, nên frontend nhận lỗi non-receipt thay vì lỗi server mơ hồ.
- Background task normalize thrown value trước khi tạo message cho socket failure.
- Worker giữ `imageHash` khi compact job data để retry path vẫn cache theo đúng key.

## Verification

Đã chạy trong `backend`:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Kết quả:

- Type-check pass.
- ESLint pass.
- Unit test pass: 26 suites passed, 195 tests passed, 3 skipped.

## Ghi chú

- Cần restart backend để flow mới có hiệu lực.
- Nếu còn job cũ trong Redis có `fileBuffer`, worker vẫn xử lý được.
- Worker vẫn nên chạy nếu hệ thống còn legacy receipt jobs hoặc các worker khác.
## Cập nhật Cloudinary lookup 404

Sau khi cải thiện logging, lỗi receipt scan mới nhất được xác định là Cloudinary lookup trả `404 Resource not found` cho deterministic `public_id`:

```text
receipts/{userId}/{imageHash}
```

Đây là case bình thường khi ảnh chưa từng được upload. Flow đúng là:

```text
Cloudinary lookup 404 -> upload ảnh mới -> cache result -> emit receipt:scan-completed
```

Root cause là Cloudinary SDK trả lỗi dạng nested:

```ts
{
  error: {
    http_code: 404,
    message: 'Resource not found ...'
  }
}
```

Trong khi helper cũ chỉ check:

```ts
err.http_code === 404
```

Đã sửa `backend/src/utils/receipt/upload.util.ts` để nhận cả:

```ts
err.http_code === 404
err.error?.http_code === 404
```

Đã cập nhật test ở:

```text
backend/src/__tests__/unit/receipt-upload.util.test.ts
```

Logging liên quan cũng đã được cải thiện để không còn mất chi tiết lỗi thành:

```text
[object Object]
```

Chi tiết xem thêm:

```text
docs/receipt-scan-cache/cloudinary-receipt-upload-failure.md
docs/logging/logging-fix-plan.md
```
