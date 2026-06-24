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

Receipt sử dụng foundation tại:

```text
docs/specs/project-observability-foundation
```

Foundation sở hữu `prom-client`, registry, `/metrics`, Sentry helpers,
Prometheus/Grafana và privacy/cardinality rules. Receipt chỉ đăng ký metrics và
events đặc thù.

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
- Sentry dùng để điều tra exception, terminal failure và trace bất thường.
- Localhost có thể chạy Prometheus/Grafana bằng Docker Compose profile tùy
  chọn.
- Production VPS chạy Prometheus/Grafana nếu tài nguyên thực tế cho phép.
- Nếu monitoring tạo áp lực VPS, giữ Prometheus retention ngắn hoặc chuyển
  monitoring ra ngoài; application metrics contract không thay đổi.

## 15. Sentry

### Vai trò đã chốt

Sentry không thay thế Prometheus metrics.

```text
Bull Board  -> trạng thái và payload của từng BullMQ job
Prometheus  -> counters, gauges, latency và capacity theo thời gian
Grafana     -> dashboard từ Prometheus
Sentry      -> exception, terminal failure và distributed trace
```

### Những sự kiện Receipt phải gửi lên Sentry

- Receipt Worker infrastructure error.
- Final failure sau khi đã hết BullMQ attempts.
- Permanent failure bất thường do payload nội bộ hoặc invariant bị vi phạm.
- Gemini hoặc Cloudinary circuit breaker chuyển sang trạng thái open.
- Status endpoint hoặc queue intake phát sinh lỗi server `5xx`.
- Graceful shutdown timeout khiến active job không đóng sạch.

### Những sự kiện không gửi lên Sentry

- Retryable attempt thông thường khi BullMQ vẫn còn retry.
- Cache miss.
- Duplicate enqueue hoặc completed skip.
- Ảnh không phải hóa đơn do người dùng upload.
- Validation error hoặc HTTP `4xx` thông thường.
- Mỗi Gemini `429` riêng lẻ nếu hệ thống vẫn retry đúng policy.

Các sự kiện này được theo dõi bằng Prometheus counters và structured logs để
tránh Sentry noise.

### Metadata được phép

Sentry event có thể chứa:

- environment;
- release/commit SHA;
- queue name;
- job name;
- attempt number và max attempts;
- safe error class;
- correlation/request ID;
- worker instance/version.

`jobId` chỉ được đặt trong Sentry context để điều tra, không dùng làm tag vì có
cardinality cao.

### Dữ liệu cấm gửi lên Sentry

- base64 hoặc image bytes;
- Cloudinary signed/full image URL;
- filename do user cung cấp;
- email;
- API key, token, cookie hoặc authorization header;
- receipt title, amount, date, description, category hoặc payment method;
- raw BullMQ job payload;
- raw Gemini/Cloudinary response.

### Cải thiện Sentry hiện tại

Sentry hiện đã capture HTTP `5xx`, gắn request ID/path/method/user ID và redact
sensitive headers. Feature này phải mở rộng:

1. Thêm helper capture lỗi background worker, không phụ thuộc Express request.
2. Mở rộng `beforeSend` để scrub:
   - request body;
   - query string;
   - cookies;
   - breadcrumbs;
   - contexts/extra chứa receipt payload hoặc URL.
3. Thêm cấu hình:

```env
SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_WORKER_ERRORS_ENABLED=true
```

4. Production release lấy từ commit SHA hoặc deployment version.
5. Không hardcode sampling:
   - development bình thường có thể dùng `1.0`;
   - capacity/load test dùng `0` hoặc giá trị thấp để tránh tạo quá nhiều event;
   - production bắt đầu `0.1`.
6. Sentry capture failure không được làm job fail thêm hoặc làm backend crash.

### Alert ban đầu

Thiết lập alert cho:

- Receipt final failure tăng bất thường;
- worker infrastructure error;
- circuit breaker open;
- lỗi status/intake `5xx`.

Prometheus vẫn là nguồn alert chính cho Gemini `429`, queue depth, latency và
retry rate.

## 16. MongoDB và Redis trên VPS

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

## 17. VPS profile

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

## 18. Security và privacy

### Đã chốt

- Giữ validation MIME và upload size.
- Nén ảnh trước khi upload.
- Giới hạn kích thước ảnh tải về trong worker.
- Worker chỉ xử lý Cloudinary URL do server tạo.
- Không log base64, signed URL, receipt data hoặc dữ liệu tài chính.
- Không đưa dữ liệu nhạy cảm vào Sentry breadcrumbs/metrics.
- Sentry `beforeSend` phải scrub cả headers, body, query, breadcrumbs, context
  và extra.
- Status endpoint phải kiểm tra ownership.
- Client error messages phải được sanitize.

## 19. Socket semantics

### Đã chốt

- Socket.IO là best-effort notification.
- Redis cache và BullMQ state là nguồn phục hồi.
- Socket emit failure sau cache write không làm job retry.
- FE phải chịu được duplicate completion event.
- Event tiếp tục mang `jobId`.

## 20. Graceful shutdown

### Đã chốt

- Worker ngừng nhận job mới trước khi process dừng.
- Chờ active jobs hoàn tất trong timeout có giới hạn.
- Shutdown không được tạo terminal failure giả.
- API và worker containers có shutdown lifecycle độc lập.

## 21. Feature flags và biến môi trường

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
SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_WORKER_ERRORS_ENABLED=true
```

Các biến phải được parse và validate tập trung. Giá trị không hợp lệ phải fail
fast hoặc fallback theo policy được test, không để `NaN` đi vào worker options.

## 22. Rollout

### Đã chốt

1. Thêm configuration, metrics và Sentry worker capture.
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

## 23. Không làm trong phase này

- Không hỗ trợ cancel job.
- Không lưu extraction result lâu dài trong MongoDB.
- Không tự động tạo transaction sau khi scan.
- Không tăng concurrency trên `2`.
- Không autoscale worker.
- Không xây generic worker framework.
- Không thay provider.
- Không cam kết exactly-once delivery.

## 24. Việc chỉ cần xác minh, không cần quyết định lại

Các mục sau là checklist vận hành, không còn là câu hỏi thiết kế:

- đọc quota Gemini thật trước production;
- đo VPS trước khi tăng tải;
- kiểm tra backup MongoDB;
- kiểm tra Redis persistence;
- kiểm tra `/metrics` không public;
- kiểm tra API container không chạy worker;
- kiểm tra worker container chỉ có một instance;
- kiểm tra Bull Board được bảo vệ ở production.
- kiểm tra Sentry release đúng commit/deployment;
- kiểm tra capacity test không dùng trace sampling `1.0`;
- kiểm tra Sentry event không chứa receipt payload hoặc Cloudinary URL.

## 25. Quy trình test quota và capacity

### Cấu hình khởi đầu

Localhost bắt đầu với:

```env
RECEIPT_WORKER_CONCURRENCY=2
RECEIPT_AI_RATE_LIMIT_MAX=10
RECEIPT_AI_RATE_LIMIT_DURATION_MS=60000
```

Hiện môi trường local có năm Gemini API keys và một cấu hình Cloudinary account.
Số API keys chỉ là thông tin vận hành, không được dùng để tự động nhân limiter.

Theo Gemini API:

- quota được đo theo RPM, input TPM và RPD;
- chỉ cần vượt một trong các giới hạn là request có thể nhận rate-limit error;
- quota áp dụng theo Google Cloud project, không áp dụng riêng cho từng API key;
- quota thay đổi theo model và usage tier;
- giới hạn đang có hiệu lực phải được đọc từ Google AI Studio.

Vì vậy, năm API keys thuộc cùng một project vẫn dùng chung quota. Nếu keys thuộc
nhiều projects thì mỗi project có quota riêng, nhưng application không được dựa
vào key rotation để né hoặc cộng quota một cách mặc định.

Nguồn chính thức:

- <https://ai.google.dev/gemini-api/docs/rate-limits>
- <https://aistudio.google.com/rate-limit>

### Test chức năng cơ bản

1. Upload một receipt hợp lệ.
2. Xác nhận API trả `202` và `jobId`.
3. Xác nhận Bull Board hiển thị job trong `RECEIPT_QUEUE`.
4. Xác nhận job payload có `imageUrl` và không có base64.
5. Xác nhận job completed và FE nhận kết quả.
6. Upload lại cùng ảnh và xác nhận cache/deduplication không gọi Gemini lần hai.

### Test concurrency

1. Chuẩn bị ít nhất sáu receipt images hợp lệ.
2. Gửi sáu request gần như đồng thời.
3. Quan sát Bull Board và metrics.
4. Xác nhận số job `active` không vượt quá `2`.
5. Xác nhận các job còn lại ở `waiting`.
6. Xác nhận job tiếp theo chỉ chuyển sang `active` khi có active slot trống.

### Test limiter 10 jobs/phút

Trước khi chạy:

1. Mở Google AI Studio Rate Limits.
2. Ghi lại project, usage tier và RPM/TPM/RPD của từng model Receipt đang dùng.
3. Xác định năm API keys thuộc một project hay nhiều projects mà không ghi key
   value vào tài liệu hoặc log.
4. Nếu RPM nhỏ nhất của model/project đang dùng thấp hơn 10, đặt limiter bằng
   hoặc thấp hơn RPM đó trước khi test.

Sau đó:

1. Gửi hơn 10 receipt jobs khác nhau trong vòng một phút.
2. Xác nhận không có hơn 10 jobs được bắt đầu trong cửa sổ limiter.
3. Xác nhận job vượt giới hạn vẫn ở queue và không bị fail.
4. Xác nhận chúng tiếp tục được xử lý ở cửa sổ tiếp theo.

### Metrics bắt buộc phải quan sát

- `active` và `waiting` jobs;
- queue wait p95;
- processing duration p95;
- Gemini calls;
- Gemini `429`;
- Gemini retry;
- final failure;
- Cloudinary upload duration/error;
- cache hit/miss;
- CPU, RAM và event-loop lag.

### Quy tắc điều chỉnh Gemini limiter

- Có Gemini `429` trong bài test tải ổn định:
  - giảm từ 10 xuống 5 jobs/phút;
  - chạy lại cùng test;
  - không tăng cho đến khi không còn `429`.
- Không có `429`, CPU ổn định và queue thường xuyên ùn:
  - tăng từ 10 lên 15 jobs/phút;
  - chạy lại toàn bộ test;
  - sau đó mới cân nhắc 20 jobs/phút.
- Không thay đổi limiter dựa trên một request đơn lẻ.
- Mỗi lần điều chỉnh chỉ thay một biến và ghi lại kết quả.

### Quy tắc điều chỉnh concurrency

- Giữ concurrency `2` làm mặc định.
- Giảm xuống `1` nếu:
  - CPU duy trì ở mức cao;
  - event-loop lag vượt ngưỡng vận hành;
  - timeout tăng rõ rệt;
  - MongoDB/Redis trên cùng VPS bị tranh tài nguyên.
- Không tăng trên `2` trong phase này.

### Test Cloudinary

1. Upload nhiều ảnh khác nhau và theo dõi upload duration/error.
2. Upload lại cùng ảnh và xác nhận deterministic asset được reuse.
3. Mô phỏng Cloudinary failure và xác nhận API không trả `202`.
4. Xác nhận enqueue không xảy ra khi upload thất bại.
5. Chỉ thêm Cloudinary limiter nếu metrics thực tế xuất hiện `429` hoặc quota
   failure.

### Test restart và recovery

1. Enqueue nhiều jobs để có cả `active` và `waiting`.
2. Dừng worker nhưng giữ Redis.
3. Khởi động lại worker.
4. Xác nhận waiting jobs tiếp tục chạy.
5. Xác nhận active/stalled job được recover mà không tạo duplicate result.
6. Reload FE hoặc ngắt socket và xác nhận status endpoint lấy lại được trạng
   thái.

### Ghi nhận kết quả

Mỗi lần capacity test cần ghi:

- ngày test;
- môi trường và cấu hình;
- số worker instances;
- concurrency;
- limiter;
- số jobs;
- tỷ lệ success/retry/failure;
- Gemini `429`;
- queue wait p95;
- processing p95;
- CPU/RAM;
- quyết định giữ, tăng hoặc giảm cấu hình.

Trong capacity test:

- đặt `SENTRY_TRACES_SAMPLE_RATE=0` hoặc mức thấp;
- không tạo alert từ từng retry/429;
- xác nhận final failure và infrastructure error thử nghiệm vẫn được capture khi
  `SENTRY_WORKER_ERRORS_ENABLED=true`.

## 26. Điều kiện bắt đầu implementation

Feature đủ quyết định để bắt đầu implementation.

Không còn vấn đề thiết kế bắt buộc nào cần chốt thêm.
