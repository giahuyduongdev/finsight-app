# Receipt scan cache plan

Tài liệu này mô tả hướng cache cho flow AI Scan Receipt để tránh tốn tài nguyên khi user quét lại cùng một bill nhiều lần nhưng chưa bấm Save.

## Cập nhật sau CodeRabbit PR #65

Các hardening đã được bổ sung:

- `RECEIPT_SCAN_CACHE_TTL_SECONDS` chỉ nhận số nguyên dương; giá trị decimal, zero, âm hoặc invalid sẽ fallback về default `86400`.
- Gemini response không parse được JSON sẽ được map thành `NonReceiptImageError`, để client nhận đúng lỗi ảnh không phải receipt hoặc AI không đọc được receipt.
- Background receipt scan catch không assume thrown value luôn là `Error`; lỗi primitive/object vẫn được normalize và log bằng `serializeError`.
- Worker receipt scan giữ lại `imageHash` khi compact job data sau upload Cloudinary, để retry path vẫn cache/reuse theo cùng hash.
- Unit test không hard-code TTL `86400` nữa mà dùng helper `getReceiptScanCacheTtlSeconds()`.

## Vấn đề hiện tại

Flow hiện tại:

1. Frontend upload ảnh receipt.
2. Backend compress ảnh bằng `sharp`.
3. Backend enqueue job scan receipt.
4. Worker upload ảnh lên Cloudinary.
5. Worker gọi Gemini để trích xuất dữ liệu.
6. Worker emit kết quả về frontend.
7. Frontend fill form.

Nếu user scan lại đúng ảnh đó, backend vẫn làm lại toàn bộ các bước trên. Điều này tốn:

- CPU compress ảnh.
- Redis/BullMQ job.
- Cloudinary upload.
- Gemini request.
- Thời gian chờ của user.

## Hướng cache nên dùng

Nên cache theo:

```text
userId + hash(compressed image)
```

Ví dụ Redis key:

```text
receipt:scan-cache:{userId}:{imageHash}
```

Trong đó:

- `userId` giúp cache không bị dùng chéo giữa các user.
- `imageHash` được tính từ buffer ảnh sau khi compress, để cùng một ảnh tạo ra cùng key ổn định.
- Hash nên dùng SHA-256.

## Vì sao không cache global chỉ theo image hash?

Không nên dùng key chỉ gồm `imageHash`, vì:

- Receipt có thể chứa dữ liệu nhạy cảm.
- Hai user upload cùng ảnh thì không nên tự động chia sẻ kết quả/URL.
- Cache theo user an toàn hơn và dễ audit hơn.

## Vì sao hash ảnh sau khi compress?

Backend đã compress ảnh trước khi đưa vào queue. Hash trên `compressedBuffer` có lợi:

- Dữ liệu ổn định hơn cho pipeline thực tế.
- Cache key khớp với ảnh mà worker/Gemini xử lý.
- Tránh cache miss do metadata ảnh gốc khác nhau nhưng sau compress giống nhau.

## Cache nên lưu gì?

Cache value nên lưu JSON:

```ts
{
  data: {
    title: string
    amount: number
    currency: string
    date: string
    description: string
    category: string
    paymentMethod: string
    type: string
    status: string
    receiptUrl: string
  },
  cachedAt: string
}
```

`receiptUrl` nên được cache cùng extracted data vì nếu cache hit thì frontend vẫn cần ảnh receipt URL để lưu vào transaction khi user bấm Save.

## TTL đề xuất

TTL hợp lý: `24 giờ`.

Lý do:

- Đủ để user scan lại trong cùng phiên làm việc.
- Không giữ dữ liệu receipt lâu nếu user không Save.
- Giảm rủi ro lưu tạm dữ liệu nhạy cảm quá lâu.

Có thể cấu hình bằng env:

```env
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
```

Nếu env không có thì dùng default `86400`.

Env phải là số nguyên dương. Ví dụ hợp lệ:

```env
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
```

Ví dụ không hợp lệ và sẽ fallback về default:

```env
RECEIPT_SCAN_CACHE_TTL_SECONDS=3600.5
RECEIPT_SCAN_CACHE_TTL_SECONDS=0
RECEIPT_SCAN_CACHE_TTL_SECONDS=-1
RECEIPT_SCAN_CACHE_TTL_SECONDS=invalid
```

## Flow sau khi thêm cache

### Cache hit

1. Controller nhận ảnh.
2. Compress ảnh.
3. Tính `imageHash`.
4. Check Redis key `receipt:scan-cache:{userId}:{imageHash}`.
5. Nếu có cache, trả response sync:

```ts
{
  data: {
    receipt: cached.data
  }
}
```

Frontend hiện đã hỗ trợ response có `data.receipt`, nên không cần chờ socket.

### Cache miss

1. Controller nhận ảnh.
2. Compress ảnh.
3. Tính `imageHash`.
4. Trả `jobId` ngay cho frontend.
5. Background task gọi Gemini trên ảnh nén trong RAM để xác định và trích xuất receipt.
6. Nếu ảnh không phải receipt hoặc Gemini trả JSON không parse được, emit `receipt:scan-failed` và không upload Cloudinary.
7. Nếu ảnh là receipt hợp lệ, check Cloudinary bằng `public_id = receipts/{userId}/{imageHash}`.
8. Nếu Cloudinary đã có ảnh này, dùng lại `secure_url` cũ và không upload lại.
9. Nếu Cloudinary chưa có ảnh này, upload với `overwrite: false`.
10. Background task lưu kết quả vào Redis cache theo `userId + imageHash`.
11. Background task emit `receipt:scan-completed`.

## Không upload/cache lỗi non-receipt

Không nên cache kết quả lỗi non-receipt ở bước đầu và cũng không nên upload ảnh đó lên Cloudinary.

Lý do:

- User có thể crop/chụp lại ảnh tốt hơn ngay sau đó.
- Cache lỗi dễ gây khó hiểu nếu ảnh hơi khác nhưng hash trùng do pipeline resize.
- Lợi ích tiết kiệm không lớn bằng cache successful receipt extraction.
- Tránh tạo ảnh rác trên Cloudinary.

## File dự kiến chỉnh

- `backend/src/controllers/transaction.controller.ts`
- `backend/src/workers/receipt.worker.ts`
- `backend/src/config/env.config.ts`
- `backend/.env.example`
- `backend/samples/.env.sample`

## Verification

Sau khi implement cần chạy:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Sau batch fix PR #65 đã chạy:

```bash
npm.cmd test -- --runInBand --runTestsByPath src/__tests__/unit/receipt-scan-cache.util.test.ts src/__tests__/unit/receipt-ai.util.test.ts src/__tests__/unit/transaction.controller.test.ts
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Kết quả:

- Targeted receipt-related unit tests pass.
- Backend type-check pass.
- Backend lint pass.
- Full backend unit tests pass: 26 suites passed, 195 tests passed, 3 skipped.
