# Ubiquitous Language

Glossary chuẩn cho BullMQ worker reliability.

## Mục lục

- [Queue execution](#queue-execution)
- [Reliability outcomes](#reliability-outcomes)
- [Bulk import](#bulk-import)
- [Recurring transactions](#recurring-transactions)
- [Report delivery](#report-delivery)
- [Receipt scanning](#receipt-scanning)
- [Notifications and state](#notifications-and-state)
- [Relationships](#relationships)
- [Example dialogue](#example-dialogue)
- [Flagged ambiguities](#flagged-ambiguities)

---

## Queue execution

### Job

Một đơn vị công việc được BullMQ lưu và giao cho đúng một worker processor tại
một thời điểm.

> Tránh dùng: message, task, queue item.

### Job Attempt

Một lần processor thực thi một **Job**, bao gồm lần đầu và mỗi lần retry.

> Tránh dùng: run, execution, try.

### Retry

Một **Job Attempt** mới do BullMQ lên lịch sau một **Retryable Failure**.

> Tránh dùng: replay, rerun.

### Replay

Việc cùng business work được thực thi lại do stalled recovery, duplicate
enqueue hoặc thao tác chủ động.

> Tránh dùng: retry.

### Final Attempt

**Job Attempt** cuối cùng được phép bởi cấu hình attempts của job.

> Tránh dùng: last retry.

### Completed Job

Một **Job** có processor đã resolve hoặc return, bất kể outcome là succeeded hay
skipped.

> Tránh dùng: acknowledged job, successful job.

### Failed Job

Một **Job** có processor đã throw và không còn retry được lên lịch.

> Tránh dùng: failed attempt, rejected job.

### Stalled Job

Một **Job** mất active lock trước khi worker hoàn tất và có thể được BullMQ giao
lại.

> Tránh dùng: timed-out job, crashed job.

### Queue Deduplication

Cơ chế dùng stable `jobId` để ngăn cùng queue giữ nhiều job có cùng queue
identity.

> Tránh dùng: idempotency, exactly-once.

### Auto-completion

Cơ chế BullMQ tự chuyển job sang completed khi processor resolve và sang
failed/retry khi processor throw.

> Tránh dùng: auto-ack.

---

## Reliability outcomes

### Job Outcome

Kết quả nghiệp vụ có cấu trúc mà processor trả về khi job được completed.

> Tránh dùng: result, response.

### Succeeded Outcome

**Job Outcome** cho biết side effect chính cần thiết đã hoàn tất.

> Tránh dùng: completed, success job.

### Skipped Outcome

**Job Outcome** cho biết business state đã đúng hoặc công việc không còn cần
thiết.

> Tránh dùng: failed success, ignored, no-op return.

### Business No-op

Một execution không tạo thay đổi vì business state đích đã tồn tại hoặc không
còn áp dụng.

> Tránh dùng: silent success, ignored error.

### Retryable Failure

Một lỗi tạm thời có khả năng thành công ở **Job Attempt** sau với cùng input.

> Tránh dùng: transient error, retry error.

### Permanent Failure

Một lỗi không thể thành công khi retry với cùng input và business state hiện
tại.

> Tránh dùng: fatal error, unrecoverable condition.

### Terminal Failure

Trạng thái failure cuối cùng sau permanent failure hoặc sau khi đã hết attempts.

> Tránh dùng: failed attempt, final retry.

### Business Idempotency

Thuộc tính bảo đảm nhiều execution của cùng business work không tạo thêm side
effect chính.

> Tránh dùng: queue deduplication, exactly-once.

### Business Identity

Khóa ổn định xác định một business work duy nhất xuyên suốt enqueue, retry và
replay.

> Tránh dùng: job ID, dedup key.

### Commit Point

Thời điểm durable business state đủ để replay nhận ra công việc đã hoàn tất.

> Tránh dùng: job completion, socket emit.

### Primary Side Effect

Thay đổi nghiệp vụ cần được bảo vệ khỏi duplicate, như tạo transaction hoặc gửi
report email.

> Tránh dùng: main action.

### Secondary Side Effect

Thay đổi phụ có thể retry hoặc bỏ qua độc lập, như cache invalidation và socket
notification.

> Tránh dùng: best-effort action.

---

## Bulk import

### Import Batch

Một yêu cầu nhập nhiều financial transactions có chung lifecycle và progress.

> Tránh dùng: bulk job, import job.

### Import Row

Một dòng input tại vị trí ổn định trong một **Import Batch**.

> Tránh dùng: transaction row, item.

### Import Row Identity

Khóa `importBatchId + sourceRowIndex` xác định duy nhất một **Import Row**, kể cả
khi nội dung hai dòng giống nhau.

> Tránh dùng: row hash, transaction identity.

### Import Checkpoint

Durable offset và counters ghi nhận phần **Import Batch** đã hoàn tất.

> Tránh dùng: progress, processed count.

### Resumed Import

Một **Import Batch** tiếp tục từ **Import Checkpoint** cuối thay vì xử lý lại từ
đầu.

> Tránh dùng: retried import, restarted import.

---

## Recurring transactions

### Recurring Source

Financial transaction mẫu chứa lịch và dữ liệu để tạo các occurrences trong
tương lai.

> Tránh dùng: parent transaction, recurring transaction.

### Occurrence

Một lần phát sinh theo lịch của một **Recurring Source** tại một occurrence date
cụ thể.

> Tránh dùng: recurring job, cycle.

### Occurrence Date

Thời điểm nghiệp vụ xác định duy nhất một **Occurrence** của **Recurring
Source**.

> Tránh dùng: run date, processing date.

### Recurring Child

Financial transaction được tạo để biểu diễn đúng một **Occurrence**.

> Tránh dùng: child transaction, generated transaction.

### Occurrence Identity

Khóa `recurringSourceId + occurrenceDate` xác định duy nhất một **Recurring
Child**.

> Tránh dùng: recurring key, child key.

---

## Report delivery

### Report Setting

Cấu hình của user xác định report frequency, trạng thái bật và due date kế tiếp.

> Tránh dùng: report schedule, report config.

### Scheduled Report Delivery

Một lần tạo và gửi report đến hạn cho đúng một **Report Setting**.

> Tránh dùng: report job, generated report.

### Delivery Key

Khóa `settingId + dueDate` xác định duy nhất một **Scheduled Report Delivery**.

> Tránh dùng: job ID, report key.

### Delivery Record

Durable report history document lưu lifecycle của một **Scheduled Report
Delivery**.

> Tránh dùng: report, failed record.

### Report Content

Dữ liệu tài chính và insights được tạo để đưa vào email report.

> Tránh dùng: report record, delivery.

### Provider Idempotency Key

Stable key gửi cho email provider để cùng delivery request không tạo thêm email
trong provider window.

> Tránh dùng: delivery key, job ID.

### Provider Message ID

Định danh email do provider trả về sau khi nhận delivery request.

> Tránh dùng: report ID, delivery ID.

### Due Date

Thời điểm một **Scheduled Report Delivery** phải được xử lý theo timezone của
user.

> Tránh dùng: send date, scheduled date.

---

## Receipt scanning

### Receipt Scan Request

Yêu cầu phân tích một receipt image của user và trả về extracted receipt data.

> Tránh dùng: receipt job, scan.

### Receipt Scan Identity

Khóa `userId + imageHash` xác định cùng một receipt image của cùng một user.

> Tránh dùng: image key, job ID.

### Receipt Scan Result

Durable extracted receipt data cùng receipt image URL của một scan hợp lệ.

> Tránh dùng: AI result, receipt data.

### Receipt Scan Cache

Redis state lưu một **Receipt Scan Result** theo **Receipt Scan Identity**.

> Tránh dùng: result cache, job cache.

### Legacy Receipt Job

BullMQ job cũ thực hiện receipt scanning, khác với background flow hiện chạy
trong API process.

> Tránh dùng: receipt worker flow, current receipt job.

### Non-receipt Image

Image được xác định không chứa receipt hợp lệ và không thể thành công khi retry
với cùng input.

> Tránh dùng: invalid receipt, AI failure.

---

## Notifications and state

### Domain Notification

Socket event thông báo một durable business state đã thay đổi.

> Tránh dùng: commit event, completion signal.

### Terminal Notification

**Domain Notification** chỉ được phát khi business work đạt terminal success
hoặc terminal failure.

> Tránh dùng: failed-attempt event, final socket.

### Durable State

Business state đã được persist và còn tồn tại sau worker crash hoặc process
restart.

> Tránh dùng: cache state, in-memory state.

---

## Relationships

- Một **Job** có một hoặc nhiều **Job Attempts**, nhưng chỉ có một terminal
  BullMQ state.
- Một **Retry** luôn tạo **Job Attempt** mới; một **Replay** có thể xảy ra ngoài
  retry policy.
- Một **Completed Job** có đúng một **Succeeded Outcome** hoặc **Skipped
  Outcome**.
- **Queue Deduplication** bảo vệ queue identity; **Business Idempotency** bảo vệ
  **Primary Side Effect**.
- Một **Import Batch** chứa nhiều **Import Rows** và có tối đa một **Import
  Checkpoint** hiện hành.
- Một **Import Row** có đúng một **Import Row Identity** trong phạm vi **Import
  Batch**.
- Một **Recurring Source** tạo không quá một **Recurring Child** cho mỗi
  **Occurrence Date**.
- Một **Report Setting** tạo nhiều **Scheduled Report Deliveries**, mỗi delivery
  có đúng một **Delivery Key**.
- Một **Scheduled Report Delivery** có đúng một **Delivery Record** và không quá
  một provider-visible email.
- Một **Receipt Scan Identity** có tối đa một cached **Receipt Scan Result**.
- Một **Domain Notification** chỉ được phát sau **Commit Point** và không phải
  là nguồn sự thật.

---

## Example dialogue

> **Dev:** Cron đã dùng `jobId`, vậy **Scheduled Report Delivery** đã idempotent
> chưa?

> **Domain expert:** Chưa. `jobId` chỉ cung cấp **Queue Deduplication**.
> **Business Idempotency** cần một **Delivery Key** trong MongoDB và cùng
> **Provider Idempotency Key** khi gửi email.

> **Dev:** Nếu worker crash sau khi provider nhận email nhưng trước khi job
> completed thì sao?

> **Domain expert:** BullMQ có thể **Replay** job. Worker đọc **Delivery Record**
> và dùng lại **Delivery Key**, nên không tạo thêm **Primary Side Effect**.

> **Dev:** Còn socket event?

> **Domain expert:** Đó là **Secondary Side Effect** và có thể bị lặp; **Durable
> State** mới là nguồn sự thật.

---

## Flagged ambiguities

### Ack và autoAck

Các từ này mang nghĩa RabbitMQ. Với BullMQ, dùng **Auto-completion**; không mô tả
processor `return` là manual ack.

### Completed

Từ này từng chỉ cả BullMQ state và business success.

- Dùng **Completed Job** cho queue state.
- Dùng **Succeeded Outcome** hoặc **Skipped Outcome** cho business result.

### Failed

Từ này từng chỉ cả attempt lỗi và trạng thái hết retry.

- Dùng **Retryable Failure** cho attempt còn retry.
- Dùng **Terminal Failure** cho kết quả cuối.

### Retry và replay

- **Retry** do BullMQ attempts policy tạo ra.
- **Replay** bao gồm stalled recovery và execution trùng.

### Idempotency key

Tên này đang chỉ ba lớp khác nhau.

- Dùng `jobId` cho **Queue Deduplication**.
- Dùng **Business Identity** cho domain.
- Dùng **Provider Idempotency Key** cho external provider.

### Transaction

Từ này có thể nghĩa là financial record hoặc MongoDB atomic unit.

- Dùng **Financial Transaction** cho dữ liệu người dùng.
- Dùng **MongoDB Transaction** cho database boundary.

### Recurring transaction

Từ này có thể nghĩa là template hoặc transaction được tạo.

- Dùng **Recurring Source** cho template.
- Dùng **Recurring Child** cho occurrence.

### Report

Từ này có thể nghĩa là generated content, history document hoặc scheduled send.

- Dùng **Report Content** cho nội dung.
- Dùng **Delivery Record** cho history document.
- Dùng **Scheduled Report Delivery** cho lần gửi theo lịch.

### Receipt job

Từ này có thể nghĩa là BullMQ compatibility path hoặc background task hiện tại.

- Dùng **Legacy Receipt Job** cho BullMQ.
- Dùng **Receipt Scan Request** cho business operation.

### Progress

Từ này không đủ chính xác cho resume safety.

- Dùng **Import Checkpoint** cho durable resume position.
- Chỉ dùng progress cho UI percentage.
