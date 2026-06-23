# BullMQ Worker Reliability - Requirements

## Trạng thái

Draft đã chốt phạm vi, chờ review trước implementation.

## Bối cảnh

Backend hiện có ba BullMQ worker:

- `transactionWorker`: bulk import, recurring transaction và recurring summary.
- `reportWorker`: tạo report, gửi email và lưu report history.
- `receiptWorker`: xử lý các receipt job legacy còn trong BullMQ.

BullMQ không dùng manual `ack()` như RabbitMQ. Processor resolve/return thì job
được chuyển sang `completed`; processor throw thì job được chuyển sang `failed`
và có thể retry. Vì stalled job cũng có thể được chạy lại, hệ thống phải giả
định delivery là at-least-once.

`jobId` hiện đã giảm enqueue trùng cho bulk import, report và recurring flow.
Tuy nhiên, `jobId` không ngăn một job đã active bị chạy lại sau retry, stalled
recovery hoặc worker crash. Reliability vì vậy phải được bảo vệ ở business
side effect, không chỉ tại queue.

## Mục tiêu

- Giữ cơ chế auto-completion mặc định của BullMQ; không thêm manual ack.
- Phân biệt rõ success, business no-op, retryable failure và permanent failure.
- Ngăn side effect nghiệp vụ bị tạo trùng khi cùng một job chạy nhiều lần.
- Bổ sung worker-level error handling và logging nhất quán.
- Giữ nguyên public API hiện tại.
- Thực hiện thay đổi nhỏ, theo domain, không xây worker framework tổng quát.

## Ngoài phạm vi

- Không thay BullMQ bằng RabbitMQ hoặc queue khác.
- Không xây `createReliableWorker` factory hay framework lifecycle chung.
- Không cam kết exactly-once delivery ở tầng queue.
- Không đưa receipt scan flow mới trong controller trở lại BullMQ.
- Không thay đổi số lần retry, backoff hoặc concurrency nếu test không chứng
  minh cấu hình hiện tại gây lỗi.
- Không thay đổi payload hoặc response contract public của API.
- Không giải quyết mọi notification/socket deduplication trên toàn hệ thống.

## Thuật ngữ

- **Queue deduplication**: ngăn enqueue hai job có cùng `jobId`.
- **Business idempotency**: chạy processor nhiều lần vẫn cho cùng trạng thái
  nghiệp vụ cuối cùng và không tạo side effect trùng.
- **Retryable failure**: lỗi tạm thời có khả năng thành công khi retry, ví dụ
  Redis, MongoDB, Gemini, Cloudinary hoặc email provider tạm thời unavailable.
- **Permanent failure**: input hoặc business state không thể thành công khi
  retry với cùng dữ liệu.
- **Business no-op**: không cần tạo side effect vì trạng thái mong muốn đã tồn
  tại; đây là kết quả completed hợp lệ và phải có reason rõ ràng.

## Yêu cầu chức năng

### R1. Không dùng manual ack

- Worker processor tiếp tục dùng `return` để complete và `throw` để fail.
- Không gọi trực tiếp `moveToCompleted`, `moveToFailed` hoặc thao tác lock token
  trong các worker hiện tại.
- `removeOnComplete` và `removeOnFail` chỉ được xem là retention policy, không
  phải ack policy.

### R2. Chuẩn hóa kết quả processor

Mỗi handler chỉ được return trong hai trường hợp:

- Side effect cần thiết đã hoàn tất.
- Trạng thái đích đã tồn tại và handler xác định đây là business no-op hợp lệ.

Kết quả completed phải có shape tối thiểu:

```ts
type JobOutcome =
  | { status: 'succeeded'; details?: Record<string, unknown> }
  | { status: 'skipped'; reason: string; details?: Record<string, unknown> };
```

Không dùng `{ success: false }` để biểu diễn failure trong một job completed.

### R3. Phân loại lỗi

- Retryable failure phải throw `Error` thông thường để BullMQ áp dụng attempts
  và backoff hiện tại.
- Permanent failure phải throw `UnrecoverableError` để job vào failed set mà
  không retry.
- Business no-op phải return `status: 'skipped'`, không throw.
- Helper dùng chung chỉ được chuẩn hóa classification và final-attempt checks;
  quyết định lỗi thuộc loại nào vẫn nằm trong từng domain handler.

### R4. Worker-level error listener

Cả ba worker phải có listener `error`.

Log phải có:

- worker/queue name
- error message và stack khi có
- event type

Listener không được throw thêm lỗi hoặc dừng process có chủ đích.

### R5. Bulk import idempotency và resume

Bulk import phải dùng `importBatchId` làm business idempotency boundary.

- Nếu batch đã `COMPLETED`, retry/replay phải return `skipped`.
- Nếu batch không tồn tại, job phải là permanent failure; không return
  `{ success: false }`.
- Batch phải lưu checkpoint đủ để resume từ chunk chưa hoàn thành.
- Sau mỗi chunk đã commit, checkpoint và counters phải được persist.
- Retry không được insert lại row thuộc chunk đã checkpoint thành công.
- Batch chỉ chuyển `COMPLETED` và xóa `transactions` sau khi toàn bộ chunk đã
  được xử lý.
- Retryable failure không được biến batch thành terminal `FAILED` trước khi hết
  attempts.
- Chỉ final failure mới chuyển batch sang `FAILED`, set `terminalAt` và emit
  failure cuối cùng.

### R6. Recurring transaction idempotency

Mỗi recurring occurrence phải unique theo:

```text
recurringSourceId + occurrenceDate
```

- Transaction child phải lưu `recurringSourceId` và `date` là occurrence date.
- MongoDB phải enforce uniqueness bằng partial unique index cho recurring child.
- Tạo child và advance `nextRecurringDate` của source phải nằm trong cùng MongoDB
  transaction/session.
- Duplicate-key do replay cùng occurrence được xem là business no-op nếu child
  tương ứng đã tồn tại.
- Retry không được tạo thêm child cho cùng occurrence.
- Worker phải truyền session xuống repository operations; không được mở
  transaction nhưng thực hiện write ngoài session.

### R7. Report idempotency

Một scheduled report delivery được định danh bằng:

```text
settingId + dueDate
```

- `jobId` tiếp tục dùng cùng identity để ngăn cron enqueue trùng.
- Report history phải lưu durable delivery key tương ứng và enforce unique.
- Gửi email qua Resend phải dùng stable idempotency key từ delivery key.
- Retry cùng delivery phải gửi cùng payload và cùng idempotency key.
- Nếu report delivery đã ở trạng thái terminal thành công, replay phải return
  `skipped`.
- Không tạo một report `FAILED` record mới cho mỗi attempt.
- Attempt failure cập nhật cùng delivery record; terminal `FAILED` chỉ được
  công bố khi hết attempts.
- `nextReportDate` chỉ advance một lần khi delivery đi đến `SENT`,
  `NO_ACTIVITY` hoặc terminal `FAILED`.
- Attempt failure còn retry không được advance `nextReportDate`.

Giới hạn: Resend lưu idempotency key trong 24 giờ. MongoDB delivery key vẫn là
nguồn bảo vệ lâu dài cho report history; provider key bảo vệ cửa sổ retry gửi
email.

### R8. Receipt worker idempotency

Yêu cầu này áp dụng cho receipt job legacy còn trong `RECEIPT_QUEUE`.

- Business identity ưu tiên `userId + imageHash`; job không có `imageHash` chỉ
  được bảo vệ theo `job.id`.
- Cache hit với kết quả hợp lệ phải emit kết quả cho `job.id` hiện tại rồi
  return `skipped`; không gọi lại Gemini/Cloudinary.
- Cloudinary tiếp tục dùng deterministic public ID.
- `NonReceiptImageError` là permanent failure và không retry.
- Lỗi provider/network tạm thời vẫn retry theo attempts/backoff.
- Success/failure socket event chỉ được emit khi trạng thái tương ứng được xác
  định; duplicate event vẫn phải được client chịu được.
- Spec không thay đổi receipt scan background flow hiện chạy trong API process.

### R9. Socket và cache side effects

- Cache invalidation và socket emit là side effect phụ, không phải commit point
  của business data.
- Lỗi cache invalidation hoặc socket emit không được đổi một business success
  thành retry nếu retry có thể tạo side effect chính trùng.
- Event phải mang stable identity hiện có (`jobId`, `importBatchId`, report ID
  hoặc occurrence identity) để client có thể bỏ qua event trùng khi cần.

### R10. Logging và observability

Log lifecycle phải phân biệt:

- attempt failed và sẽ retry
- permanent failure
- final failure
- completed success
- completed skip/no-op
- worker infrastructure error

Metadata tối thiểu:

- `jobId`
- `jobName`
- `attemptsMade`
- `maxAttempts`
- domain identity, nếu có
- `correlationId`, nếu có

Không log receipt base64, email body hoặc dữ liệu tài chính nhạy cảm.

## Acceptance criteria

- Không có code manual ack trong ba worker.
- Cả ba worker có `error` listener và test tương ứng.
- Missing import batch không còn tạo completed job với `success: false`.
- Bulk import replay sau một checkpoint không insert lại chunk đã hoàn thành.
- Cùng recurring source và occurrence date chỉ tồn tại một child transaction.
- Cùng report `settingId + dueDate` chỉ có một report delivery record và dùng
  một Resend idempotency key ổn định.
- Non-receipt image không retry; transient receipt failure vẫn retry.
- Attempt failure không phát terminal failure notification quá sớm.
- Unit/integration tests cover success, retryable failure, permanent failure,
  duplicate execution và stalled/replayed execution.
- Lint, typecheck, build và test liên quan đều pass.

## Edge cases

- Worker crash sau khi external provider thành công nhưng trước khi MongoDB
  update: retry dùng cùng provider idempotency key.
- Worker crash sau khi MongoDB commit nhưng trước khi BullMQ complete: replay
  đọc durable state và return `skipped`.
- Hai worker đồng thời nhận equivalent business work: unique index hoặc atomic
  claim chỉ cho phép một side effect chính thắng.
- Bulk import process chết giữa hai chunk: resume từ checkpoint cuối đã persist.
- Recurring source bị user sửa hoặc tắt trong lúc job đang chờ: handler re-read
  source và xử lý thành permanent skip/failure theo state hiện tại.
- Report setting bị disable sau enqueue: không gửi email; return skipped và
  không advance schedule ngoài policy.
- Receipt cache hỏng JSON: bỏ qua cache và xử lý như cache miss, có warning log.
- Socket disconnected: business state vẫn đúng và client có thể refetch.

## Success criteria

- Retry hoặc stalled recovery không tạo duplicate report email, recurring child
  hoặc bulk-imported rows trong các test đã định.
- Failure state phản ánh đúng attempt lifecycle, không báo terminal failure khi
  BullMQ vẫn còn retry.
- Thay đổi tập trung trong worker, repository/model và helper nhỏ liên quan;
  không tạo abstraction framework mới.
