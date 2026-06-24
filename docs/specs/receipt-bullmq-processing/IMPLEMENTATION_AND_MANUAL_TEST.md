# Receipt BullMQ Processing — Tổng hợp triển khai và manual test

## 1. Mục đích

Tài liệu này trả lời ba câu hỏi:

1. Feature `receipt-bullmq-processing` đã thay đổi những gì?
2. Làm sao nhận biết từng phần đang hoạt động đúng?
3. Cần manual test như thế nào trước khi merge hoặc triển khai production?

## 2. Luồng đã triển khai

```text
Frontend
  -> POST /api/v1/transactions/scan-receipt
  -> Backend nén ảnh và tính image hash
  -> Kiểm tra Redis cache
  -> Upload/reuse ảnh trên Cloudinary
  -> Enqueue URL-only job vào RECEIPT_QUEUE
  -> Trả 202 + jobId
  -> Receipt Worker tải ảnh từ Cloudinary
  -> Gemini trích xuất dữ liệu
  -> Ghi cache trước
  -> Phát socket completion
  -> Frontend nhận kết quả bằng socket hoặc status polling
```

Commit point của intake là khi BullMQ enqueue thành công. API không trả `202`
nếu Cloudinary upload hoặc enqueue thất bại.

## 3. Những phần đã làm

### 3.1 Durable intake

- Tách orchestration ra `receipt-intake.service.ts`.
- Giữ validation JPEG, PNG, WebP và giới hạn 5 MiB.
- Nén ảnh trước khi hash/upload.
- Dùng identity ổn định từ `userId + imageHash`.
- Upload Cloudinary trước khi enqueue.
- Job mới chỉ lưu `imageUrl`, không lưu base64.
- Request trùng trả về cùng business job.
- Xóa đường chạy nền không được BullMQ quản lý.

### 3.2 Receipt Worker

- `concurrency=2` mặc định và đọc từ environment.
- Gemini limiter mặc định 10 job/phút.
- Retry tối đa 3 lần, exponential backoff bắt đầu từ 10 giây.
- Giới hạn thời gian xử lý Gemini.
- Download Cloudinary có timeout và giới hạn kích thước.
- Cache-first replay.
- Cache kết quả trước khi phát socket completion.
- Phân biệt transient failure, permanent failure và user non-receipt.
- Giữ legacy base64 payload tạm thời để xử lý job cũ.
- Completed/failed job retention là 24 giờ.

### 3.3 Status recovery phía frontend

- Thêm endpoint:

```text
GET /api/v1/transactions/scan-receipt/:jobId
```

- Kiểm tra ownership của job.
- Trả trạng thái bounded: `queued`, `active`, `delayed`, `completed`, `failed`.
- Không trả stack trace hoặc provider error thô.
- FE lưu pending job ID trong `sessionStorage`.
- FE polling lại sau refresh hoặc mất socket.
- Socket và polling được deduplicate để không xử lý kết quả hai lần.

### 3.4 Observability

- `/metrics` dùng một Prometheus registry chung.
- HTTP metrics dùng route template, không dùng raw ID path.
- BullMQ metrics cho queue depth, outcome, wait time và processing time.
- Provider metrics cho Gemini, Cloudinary và Resend.
- Receipt metrics cho scan outcome và cache outcome.
- Sentry capture cho terminal/infrastructure failure và circuit breaker open.
- Retry, cache miss và user non-receipt không tạo Sentry noise.
- Sentry scrub URL, token, API key, base64, filename và dữ liệu tài chính.

### 3.5 Monitoring

- Docker Compose profile `monitoring`.
- Prometheus scrape mỗi 30 giây, retention 7 ngày.
- Grafana datasource được provision tự động.
- Ba dashboard:
  - `Finsight Overview`;
  - `Finsight BullMQ`;
  - `Finsight Receipt`.
- Alert cho HTTP 5xx, BullMQ backlog/final failure, provider rate limit,
  circuit breaker, event-loop lag, memory và target down.

## 4. Khởi động môi trường manual test

### Backend

```powershell
cd backend
npm run dev
```

Backend mặc định:

```text
http://localhost:8000
```

Nếu thấy `EADDRINUSE`, đang có backend khác chiếm port `8000`. Dừng process cũ
trước khi chạy lại.

### Frontend

```powershell
cd client
npm run dev
```

### Monitoring

```powershell
docker compose --profile monitoring up -d
```

| Công cụ            | URL                                  |
| ------------------ | ------------------------------------ |
| Bull Board         | `http://localhost:8000/admin/queues` |
| Backend metrics    | `http://localhost:8000/metrics`      |
| Prometheus         | `http://localhost:9090`              |
| Prometheus targets | `http://localhost:9090/targets`      |
| Grafana            | `http://localhost:3000`              |

Grafana local mặc định dùng `admin/admin`, trừ khi `.env` đã cấu hình giá trị
khác hoặc volume Grafana đã lưu mật khẩu cũ.

## 5. Manual test chính

### MT-01 — Quét một hóa đơn mới

1. Đăng nhập ứng dụng.
2. Upload một hóa đơn chưa từng quét.
3. Mở Bull Board, chọn `RECEIPT_QUEUE`.

Kỳ vọng:

- API trả `202` cùng `jobId`.
- Job tên `scan-receipt`.
- Payload có `imageUrl`.
- Payload không có `fileBuffer`/base64.
- Job chuyển từ waiting/active sang completed.
- FE nhận và điền dữ liệu hóa đơn.
- Return value có `status: succeeded`.

### MT-02 — Cache hit

1. Quét lại đúng ảnh của MT-01 với cùng user.

Kỳ vọng:

- FE nhận kết quả nhanh hơn.
- Receipt cache metric có `hit`.
- Không có Gemini execution mới.
- Kết quả nghiệp vụ không bị tạo trùng.

### MT-03 — Duplicate intake đồng thời

1. Gửi cùng một ảnh nhiều lần gần như đồng thời.

Kỳ vọng:

- Stable job ID có dạng `receipt-scan-<userId>-<imageHash>`.
- Không có nhiều Gemini execution cho cùng identity.
- Các request trùng cùng đại diện một business job.

### MT-04 — Concurrency

1. Upload ít nhất sáu ảnh khác nhau trong thời gian ngắn.
2. Theo dõi Bull Board.

Kỳ vọng:

- Tối đa hai Receipt jobs ở trạng thái active.
- Job còn lại ở waiting/delayed.
- Job chờ tiếp tục chạy khi slot được giải phóng.

### MT-05 — Restart recovery

1. Tắt Receipt Worker hoặc backend.
2. Enqueue/giữ một job ở waiting.
3. Khởi động worker lại.

Kỳ vọng:

- Job waiting không mất.
- Worker mới tiếp tục xử lý job.

### MT-06 — Refresh hoặc mất socket

1. Upload ảnh.
2. Refresh trang khi job đang xử lý.

Kỳ vọng:

- `sessionStorage` có `finsight:pending-receipt-job`.
- FE gọi status endpoint.
- Kết quả vẫn được điền khi job completed.
- Socket và polling cùng trả kết quả cũng chỉ hoàn tất một lần.

### MT-07 — Ảnh không phải hóa đơn

1. Upload ảnh hợp lệ về định dạng nhưng không phải hóa đơn.

Kỳ vọng:

- Job permanent failure, không retry vô ích.
- FE nhận thông báo dễ hiểu.
- Không tạo Sentry event cho lỗi người dùng dự kiến này.

### MT-08 — Cloudinary failure

1. Dùng credential Cloudinary test không hợp lệ.
2. Restart backend và upload ảnh mới.

Kỳ vọng:

- Không enqueue Receipt job.
- API không trả `202`.
- Gemini không được gọi.

Khôi phục credential ngay sau test.

### MT-09 — Feature flags

Với:

```env
RECEIPT_QUEUE_INTAKE_ENABLED=false
```

API scan phải trả `503`.

Với:

```env
RECEIPT_WORKER_ENABLED=false
```

Job có thể ở waiting nhưng không được worker xử lý. Khi bật worker lại và
restart, job phải tiếp tục chạy.

### MT-10 — Validation

Thử:

- PDF;
- file lớn hơn 5 MiB;
- file có extension/MIME không hợp lệ;
- JPEG, PNG, WebP hợp lệ.

Kỳ vọng chỉ các ảnh hợp lệ trong giới hạn được intake.

## 6. Manual test metrics và dashboard

### Prometheus

Mở `/metrics` và tìm:

```text
finsight_receipt_scans_total
finsight_receipt_cache_total
finsight_bullmq_queue_jobs
finsight_bullmq_jobs_total
finsight_bullmq_job_wait_seconds
finsight_bullmq_job_processing_seconds
finsight_provider_requests_total
finsight_provider_request_duration_seconds
finsight_circuit_breaker_transitions_total
```

Kỳ vọng metric labels không chứa user ID, email, job ID, image hash, filename,
raw URL hoặc dữ liệu tài chính.

### Grafana Receipt dashboard

Sau một ảnh mới:

- `accepted` và `succeeded` xuất hiện;
- cache `miss` tăng;
- Gemini có `success`;
- processing p95 có dữ liệu sau khi Prometheus scrape.

Sau khi quét lại cùng ảnh:

- cache `hit` tăng;
- không có Gemini success mới cho cache hit.

Dashboard hiện dùng `rate(...[5m])`, vì vậy đường biểu diễn phản ánh tốc độ
trong cửa sổ năm phút, không phải tổng lịch sử. Khi không có event mới, đường
giảm về 0 dù counter gốc vẫn còn. Counter trong backend reset khi backend
restart; Prometheus chỉ lưu dữ liệu từ lúc nó bắt đầu scrape.

Histogram p95 ít mẫu có thể nội suy gần bucket lớn hơn thời gian job thực tế.
Đối chiếu thời gian chính xác của một job bằng Bull Board.

## 7. Phân vai công cụ

| Công cụ                  | Dùng để trả lời                                         |
| ------------------------ | ------------------------------------------------------- |
| Bull Board               | Job cụ thể đang waiting/active/completed/failed vì sao? |
| Prometheus               | Số liệu thay đổi theo thời gian như thế nào?            |
| Grafana                  | Dashboard, xu hướng và cảnh báo là gì?                  |
| Sentry                   | Exception/stack trace bất ngờ nằm ở đâu?                |
| Structured logs          | Chuỗi sự kiện chi tiết trong application là gì?         |
| Node Exporter, phase sau | Toàn VPS đang dùng CPU/RAM/disk/network ra sao?         |

## 8. Những phần chưa được production-verify

- Quota Gemini thực tế của project/key.
- Load test bằng quota provider thật.
- Tuning limiter 5/10/15 jobs mỗi phút.
- Network private cho `/metrics`, Prometheus, Grafana và Bull Board.
- Backup MongoDB và Redis persistence trên VPS.
- Node Exporter cho host metrics.
- Tách API và worker thành container production riêng.

Các mục này vẫn phải được kiểm tra tại môi trường deployment, không thể kết
luận chỉ bằng localhost/unit tests.

## 9. Verification tự động đã chạy

- Backend lint và typecheck.
- Client lint và typecheck.
- Backend unit tests.
- Client tests.
- Redis/BullMQ integration cho duplicate, concurrency và restart recovery.
- Backend và client production build.
- OpenAPI validation.
- Prometheus target scrape thực tế.
- Grafana dashboard provisioning.
- Security/privacy review.
