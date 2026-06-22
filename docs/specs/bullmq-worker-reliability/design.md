# BullMQ Worker Reliability - Design

## Tổng quan

Giữ nguyên BullMQ auto-completion và bổ sung hai lớp reliability:

1. Shared primitives nhỏ cho error classification, final-attempt detection và
   worker infrastructure logging.
2. Business idempotency riêng cho bulk import, recurring transaction, report và
   receipt legacy.

Không dùng một worker factory chung vì ba domain có commit point và side effect
khác nhau. Abstraction chỉ được thêm khi có cùng semantics, không chỉ vì code
trông giống nhau.

## Hiện trạng và root cause

### Queue layer

- Queue defaults đã có `attempts`, exponential backoff và retention.
- Bulk import và report đã có deterministic `jobId`.
- Recurring flow hiện dùng timestamp lúc cron chạy trong `jobId`.
- Worker dùng `return`/`throw` đúng cơ chế BullMQ cơ bản.

### Reliability gaps

- `{ success: false }` vẫn là completed job.
- `failed` event chạy ở từng failed attempt; một số domain state/notification có
  thể bị đánh dấu terminal quá sớm.
- Bulk import có thể commit nhiều chunk trước khi throw, nhưng chưa resume từ
  durable checkpoint.
- Recurring worker mở MongoDB session nhưng repository writes hiện không nhận
  session, nên transaction boundary chưa bảo vệ các writes.
- Recurring child chưa có unique constraint theo occurrence.
- Report gửi email trước khi persist history; crash ở giữa có thể gửi trùng.
- Report tạo record `FAILED` theo từng failed attempt.
- Worker chưa có `error` listener.
- Receipt worker đã có deterministic Cloudinary ID và `discard`, nhưng chưa
  chuẩn hóa permanent error và cache-first replay behavior.

## Kiến trúc đề xuất

```text
Queue job
  -> domain handler
      -> validate/re-read business state
      -> detect completed/no-op state
      -> claim or enforce unique business identity
      -> perform main side effect
      -> persist durable terminal/checkpoint state
      -> perform best-effort secondary effects
  -> return JobOutcome OR throw Error/UnrecoverableError
  -> BullMQ moves job to completed/failed/retry
```

## Shared primitives

Tạo module nhỏ gần BullMQ config, ví dụ:

```text
backend/src/utils/bullmq/job-reliability.util.ts
```

API dự kiến:

```ts
type JobOutcome =
  | { status: 'succeeded'; details?: Record<string, unknown> }
  | { status: 'skipped'; reason: string; details?: Record<string, unknown> };

function isFinalAttempt(job: Job): boolean;
function getJobAttemptContext(job: Job): {
  attemptsMade: number;
  maxAttempts: number;
  isFinalAttempt: boolean;
};
```

Permanent errors dùng trực tiếp `UnrecoverableError` của BullMQ. Không tạo
hierarchy error riêng nếu nó chỉ wrap lại class có sẵn.

Mỗi worker tự gắn:

```ts
worker.on('error', (error) => {
  logger.error('[SYS:BullMQ] Worker error', {
    worker: 'REPORT_QUEUE',
    error: error.message,
    stack: error.stack
  });
});
```

Không tạo `registerWorkerEvents(worker, config)` trong phase này. Ba listener
rõ ràng tại ba file dễ đọc và tránh che domain-specific metadata.

## Error decision table

| Tình huống | Processor action | BullMQ state |
| --- | --- | --- |
| Side effect hoàn tất | return `succeeded` | completed |
| State đích đã tồn tại | return `skipped` | completed |
| Provider/DB tạm lỗi | throw `Error` | retry hoặc failed |
| Input/business state không thể phục hồi | throw `UnrecoverableError` | failed, không retry |
| Worker connection/internal event error | `worker.on('error')` log | không tự đổi job state |

`job.discard()` không còn là primitive ưu tiên cho permanent failure vì
`UnrecoverableError` thể hiện intent ngay tại throw site và phù hợp BullMQ v5.

## Transaction worker

### Bulk import

#### Durable checkpoint

Tận dụng `ImportBatch.processedCount` hiện có làm offset của item tiếp theo.
Không thêm collection checkpoint riêng.

Flow:

1. Load batch bằng `importBatchId`.
2. Missing batch: throw `UnrecoverableError`.
3. `COMPLETED`: return skipped.
4. `FAILED`: throw `UnrecoverableError`; manual replay không thuộc feature này.
5. Chuyển `PENDING` sang `PROCESSING` bằng conditional update.
6. Bắt đầu loop từ `processedCount`.
7. Với từng chunk:
   - validate rows;
   - insert rows;
   - persist absolute `processedCount` và `rejectedCount`;
   - emit progress.
8. Sau chunk cuối, set `COMPLETED`, `terminalAt`, cleanup source array và emit
   completed.

Checkpoint được update sau khi insert. Để xử lý crash giữa insert và checkpoint,
row import cần durable identity.

#### Row identity

Mỗi row trong import batch được gắn stable `importIdentity`:

```text
importBatchId + sourceRowIndex
```

Đề xuất thêm optional fields vào transaction:

```ts
importBatchId?: ObjectId;
importRowIndex?: number;
```

và partial unique index:

```ts
{ importBatchId: 1, importRowIndex: 1 } unique
```

Bulk write dùng unordered insert/upsert semantics và coi duplicate identity là
row đã xử lý. Cách này bảo vệ cả trường hợp crash sau insert nhưng trước
checkpoint.

Không dùng hash toàn bộ row làm identity vì hai dòng giống nhau trong cùng file
có thể là input hợp lệ.

#### Final failure

Handler catch chỉ log và rethrow retryable error. `failed` listener kiểm tra
final attempt trước khi:

- set batch `FAILED` và `terminalAt`;
- emit `bulk-import:failed`.

Không set `FAILED` ở attempt đầu tiên.

### Recurring transaction

#### Occurrence identity

Occurrence date là giá trị `source.nextRecurringDate` được đọc trước khi tạo
child. Unique constraint:

```ts
transactionSchema.index(
  { recurringSourceId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recurringSourceId: { $type: 'objectId' }
    }
  }
);
```

#### Atomic processing

Repository methods cần optional `ClientSession`. Với mỗi source transaction:

1. Re-read source trong session.
2. Nếu source không còn recurring hoặc occurrence đã advance, kiểm tra child:
   - child tồn tại: skipped;
   - source bị disable/deleted: skipped với reason rõ ràng.
3. Insert child với `recurringSourceId` và occurrence date.
4. Update source bằng conditional filter gồm `_id`, `userId`,
   `nextRecurringDate: occurrenceDate`.
5. Commit transaction.

Nếu duplicate-key xảy ra vì concurrent/replayed worker:

- kiểm tra child cùng identity;
- nếu tồn tại, bảo đảm source đã advance hoặc thực hiện conditional advance;
- coi occurrence là skipped/completed.

Không query toàn bộ due transactions rồi filter trong handler. Handler nên load
đúng IDs và xác minh current state để giảm race window.

## Report worker

### Delivery identity

Thêm vào report history:

```ts
settingId: ObjectId;
dueDate: Date;
deliveryKey: string;
providerMessageId?: string;
attemptCount: number;
lastError?: string;
```

Unique index:

```ts
{ deliveryKey: 1 } unique
```

Format:

```text
report/<settingId>/<dueDate-iso>
```

Format này đồng thời dùng cho:

- BullMQ `jobId` với prefix phù hợp;
- MongoDB `deliveryKey`;
- Resend `idempotencyKey`.

### Delivery state

Reuse `ReportStatusEnum`:

- `PENDING`: delivery record đã claim, chưa terminal.
- `SENT`: provider accepted email.
- `FAILED`: hết attempts hoặc permanent failure.
- `NO_ACTIVITY`: không có report data cần gửi.

Flow:

1. Validate user, setting và dueDate.
2. Upsert/claim report delivery bằng unique `deliveryKey`.
3. Nếu `SENT` hoặc `NO_ACTIVITY`: return skipped.
4. Generate report data.
5. Nếu không có activity: transactionally set `NO_ACTIVITY` và advance setting.
6. Nếu có email:
   - send với Resend idempotency key bằng `deliveryKey`;
   - update cùng report record thành `SENT`, lưu provider message ID;
   - advance setting trong MongoDB transaction.
7. Emit report list update sau durable state.

`nextReportDate` được advance đúng một lần khi delivery đạt `SENT`,
`NO_ACTIVITY` hoặc terminal `FAILED`. Một attempt failure còn retry chỉ cập
nhật attempt metadata và giữ nguyên lịch hiện tại.

Nếu send thành công nhưng worker crash trước DB update, retry gửi cùng key.
Resend trả lại cùng result trong cửa sổ idempotency thay vì gửi email mới.

### Failed attempts

- Mỗi attempt update `attemptCount` và sanitized `lastError` trên cùng record.
- Không emit terminal `FAILED` khi BullMQ còn retry.
- Final `failed` listener cập nhật record `FAILED` bằng delivery key và emit một
  terminal event.
- Permanent validation failure có thể set `FAILED` trước khi throw
  `UnrecoverableError`.

### Provider limitation

Resend idempotency key được giữ 24 giờ. Với cấu hình 3 attempts và backoff hiện
tại, retry bình thường nằm trong cửa sổ này. Replay thủ công sau 24 giờ phải đọc
MongoDB `SENT` state và skip trước khi gọi provider.

## Receipt worker

Receipt worker là compatibility path cho legacy BullMQ jobs. Flow scan mới vẫn
chạy trong `transaction.controller.ts` và không thuộc migration này.

Processor order:

1. Validate job data; thiếu cả `fileBuffer` và `imageUrl` là
   `UnrecoverableError`.
2. Nếu có `imageHash`, đọc receipt scan cache trước.
3. Cache hit hợp lệ:
   - emit `receipt:scan-completed` cho `job.id` hiện tại bằng cached result;
   - return skipped với `reason: 'cache-hit'`.
4. Cache miss:
   - reuse deterministic Cloudinary public ID;
   - gọi AI;
   - cache durable result trước khi emit success.
5. `NonReceiptImageError`: throw `UnrecoverableError`.
6. Provider/network error: throw `Error`.

Cache được ghi trước socket emit để replay sau crash thấy durable result và
không gọi AI/upload lại.

Socket event vẫn là at-least-once notification. Payload `jobId` là event
identity hiện có; client không được tạo transaction trực tiếp chỉ dựa trên việc
nhận event.

## Queue configuration

Giữ:

- `attempts: 3`
- exponential backoff
- `removeOnComplete`
- `removeOnFail`
- concurrency hiện tại

Không chỉnh `lockDuration`, `stalledInterval` hoặc `maxStalledCount` trong phase
này. Nếu verification cho thấy CPU-heavy image processing làm mất lock, tách
processor/sandbox hoặc điều chỉnh lock sẽ là thay đổi riêng dựa trên metrics.

## Data migration

### Transaction indexes

- Thêm partial unique index cho recurring occurrence.
- Thêm optional import identity fields và partial unique index.
- Trước khi tạo unique index, chạy audit query để phát hiện duplicate hiện có.
- Nếu có duplicate, migration phải report và dừng; không tự xóa dữ liệu tài
  chính.

### Report delivery fields

- Fields mới optional để report history cũ vẫn đọc được.
- Unique index chỉ áp dụng document có `deliveryKey`.
- Scheduled report mới bắt buộc có delivery key.
- Resend API/manual report history cũ không bị ép vào scheduled delivery
  identity.

Không cần ADR vì đây là hardening của pattern hiện có, không thay kiến trúc nền
tảng hoặc provider.

## Logging

Shared metadata:

```ts
{
  queueName,
  jobId,
  jobName,
  attemptsMade,
  maxAttempts,
  correlationId,
  domainKey
}
```

Error message được sanitize. Không persist stack vào business model; stack chỉ
đi vào server logs.

## Testing strategy

### Shared behavior

- `isFinalAttempt` đúng với attempts hiện tại.
- Mỗi worker có `error` listener.
- Permanent error không retry.
- Retryable error vẫn theo exponential backoff.

### Bulk import

- missing batch -> unrecoverable failed.
- completed batch replay -> skipped.
- failure sau chunk 1 -> retry bắt đầu từ checkpoint.
- crash simulation sau insert trước checkpoint -> unique row identity không
  tạo duplicate.
- terminal FAILED chỉ xảy ra ở final attempt.

### Recurring

- cùng occurrence chạy tuần tự hai lần -> một child.
- hai execution concurrent -> một child.
- child insert và source advance cùng session.
- source disabled/deleted trước execution -> skipped.
- duplicate-key replay được chuyển thành no-op có kiểm chứng.

### Report

- cron enqueue cùng setting/dueDate -> một job.
- processor replay -> một delivery record.
- provider được gọi lại với cùng idempotency key.
- simulated crash sau provider success -> retry không tạo email thứ hai trong
  provider contract mock.
- attempt failure không tạo nhiều FAILED records.
- final failure cập nhật một record và emit một terminal event.

### Receipt legacy

- cache hit không gọi AI/Cloudinary.
- non-receipt -> unrecoverable, không retry.
- transient provider error -> retry.
- success cache được ghi trước socket emit.
- replay sau socket failure dùng cache.

## Risks và mitigations

| Risk | Mitigation |
| --- | --- |
| Unique index gặp duplicate dữ liệu cũ | Audit và fail migration, không tự xóa |
| Bulk rows giống nhau hợp lệ | Identity theo row index, không theo content hash |
| Resend key hết hạn sau 24 giờ | MongoDB `SENT` check trước provider call |
| Crash giữa DB và socket | DB là source of truth; socket best-effort |
| Concurrent recurring workers | Unique index + conditional source update |
| Scope phình thành framework | Chỉ shared type/helper nhỏ; domain logic ở worker |

## Alternatives đã cân nhắc

### Chỉ sửa return/throw và thêm error listener

Nhỏ nhất nhưng không giải quyết duplicate email, recurring child hoặc partial
bulk import. Không chọn.

### Framework `createReliableWorker`

Giảm boilerplate nhưng không giải quyết transaction boundary riêng của từng
domain và tạo abstraction sớm khi mới có ba worker. Không chọn.

### Generic idempotency collection cho mọi job

Cho một API thống nhất nhưng duplicate state với `ImportBatch`, `Report` và
`Transaction`, đồng thời khó đặt commit atomically với domain writes. Không
chọn.

### Domain-owned idempotency + shared primitives nhỏ

Được chọn vì unique constraint và checkpoint nằm ngay cạnh business state,
transaction boundary rõ và thay đổi có thể triển khai theo từng vertical slice.

## Tài liệu tham chiếu

- BullMQ Workers: https://docs.bullmq.io/guide/workers
- BullMQ Idempotent Jobs: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ Stop Retrying Jobs:
  https://docs.bullmq.io/patterns/stop-retrying-jobs
- BullMQ Stalled Jobs: https://docs.bullmq.io/guide/workers/stalled-jobs
- Resend Idempotency Keys:
  https://resend.com/docs/dashboard/emails/idempotency-keys
