# BullMQ Worker Reliability - Tasks

## Implementation strategy

Triển khai theo vertical slice để mỗi domain có test bảo vệ trước khi chuyển
sang domain tiếp theo. Shared primitives chỉ được thêm khi slice đầu tiên chứng
minh cần dùng chung.

## Phase 0 - Safety và baseline

- [x] Tạo branch `enhancement/bullmq-worker-reliability`.
- [x] Chạy baseline unit tests cho transaction, report, receipt và BullMQ
  backoff.
- [x] Ghi nhận và test schema indexes hiện có trong model test environment.
- [ ] Audit dữ liệu duplicate recurring occurrence và import identity trước khi
  tạo unique indexes.
- [x] Xác nhận Resend SDK hiện tại hỗ trợ option `idempotencyKey`.

## Phase 1 - Shared reliability semantics

- [x] Thêm `JobOutcome` type.
- [x] Thêm helper `isFinalAttempt`/attempt context.
- [x] Thêm `worker.on('error')` cho transaction worker.
- [x] Thêm `worker.on('error')` cho report worker.
- [x] Thêm `worker.on('error')` cho receipt worker.
- [ ] Chuẩn hóa log metadata cho success, skipped, retrying, final failure và
  worker error.
- [x] Thêm unit tests cho helper và worker error listeners.
- [x] Thay permanent error phù hợp bằng BullMQ `UnrecoverableError`.
- [x] Không thêm manual `ack`, `moveToCompleted` hoặc lock manipulation.

## Phase 2 - Bulk import reliability

- [x] Thêm optional `importBatchId` và `importRowIndex` vào transaction model.
- [x] Thêm partial unique index cho `{ importBatchId, importRowIndex }`.
- [x] Cập nhật DTO/internal type của bulk rows với stable source row index.
- [x] Mở rộng import batch repository cho conditional status transition.
- [x] Dùng `processedCount` làm durable resume offset.
- [x] Persist progress sau mỗi chunk đã xử lý.
- [x] Chuyển duplicate import row thành verified no-op.
- [x] Missing batch phải throw `UnrecoverableError`.
- [x] Completed batch replay phải return `skipped`.
- [x] Không set batch `FAILED` trong handler ở attempt chưa cuối.
- [x] Final failed listener set `FAILED`, `terminalAt` và emit failure một lần.
- [x] Chỉ cleanup `transactions` array sau terminal success.
- [x] Test resume sau chunk failure.
- [x] Test crash window sau insert trước checkpoint.
- [x] Test completed replay và missing batch.
- [x] Test failure notification chỉ xuất hiện ở final attempt.

## Phase 3 - Recurring transaction reliability

- [x] Thêm partial unique index cho
  `{ recurringSourceId, date }`.
- [x] Mở rộng transaction repository methods để nhận optional MongoDB session.
- [x] Thêm query lấy đúng recurring sources theo IDs và user.
- [x] Re-read source state trong transaction trước khi tạo occurrence.
- [x] Tạo child và conditional advance source trong cùng session.
- [x] Xử lý duplicate-key bằng verification, không swallow mọi DB error.
- [x] Return skipped khi occurrence đã tồn tại hoặc source không còn active.
- [x] Giữ poison-pill behavior chỉ cho terminal failure đã xác định.
- [x] Test sequential replay tạo một child.
- [x] Test concurrent execution tạo một child.
- [x] Test transaction failure không báo success và luôn đóng session.
- [x] Test source disabled/deleted trước execution bằng no-due-source case.

## Phase 4 - Report delivery reliability

- [x] Thêm `settingId`, `dueDate`, `deliveryKey`, `providerMessageId`,
  `attemptCount`, `lastError` vào report model dưới dạng backward-compatible.
- [x] Thêm partial unique index cho `deliveryKey`.
- [x] Chuẩn hóa builder cho report delivery key từ `settingId + dueDate`.
- [x] Dùng cùng identity cho queue `jobId`, MongoDB delivery và Resend
  idempotency key.
- [x] Upsert/claim một report delivery record trước side effect.
- [x] Replay terminal `SENT`/`NO_ACTIVITY` phải return skipped.
- [x] Gửi email bằng stable Resend idempotency key.
- [x] Lưu provider message ID khi có.
- [x] Update cùng delivery record khi attempt fail; không tạo FAILED record mới.
- [x] Advance `nextReportDate` đúng một lần trong transaction với terminal state.
- [x] Chỉ emit terminal FAILED ở final attempt/permanent failure.
- [x] Cập nhật report lifecycle socket behavior/spec liên quan nếu semantics
  `FAILED` thay đổi.
- [x] Test one delivery record cho nhiều attempts.
- [x] Test provider nhận cùng idempotency key khi retry.
- [x] Test simulated crash sau provider success.
- [x] Test manual replay sau terminal SENT không gọi provider.
- [x] Test final FAILED event chỉ emit một lần.

## Phase 5 - Receipt legacy worker reliability

- [x] Xác nhận queue chỉ còn phục vụ legacy jobs và ghi comment rõ tại boundary.
- [x] Đọc cache trước AI/Cloudinary khi có `imageHash`.
- [x] Cache hit return skipped/success mà không gọi providers.
- [x] Ghi cache trước khi emit success socket event.
- [x] Thay `job.discard()` + generic throw cho non-receipt bằng
  `UnrecoverableError`.
- [x] Missing payload phải là permanent failure.
- [x] Giữ transient network/provider failure là retryable.
- [x] Bảo đảm log không chứa base64 hoặc extracted financial data.
- [x] Test cache hit, cache corruption, non-receipt và transient failure.
- [x] Test replay sau socket emit failure dùng cache.

## Phase 6 - Integration và migration verification

- [x] Thêm migration/index bootstrap có preflight duplicate audit.
- [x] Migration fail an toàn nếu phát hiện duplicate financial records.
- [x] Verify report history cũ không có `deliveryKey` vẫn query bình thường.
- [x] Verify transaction cũ không có import identity vẫn query bình thường.
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

- [x] Relevant unit tests pass.
- [x] BullMQ integration tests pass.
- [x] Lint passes.
- [x] Typecheck passes.
- [x] Build passes.
- [ ] Unique-index duplicate audit passes.
- [ ] Acceptance criteria verified.
- [x] Retryable/permanent/no-op cases verified.
- [x] Stalled/replay cases verified bằng crash-window và replay unit tests.
- [x] Logs được kiểm tra không lộ PII hoặc receipt payload.
- [x] Existing public API contracts unchanged.
- [x] `requirements.md`, `design.md` và `sequence.mmd` cập nhật đúng implementation.
- [x] Security review hoàn tất cho provider idempotency key và logged metadata.
- [ ] Dùng `finishing-a-development-branch` trước merge/PR.

## Không làm trong implementation này

- Không tạo generic worker framework.
- Không đổi queue technology.
- Không cấu hình exactly-once claim ở Redis dùng chung cho mọi domain.
- Không migrate receipt controller background task vào queue.
- Không tự động xóa duplicate transaction/report cũ.
- Không thay đổi retry count/concurrency chỉ để đồng nhất code.
