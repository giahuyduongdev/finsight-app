# Tóm tắt cải thiện Receipt với BullMQ

## Hiện trạng

Luồng quét hóa đơn mới hiện chưa thực sự sử dụng BullMQ. API trả `202 Accepted`
rồi chạy một Promise nền trực tiếp trong process backend.

Điều này dẫn đến các vấn đề:

- backend restart có thể làm mất tác vụ đã nhận;
- `concurrency: 2` của Receipt Worker chưa áp dụng cho lượt quét từ FE;
- không có retry và backoff cấp BullMQ;
- traffic tăng có thể tạo nhiều Gemini request đồng thời không kiểm soát;
- Bull Board không hiển thị đầy đủ các lượt quét mới;
- không có queue metrics để đo tải và điều chỉnh capacity;
- hai request cùng ảnh có thể cùng gọi Gemini trước khi cache được ghi.

## Giải pháp đã chọn

Ảnh được nén và upload lên Cloudinary trước. BullMQ chỉ lưu URL của ảnh, không
lưu base64.

```text
FE upload ảnh
  -> API validate, nén và hash ảnh
  -> kiểm tra cache
  -> upload hoặc dùng lại ảnh trên Cloudinary
  -> enqueue job chứa imageUrl
  -> trả 202 + jobId
  -> Receipt Worker gọi Gemini
  -> ghi cache
  -> gửi Socket.IO event cho FE
```

Lý do chọn phương án này:

- Redis không phải giữ payload ảnh lớn;
- job vẫn tồn tại khi API hoặc worker restart;
- retry có thể tải lại cùng ảnh từ Cloudinary;
- Bull Board và metrics quan sát được toàn bộ luồng;
- phù hợp cho cả localhost và VPS.

## Idempotency

Business identity của một lượt quét là:

```text
userId + imageHash
```

Identity này được dùng để:

- tạo stable BullMQ `jobId`;
- ngăn hai request cùng user và cùng ảnh tạo hai job tương đương;
- tạo Cloudinary public ID ổn định;
- đọc kết quả cache khi job bị retry hoặc replay.

Cùng một ảnh của hai user khác nhau vẫn là hai business jobs riêng biệt.

## Concurrency và capacity

Giá trị ban đầu đã chốt:

```env
RECEIPT_WORKER_CONCURRENCY=2
```

Một worker instance chỉ xử lý tối đa hai receipt jobs cùng lúc. Các job còn lại
nằm trong trạng thái `waiting`.

```text
tổng active jobs = số worker instances × concurrency mỗi worker
```

Với một worker và thời gian trung bình năm giây mỗi scan, throughput lý thuyết
khoảng 24 scans/phút. Công suất thực tế còn phụ thuộc quota Gemini, Cloudinary,
network và CPU.

VPS dự kiến có 2 shared vCPU và 8 GB RAM sẽ bắt đầu với một worker instance,
concurrency `2`. Chỉ giảm xuống `1` nếu metrics cho thấy CPU hoặc event-loop bị
nghẽn. Không tăng trên `2` nếu chưa đo capacity lại.

## Retry và lỗi

Cấu hình mặc định:

- tối đa ba attempts;
- exponential backoff bắt đầu từ 10 giây;
- lỗi Gemini `429`, `503`, `504`, timeout hoặc network có thể retry;
- ảnh không phải hóa đơn là permanent failure và không retry;
- failure event chỉ gửi khi lỗi permanent hoặc đã hết attempts.

Cache phải được ghi trước khi emit socket success. Nếu socket bị mất, client vẫn
có thể lấy lại trạng thái và kết quả.

## Khôi phục trạng thái

Socket.IO là kênh thông báo nhanh, không phải source of truth.

Spec đề xuất endpoint:

```text
GET /api/v1/transactions/scan-receipt/:jobId
```

Endpoint cho phép FE kiểm tra:

```text
waiting | active | completed | failed
```

Endpoint phải xác minh job thuộc user đang đăng nhập và không được trả raw job
payload, stack trace hoặc dữ liệu provider nội bộ.

## Metrics

Metrics cần hoạt động ngay trên localhost và có thể đưa lên VPS sau này:

- số job đã enqueue;
- số duplicate enqueue;
- số job waiting và active;
- completed, skipped và failed;
- retry và final failure;
- queue wait time;
- processing duration p50, p95, p99;
- Gemini và Cloudinary duration/error;
- Gemini `429`;
- cache hit/miss ratio;
- worker concurrency hiện tại.

Metric labels không được chứa user ID, email, filename, image hash hoặc dữ liệu
tài chính từ hóa đơn.

Bull Board dùng để xem từng job. Prometheus/Grafana hoặc metrics endpoint dùng
để xem xu hướng theo thời gian. Hai công cụ không thay thế nhau.

## Localhost và VPS

Localhost vẫn dùng cùng kiến trúc:

- Redis và MongoDB local;
- một Receipt Worker;
- concurrency `2`;
- Bull Board;
- metrics endpoint;
- có thể thêm Prometheus/Grafana bằng Docker Compose profile.

Trên VPS học tập có thể chạy chung:

- Nginx;
- frontend;
- backend API;
- BullMQ workers;
- Redis;
- MongoDB;
- monitoring.

Nếu MongoDB và Redis chạy cùng VPS, cần Docker resource limits, Redis
persistence và backup MongoDB ra ngoài máy. Sau này có thể chuyển sang managed
services chỉ bằng cách đổi biến môi trường.

## Các biến cấu hình chính

```env
RECEIPT_QUEUE_INTAKE_ENABLED=true
RECEIPT_WORKER_ENABLED=true
RECEIPT_WORKER_CONCURRENCY=2
RECEIPT_AI_RATE_LIMIT_MAX=
RECEIPT_AI_RATE_LIMIT_DURATION_MS=
RECEIPT_DOWNLOAD_TIMEOUT_MS=
RECEIPT_SCAN_CACHE_TTL_SECONDS=
```

Rate limit Gemini phải là global limiter của queue để thêm worker instance không
vô tình nhân số request gửi tới provider.

## Các vấn đề cần chốt trước production

Không cản trở việc triển khai và test trên localhost, nhưng cần chốt trước khi
đưa lên production:

1. Quota RPM/TPM thực tế của Gemini và số API keys.
2. API và worker chạy chung process hay tách container.
3. MongoDB và Redis chạy cùng VPS hay dùng managed services.
4. `/metrics` được bảo vệ bằng private network, reverse-proxy authentication hay
   managed collector.
5. Kết quả và trạng thái receipt cần giữ trong bao lâu sau 24 giờ cache hiện tại.
6. Có cần chức năng hủy job hay không; mặc định hiện tại là không.

## Kết quả mong đợi

Sau khi hoàn thành:

- mọi lượt quét mới từ FE đều đi qua `RECEIPT_QUEUE`;
- Bull Board hiển thị đúng waiting, active, completed và failed;
- Redis không giữ base64 cho job mới;
- backend restart không làm mất job đã nhận;
- concurrency và Gemini request rate được kiểm soát;
- duplicate request không tạo duplicate Gemini work;
- FE khôi phục được kết quả khi mất socket hoặc reload;
- metrics đủ để điều chỉnh localhost và VPS dựa trên dữ liệu thực tế.
