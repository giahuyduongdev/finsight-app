# Quyết định cuối cùng — Receipt BullMQ Processing

## Trạng thái

Tài liệu này là nguồn quyết định chính thức cho feature Receipt BullMQ.

Các mục bên dưới đã được chốt để bắt đầu triển khai. Không cần hỏi lại trừ khi
phát hiện ràng buộc kỹ thuật mới hoặc người dùng chủ động thay đổi quyết định.

## 1. Phạm vi feature

### Đã chốt

- Mọi lượt quét receipt mới từ FE phải đi qua `RECEIPT_QUEUE`.
- Xóa luồng chạy Promise nền trực tiếp trong API sau khi queue flow được xác
  minh.
- Giữ trải nghiệm bất đồng bộ:
  - API trả `202 Accepted`;
  - FE nhận `jobId`;
  - kết quả được thông báo qua Socket.IO;
  - FE có thể hỏi lại trạng thái khi reload hoặc mất socket.
- Không xây framework worker tổng quát.
- Không thay BullMQ, Cloudinary hoặc Gemini.

## 2. Luồng xử lý

### Đã chốt

```text
FE upload ảnh
  -> API xác thực user
  -> validate MIME và kích thước
  -> Sharp nén ảnh
  -> tính imageHash
  -> kiểm tra Redis cache
  -> upload hoặc reuse Cloudinary asset
  -> enqueue URL-only job
  -> trả 202 + jobId
  -> Receipt Worker tải ảnh
  -> gọi Gemini
  -> validate kết quả
  -> ghi cache
  -> emit Socket.IO completion
```

API chỉ được trả `202` sau khi `queue.add()` thành công.

## 3. Nơi lưu ảnh

### Đã chốt

- Upload Cloudinary trước khi enqueue.
- BullMQ job mới chỉ lưu `imageUrl`.
- Không lưu base64 trong Redis cho job mới.
- Cloudinary public ID phải ổn định theo user và image hash.
- Legacy job có base64 vẫn được hỗ trợ tạm thời trong giai đoạn migration.
- Xóa legacy base64 branch sau khi hết queue retention window.

## 4. Job identity và chống trùng

### Đã chốt

Business identity:

```text
userId + imageHash
```

Identity này dùng cho:

- stable BullMQ `jobId`;
- queue deduplication;
- Redis result cache;
- deterministic Cloudinary public ID.

Hai request đồng thời của cùng user và cùng ảnh phải nhận cùng business job,
không tạo hai Gemini calls.

Cùng ảnh nhưng khác user vẫn là hai jobs riêng.

## 5. Concurrency

### Đã chốt

```env
RECEIPT_WORKER_CONCURRENCY=2
```

- Localhost: một worker instance, concurrency `2`.
- VPS 2 shared vCPU / 8 GB RAM: một worker instance, concurrency `2`.
- Không tăng trên `2` nếu chưa review capacity.
- Chỉ giảm xuống `1` nếu metrics cho thấy CPU, event-loop hoặc provider bị quá
  tải.

Công thức:

```text
tổng active receipt jobs =
  số worker instances × concurrency mỗi worker
```

## 6. Worker topology

### Đã chốt

#### Localhost

- API và workers chạy trong cùng backend process như kiến trúc hiện tại.

#### Production VPS giai đoạn đầu

- Dùng Docker Compose.
- Tách thành hai containers/processes:
  - `backend-api`;
  - `backend-worker`.
- API process đặt:

```env
RECEIPT_WORKER_ENABLED=false
```

- Worker process đặt:

```env
RECEIPT_WORKER_ENABLED=true
```

Lý do: deploy/restart API không làm gián đoạn worker và không vô tình nhân
concurrency khi scale API.

## 7. Retry, backoff và timeout

### Đã chốt

```env
RECEIPT_MAX_ATTEMPTS=3
RECEIPT_BACKOFF_DELAY_MS=10000
RECEIPT_DOWNLOAD_TIMEOUT_MS=10000
RECEIPT_PROCESSING_TIMEOUT_MS=60000
```

- BullMQ dùng exponential backoff.
- `429`, `503`, `504`, provider timeout và network failure là retryable.
- Ảnh không phải hóa đơn, thiếu payload hoặc payload không hợp lệ là permanent
  failure.
- Permanent failure dùng `UnrecoverableError`.
- Failure socket event chỉ được emit khi:
  - permanent failure; hoặc
  - final attempt đã thất bại.

## 8. Gemini rate limiter

### Đã chốt

Rate limiter phải cấu hình qua `.env` và áp dụng global cho `RECEIPT_QUEUE`.

Giá trị mặc định để phát triển và chạy thử:

```env
RECEIPT_AI_RATE_LIMIT_MAX=10
RECEIPT_AI_RATE_LIMIT_DURATION_MS=60000
```

Nghĩa là tối đa 10 Receipt Worker jobs bắt đầu xử lý trong một phút trên toàn
queue.

Trước production phải đối chiếu quota Gemini thực tế:

- nếu quota thấp hơn 10 RPM thì giảm cấu hình;
- nếu quota cao hơn vẫn giữ 10 RPM ở lần deploy đầu;
- chỉ tăng sau khi metrics ổn định.

Việc xác minh quota là deployment check, không phải câu hỏi thiết kế còn mở.

## 9. Cache và thời gian lưu kết quả

### Đã chốt

```env
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
```

- Kết quả receipt cache giữ 24 giờ.
- Cache key theo `userId + imageHash`.
- Cache phải được ghi trước khi emit socket success.
- Cache hỏng JSON được xem là cache miss và ghi warning metric/log.
- Sau 24 giờ, upload lại cùng ảnh có thể tạo scan mới.
- Chưa tạo MongoDB collection riêng để lưu receipt extraction.

## 10. Status endpoint

### Đã chốt

Thêm endpoint:

```text
GET /api/v1/transactions/scan-receipt/:jobId
```

Public status:

```text
waiting | active | completed | failed
```

Yêu cầu:

- bắt buộc JWT;
- kiểm tra `job.data.userId` thuộc user hiện tại;
- completed có thể trả cached result;
- failed chỉ trả error message đã sanitize;
- không trả raw job payload, stack trace hoặc provider response.

FE sử dụng endpoint này khi:

- reload trang;
- reconnect socket;
- quá thời gian chờ socket completion.

## 11. Hủy job

### Đã chốt

- Không hỗ trợ user cancel receipt job trong phase này.
- FE không hiển thị nút cancel.
- Có thể bổ sung sau nếu queue wait thực tế dài hoặc Gemini cost yêu cầu.

## 12. Metrics

### Đã chốt

Dùng `prom-client` và cung cấp:

```text
GET /metrics
```

Metrics bắt buộc:

- jobs enqueued;
- duplicate enqueue;
- waiting và active jobs;
- completed, skipped và failed;
- retry và final failure;
- queue wait duration;
- processing duration;
- Gemini duration/error/429;
- Cloudinary duration/error;
- cache hit/miss/corrupt;
- configured worker concurrency.

Không dùng các metric labels sau:

- user ID;
- email;
- filename;
- image hash;
- job ID;
- receipt title, amount hoặc dữ liệu tài chính.

## 13. Bảo vệ metrics

### Đã chốt

#### Development

- `/metrics` được mở trên localhost.

#### Production

- `/metrics` không public trực tiếp ra Internet.
- Nginx chỉ cho phép truy cập từ localhost hoặc Docker monitoring network.
- Prometheus scrape qua private Docker network.
- Không xây authentication riêng trong application ở phase đầu.

## 14. Monitoring UI

### Đã chốt

- Bull Board dùng để xem và debug từng job.
- Prometheus dùng để lưu time-series metrics.
- Grafana dùng để xem dashboard.
- Localhost có thể chạy Prometheus/Grafana bằng Docker Compose profile tùy
  chọn.
- Production VPS chạy Prometheus/Grafana nếu tài nguyên thực tế cho phép.
- Nếu monitoring tạo áp lực VPS, giữ Prometheus retention ngắn hoặc chuyển
  monitoring ra ngoài; application metrics contract không thay đổi.

## 15. MongoDB và Redis trên VPS

### Đã chốt

Giai đoạn học tập đầu tiên:

- MongoDB và Redis được phép chạy cùng VPS bằng Docker Compose.
- Redis bật persistence.
- MongoDB dùng persistent volume.
- MongoDB phải backup định kỳ ra ngoài VPS.
- Docker services phải có memory/CPU limits.

Khi có user thật hoặc cần độ tin cậy cao:

1. chuyển MongoDB ra managed service trước;
2. chuyển Redis ra managed service sau nếu cần.

Application chỉ phụ thuộc connection strings nên không cần đổi kiến trúc code.

## 16. VPS profile

### Đã chốt

VPS dự kiến:

- 2 AMD EPYC shared cores;
- 8 GB RAM;
- 35 GB NVMe;
- 3 TB bandwidth.

Deployment đầu:

- một API container;
- một worker container;
- một receipt worker instance;
- receipt concurrency `2`;
- Nginx;
- frontend;
- Redis;
- MongoDB;
- monitoring ở mức nhẹ.

Cần cấu hình swap để chống OOM bất ngờ, nhưng không xem swap là RAM chính.

## 17. Security và privacy

### Đã chốt

- Giữ validation MIME và upload size.
- Nén ảnh trước khi upload.
- Giới hạn kích thước ảnh tải về trong worker.
- Worker chỉ xử lý Cloudinary URL do server tạo.
- Không log base64, signed URL, receipt data hoặc dữ liệu tài chính.
- Không đưa dữ liệu nhạy cảm vào Sentry breadcrumbs/metrics.
- Status endpoint phải kiểm tra ownership.
- Client error messages phải được sanitize.

## 18. Socket semantics

### Đã chốt

- Socket.IO là best-effort notification.
- Redis cache và BullMQ state là nguồn phục hồi.
- Socket emit failure sau cache write không làm job retry.
- FE phải chịu được duplicate completion event.
- Event tiếp tục mang `jobId`.

## 19. Graceful shutdown

### Đã chốt

- Worker ngừng nhận job mới trước khi process dừng.
- Chờ active jobs hoàn tất trong timeout có giới hạn.
- Shutdown không được tạo terminal failure giả.
- API và worker containers có shutdown lifecycle độc lập.

## 20. Feature flags và biến môi trường

### Đã chốt

```env
RECEIPT_QUEUE_INTAKE_ENABLED=true
RECEIPT_WORKER_ENABLED=true
RECEIPT_WORKER_CONCURRENCY=2
RECEIPT_MAX_ATTEMPTS=3
RECEIPT_BACKOFF_DELAY_MS=10000
RECEIPT_AI_RATE_LIMIT_MAX=10
RECEIPT_AI_RATE_LIMIT_DURATION_MS=60000
RECEIPT_DOWNLOAD_TIMEOUT_MS=10000
RECEIPT_PROCESSING_TIMEOUT_MS=60000
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
METRICS_ENABLED=true
```

Các biến phải được parse và validate tập trung. Giá trị không hợp lệ phải fail
fast hoặc fallback theo policy được test, không để `NaN` đi vào worker options.

## 21. Rollout

### Đã chốt

1. Thêm configuration và metrics.
2. Thêm Receipt Intake Service.
3. Enqueue URL-only jobs sau Cloudinary upload.
4. Giữ legacy payload support.
5. Thêm status endpoint và FE recovery.
6. Test localhost với Bull Board và metrics.
7. Deploy VPS với concurrency `2`, limiter 10 RPM.
8. Theo dõi CPU, RAM, event-loop lag, queue wait p95, processing p95, retry và
   Gemini `429`.
9. Giảm concurrency hoặc limiter nếu metrics cho thấy quá tải.
10. Xóa Promise background cũ và legacy base64 branch theo rollout gate.

## 22. Không làm trong phase này

- Không hỗ trợ cancel job.
- Không lưu extraction result lâu dài trong MongoDB.
- Không tự động tạo transaction sau khi scan.
- Không tăng concurrency trên `2`.
- Không autoscale worker.
- Không xây generic worker framework.
- Không thay provider.
- Không cam kết exactly-once delivery.

## 23. Việc chỉ cần xác minh, không cần quyết định lại

Các mục sau là checklist vận hành, không còn là câu hỏi thiết kế:

- đọc quota Gemini thật trước production;
- đo VPS trước khi tăng tải;
- kiểm tra backup MongoDB;
- kiểm tra Redis persistence;
- kiểm tra `/metrics` không public;
- kiểm tra API container không chạy worker;
- kiểm tra worker container chỉ có một instance;
- kiểm tra Bull Board được bảo vệ ở production.

## 24. Điều kiện bắt đầu implementation

Feature đủ quyết định để bắt đầu implementation.

Không còn vấn đề thiết kế bắt buộc nào cần chốt thêm.
