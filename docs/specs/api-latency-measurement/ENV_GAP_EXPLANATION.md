# Giải Thích Env Thiếu Và Env Thừa

File này giải thích các key đang thiếu khi so sánh:

```text
.env                 vs .env.example
backend/.env         vs backend/.env.example
```

Không ghi secret thật vào file này. Khi cập nhật `.env`, chỉ thêm key và điền
giá trị phù hợp trên máy của bạn.

## Root `.env`

Root `.env` dùng cho Docker Compose monitoring profile.

### Thiếu: `GRAFANA_ADMIN_USER`

User đăng nhập Grafana local.

Gợi ý local:

```env
GRAFANA_ADMIN_USER=admin
```

### Thiếu: `GRAFANA_ADMIN_PASSWORD`

Password đăng nhập Grafana local.

Gợi ý local:

```env
GRAFANA_ADMIN_PASSWORD=admin
```

Với production, không dùng password mặc định. Đặt password mạnh và không commit.

## Backend `.env`

Backend `.env` dùng cho API server.

## Nhóm JWT

### Thiếu: `JWT_ISSUER`

Issuer claim cho access token.

Code có default là `finsight-api`, nhưng nên ghi rõ trong `.env` để local và
production dễ audit.

Gợi ý:

```env
JWT_ISSUER=finsight-api
```

## Nhóm Sentry

Sentry dùng để capture exception và background error. Các biến này không bắt
buộc cho latency dashboard Prometheus/Grafana.

### Thiếu: `SENTRY_RELEASE`

Tên release/version đang chạy. Production có thể dùng commit hash, tag, hoặc
version deploy.

Gợi ý local:

```env
SENTRY_RELEASE=
```

### Thiếu: `SENTRY_TRACES_SAMPLE_RATE`

Tỷ lệ sampling trace của Sentry.

`0.1` nghĩa là 10%.

Gợi ý:

```env
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Thiếu: `SENTRY_BACKGROUND_ERRORS_ENABLED`

Bật/tắt capture lỗi background worker/job lên Sentry.

Gợi ý:

```env
SENTRY_BACKGROUND_ERRORS_ENABLED=true
```

Nếu `SENTRY_DSN` đang trống thì Sentry không gửi event đi, dù biến này là
`true`.

## Nhóm Metrics

Nhóm này quan trọng cho API latency monitoring.

### Thiếu: `METRICS_ENABLED`

Bật/tắt endpoint metrics.

Phải bật để Prometheus scrape được số liệu latency.

Gợi ý:

```env
METRICS_ENABLED=true
```

### Thiếu: `METRICS_ROUTE`

Đường dẫn expose Prometheus metrics.

Gợi ý:

```env
METRICS_ROUTE=/metrics
```

Sau khi backend chạy, kiểm tra:

```text
http://localhost:8000/metrics
```

### Thiếu: `METRICS_QUEUE_POLL_INTERVAL_MS`

Chu kỳ poll BullMQ queue metrics, tính bằng milliseconds.

Gợi ý:

```env
METRICS_QUEUE_POLL_INTERVAL_MS=15000
```

Nghĩa là 15 giây poll một lần.

### Thiếu: `METRICS_DEFAULT_INTERVAL_MS`

Chu kỳ default cho Node.js process metrics, tính bằng milliseconds.

Gợi ý:

```env
METRICS_DEFAULT_INTERVAL_MS=10000
```

Nghĩa là 10 giây.

## Nhóm Exchange Rate

### Thiếu: `EXCHANGE_RATE_PRIMARY_API_URL`

Base URL API tỷ giá chính.

Code hiện đọc biến này.

Gợi ý:

```env
EXCHANGE_RATE_PRIMARY_API_URL=https://api.exchangerate-api.com/v4/latest
```

### Thiếu: `EXCHANGE_RATE_FALLBACK_API_URL`

Base URL API tỷ giá fallback nếu primary lỗi.

Có thể để trống nếu chưa có provider fallback.

Gợi ý:

```env
EXCHANGE_RATE_FALLBACK_API_URL=
```

### Thừa/cũ: `EXCHANGE_RATE_API_URL`

`backend/.env` đang có:

```env
EXCHANGE_RATE_API_URL=
```

Nhưng code hiện không đọc key này nữa. Code đang đọc:

```env
EXCHANGE_RATE_PRIMARY_API_URL=
EXCHANGE_RATE_FALLBACK_API_URL=
```

Nếu `EXCHANGE_RATE_API_URL` đang có giá trị thật, hãy copy giá trị đó sang:

```env
EXCHANGE_RATE_PRIMARY_API_URL=<giá trị cũ của EXCHANGE_RATE_API_URL>
```

Sau đó có thể xóa `EXCHANGE_RATE_API_URL` khỏi `backend/.env` để tránh nhầm.

## Nhóm Receipt Worker

Các biến này điều khiển receipt scan queue/worker. Nếu chưa dùng receipt scan
thì vẫn nên thêm default để config rõ ràng.

### Thiếu: `RECEIPT_QUEUE_INTAKE_ENABLED`

Bật/tắt nhận job scan receipt vào queue.

Gợi ý:

```env
RECEIPT_QUEUE_INTAKE_ENABLED=true
```

### Thiếu: `RECEIPT_WORKER_ENABLED`

Bật/tắt receipt worker.

Gợi ý:

```env
RECEIPT_WORKER_ENABLED=true
```

### Thiếu: `RECEIPT_WORKER_CONCURRENCY`

Số job receipt worker xử lý song song.

Gợi ý local/VPS nhỏ:

```env
RECEIPT_WORKER_CONCURRENCY=2
```

### Thiếu: `RECEIPT_MAX_ATTEMPTS`

Số lần retry tối đa cho receipt job.

Gợi ý:

```env
RECEIPT_MAX_ATTEMPTS=3
```

### Thiếu: `RECEIPT_BACKOFF_DELAY_MS`

Thời gian chờ giữa các lần retry, tính bằng milliseconds.

Gợi ý:

```env
RECEIPT_BACKOFF_DELAY_MS=10000
```

Nghĩa là 10 giây.

### Thiếu: `RECEIPT_AI_RATE_LIMIT_MAX`

Số request AI tối đa trong một window rate limit.

Gợi ý:

```env
RECEIPT_AI_RATE_LIMIT_MAX=10
```

### Thiếu: `RECEIPT_AI_RATE_LIMIT_DURATION_MS`

Độ dài window rate limit AI, tính bằng milliseconds.

Gợi ý:

```env
RECEIPT_AI_RATE_LIMIT_DURATION_MS=60000
```

Nghĩa là 60 giây.

### Thiếu: `RECEIPT_DOWNLOAD_TIMEOUT_MS`

Timeout khi download receipt image/file, tính bằng milliseconds.

Gợi ý:

```env
RECEIPT_DOWNLOAD_TIMEOUT_MS=10000
```

### Thiếu: `RECEIPT_PROCESSING_TIMEOUT_MS`

Timeout xử lý receipt scan, tính bằng milliseconds.

Gợi ý:

```env
RECEIPT_PROCESSING_TIMEOUT_MS=60000
```

### Thiếu: `RECEIPT_MAX_DOWNLOAD_BYTES`

Dung lượng download tối đa cho receipt file.

Gợi ý:

```env
RECEIPT_MAX_DOWNLOAD_BYTES=5242880
```

Nghĩa là 5 MiB.

### Thiếu: `RECEIPT_SCAN_CACHE_TTL_SECONDS`

Thời gian cache kết quả receipt scan, tính bằng giây.

Gợi ý:

```env
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
```

Nghĩa là 1 ngày.

## Block Có Thể Copy Vào Root `.env`

```env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
```

Với production, đổi password mạnh hơn.

## Block Có Thể Copy Vào `backend/.env`

```env
JWT_ISSUER=finsight-api

SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_BACKGROUND_ERRORS_ENABLED=true

METRICS_ENABLED=true
METRICS_ROUTE=/metrics
METRICS_QUEUE_POLL_INTERVAL_MS=15000
METRICS_DEFAULT_INTERVAL_MS=10000

EXCHANGE_RATE_PRIMARY_API_URL=https://api.exchangerate-api.com/v4/latest
EXCHANGE_RATE_FALLBACK_API_URL=

RECEIPT_QUEUE_INTAKE_ENABLED=true
RECEIPT_WORKER_ENABLED=true
RECEIPT_WORKER_CONCURRENCY=2
RECEIPT_MAX_ATTEMPTS=3
RECEIPT_BACKOFF_DELAY_MS=10000
RECEIPT_AI_RATE_LIMIT_MAX=10
RECEIPT_AI_RATE_LIMIT_DURATION_MS=60000
RECEIPT_DOWNLOAD_TIMEOUT_MS=10000
RECEIPT_PROCESSING_TIMEOUT_MS=60000
RECEIPT_MAX_DOWNLOAD_BYTES=5242880
RECEIPT_SCAN_CACHE_TTL_SECONDS=86400
```

## Sau Khi Cập Nhật `.env`

1. Restart backend.
2. Mở:

```text
http://localhost:8000/metrics
```

3. Nếu thấy Prometheus text metrics, phần metrics đã bật.
4. Chạy lại:

```powershell
pnpm --dir backend run loadtest:api:public
```

5. Kiểm tra dashboard:

```text
Finsight API Latency
```
