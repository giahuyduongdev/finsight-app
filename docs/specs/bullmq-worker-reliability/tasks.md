# BullMQ Worker Reliability - Tasks

## Implementation strategy

Triển khai theo vertical slice để mỗi domain có test bảo vệ trước khi chuyển
sang domain tiếp theo. Shared primitives chỉ được thêm khi slice đầu tiên chứng
minh cần dùng chung.

## Phase 0 - Safety và baseline

- [ ] Tạo branch `enhancement/bullmq-worker-reliability`.
- [ ] Chạy baseline unit tests cho transaction, report, receipt và BullMQ
  backoff.
- [ ] Ghi nhận schema indexes hiện có trong MongoDB test environment.
- [ ] Audit dữ liệu duplicate recurring occurrence và import identity trước khi
  tạo unique indexes.
- [ ] Xác nhận Resend SDK hiện tại hỗ trợ option `idempotencyKey`.

## Phase 1 - Shared reliability semantics

- [ ] Thêm `JobOutcome` type.
- [ ] Thêm helper `isFinalAttempt`/attempt context.
- [ ] Thêm `worker.on('error')` cho transaction worker.
- [ ] Thêm `worker.on('error')` cho report worker.
- [ ] Thêm `worker.on('error')` cho receipt worker.
- [ ] Chuẩn hóa log metadata cho success, skipped, retrying, final failure và
  worker error.
- [ ] Thêm unit tests cho helper và worker error listeners.
- [ ] Thay permanent error phù hợp bằng BullMQ `UnrecoverableError`.
- [ ] Không thêm manual `ack`, `moveToCompleted` hoặc lock manipulation.

## Phase 2 - Bulk import reliability

- [ ] Thêm optional `importBatchId` và `importRowIndex` vào transaction model.
- [ ] Thêm partial unique index cho `{ importBatchId, importRowIndex }`.
- [ ] Cập nhật DTO/internal type của bulk rows với stable source row index.
- [ ] Mở rộng import batch repository cho conditional status transition.
- [ ] Dùng `processedCount` làm durable resume offset.
- [ ] Persist progress sau mỗi chunk đã xử lý.
- [ ] Chuyển duplicate import row thành verified no-op.
- [ ] Missing batch phải throw `UnrecoverableError`.
- [ ] Completed batch replay phải return `skipped`.
- [ ] Không set batch `FAILED` trong handler ở attempt chưa cuối.
- [ ] Final failed listener set `FAILED`, `terminalAt` và emit failure một lần.
- [ ] Chỉ cleanup `transactions` array sau terminal success.
- [ ] Test resume sau chunk failure.
- [ ] Test crash window sau insert trước checkpoint.
- [ ] Test completed replay và missing batch.
- [ ] Test failure notification chỉ xuất hiện ở final attempt.

## Phase 3 - Recurring transaction reliability

- [ ] Thêm partial unique index cho
  `{ recurringSourceId, date }`.
- [ ] Mở rộng transaction repository methods để nhận optional MongoDB session.
- [ ] Thêm repository query lấy đúng recurring sources theo IDs và user.
- [ ] Re-read source state trong transaction trước khi tạo occurrence.
- [ ] Tạo child và conditional advance source trong cùng session.
- [ ] Xử lý duplicate-key bằng verification, không swallow mọi DB error.
- [ ] Return skipped khi occurrence đã tồn tại hoặc source không còn active.
- [ ] Giữ poison-pill behavior chỉ cho terminal failure đã xác định.
- [ ] Test sequential replay tạo một child.
- [ ] Test concurrent execution tạo một child.
- [ ] Test transaction rollback không để child/source state lệch nhau.
- [ ] Test source disabled/deleted trước execution.

## Phase 4 - Report delivery reliability

- [ ] Thêm `settingId`, `dueDate`, `deliveryKey`, `providerMessageId`,
  `attemptCount`, `lastError` vào report model dưới dạng backward-compatible.
- [ ] Thêm partial unique index cho `deliveryKey`.
- [ ] Chuẩn hóa builder cho report delivery key từ `settingId + dueDate`.
- [ ] Dùng cùng identity cho queue `jobId`, MongoDB delivery và Resend
  idempotency key.
- [ ] Upsert/claim một report delivery record trước side effect.
- [ ] Replay terminal `SENT`/`NO_ACTIVITY` phải return skipped.
- [ ] Gửi email bằng stable Resend idempotency key.
- [ ] Lưu provider message ID khi có.
- [ ] Update cùng delivery record khi attempt fail; không tạo FAILED record mới.
- [ ] Advance `nextReportDate` đúng một lần trong transaction với terminal state.
- [ ] Chỉ emit terminal FAILED ở final attempt/permanent failure.
- [ ] Cập nhật report lifecycle socket behavior/spec liên quan nếu semantics
  `FAILED` thay đổi.
- [ ] Test one delivery record cho nhiều attempts.
- [ ] Test provider nhận cùng idempotency key khi retry.
- [ ] Test simulated crash sau provider success.
- [ ] Test manual replay sau terminal SENT không gọi provider.
- [ ] Test final FAILED event chỉ emit một lần.

## Phase 5 - Receipt legacy worker reliability

- [ ] Xác nhận queue chỉ còn phục vụ legacy jobs và ghi comment rõ tại boundary.
- [ ] Đọc cache trước AI/Cloudinary khi có `imageHash`.
- [ ] Cache hit return skipped/success mà không gọi providers.
- [ ] Ghi cache trước khi emit success socket event.
- [ ] Thay `job.discard()` + generic throw cho non-receipt bằng
  `UnrecoverableError`.
- [ ] Missing payload phải là permanent failure.
- [ ] Giữ transient network/provider failure là retryable.
- [ ] Bảo đảm log không chứa base64 hoặc extracted financial data.
- [ ] Test cache hit, cache corruption, non-receipt và transient failure.
- [ ] Test replay sau socket emit failure dùng cache.

## Phase 6 - Integration và migration verification

- [ ] Thêm migration/index bootstrap có preflight duplicate audit.
- [ ] Migration fail an toàn nếu phát hiện duplicate financial records.
- [ ] Verify report history cũ không có `deliveryKey` vẫn query bình thường.
- [ ] Verify transaction cũ không có import identity vẫn query bình thường.
- [ ] Integration test stalled/replayed bulk import.
- [ ] Integration test stalled/replayed recurring occurrence.
- [ ] Integration test stalled/replayed report delivery.
- [ ] Verify Bull Board hiển thị completed skipped và failed permanent hợp lý.
- [ ] Verify graceful shutdown không tạo false terminal failure.

## Dependencies và execution order

1. Phase 0 phải hoàn tất trước mọi schema/index change.
2. Phase 1 cung cấp semantics dùng cho các phase domain.
3. Phase 2, 3 và 4 là ba workstream domain; số phase không tạo dependency giữa
   chúng. Ưu tiên report sau shared semantics vì duplicate email là side effect
   ngoài hệ thống có impact cao.
4. Phase 5 độc lập về schema nhưng dùng shared semantics từ Phase 1.
5. Phase 6 chạy sau khi tất cả domain slices hoàn tất.

Thứ tự triển khai khuyến nghị:

```text
Shared semantics
  -> Report
  -> Recurring transaction
  -> Bulk import
  -> Receipt legacy
  -> Full integration verification
```

Lý do: report có external side effect khó rollback nhất; recurring có financial
duplicate risk; bulk import đã có batch identity/checkpoint fields sẵn một phần;
receipt worker là legacy path.

## Validation checklist

- [ ] Relevant unit tests pass.
- [ ] BullMQ integration tests pass.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Build passes.
- [ ] Unique-index duplicate audit passes.
- [ ] Acceptance criteria verified.
- [ ] Retryable/permanent/no-op cases verified.
- [ ] Stalled/replay cases verified.
- [ ] Logs được kiểm tra không lộ PII hoặc receipt payload.
- [ ] Existing public API contracts unchanged.
- [ ] `requirements.md`, `design.md` và `sequence.mmd` cập nhật đúng implementation.
- [ ] Security review hoàn tất cho provider idempotency key và logged metadata.
- [ ] Dùng `finishing-a-development-branch` trước merge/PR.

## Không làm trong implementation này

- Không tạo generic worker framework.
- Không đổi queue technology.
- Không cấu hình exactly-once claim ở Redis dùng chung cho mọi domain.
- Không migrate receipt controller background task vào queue.
- Không tự động xóa duplicate transaction/report cũ.
- Không thay đổi retry count/concurrency chỉ để đồng nhất code.
