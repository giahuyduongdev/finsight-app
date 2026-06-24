# Quyết định cuối cùng — Project Observability Foundation

## Trạng thái

Tài liệu này chốt phạm vi và mặc định triển khai. Không còn quyết định thiết kế
bắt buộc trước khi lập implementation plan.

## Đã chốt

### Phạm vi

- Xây foundation dùng chung trước.
- Receipt là domain đầu tiên tích hợp.
- Report và Transaction mở rộng sau bằng feature riêng.
- Không instrument toàn bộ project trong một PR.

### Công cụ

```text
Structured logs -> chi tiết event
Sentry          -> exception và terminal failure
Prometheus      -> time-series metrics
Grafana         -> dashboard và alerts
Bull Board      -> từng BullMQ job
Health/ready    -> deployment probes
```

### Metrics

- Dùng `prom-client`.
- Một registry dùng chung.
- Endpoint mặc định `/metrics`.
- Prefix metric: `finsight_`.
- HTTP metrics dùng route template, không dùng raw path.
- Process metrics gồm CPU, RAM, event-loop lag và uptime.
- BullMQ metrics chung cho queue lifecycle và queue depth.
- Provider metrics chung cho Gemini, Cloudinary và Resend.
- Receipt thêm cache/outcome metrics để kiểm chứng foundation.

### Cardinality và privacy

Không dùng các giá trị sau làm metric labels:

- user ID;
- job ID;
- request ID;
- email;
- filename;
- image hash;
- database ID;
- error message;
- raw URL;
- dữ liệu tài chính.

### Sentry

- Giữ HTTP `5xx` capture.
- Thêm background worker capture helper.
- Capture infrastructure error, final failure, circuit breaker open và shutdown
  timeout.
- Không capture mỗi retry, cache miss, business skip hoặc từng provider `429`.
- Scrub headers, cookies, body, query, breadcrumbs, contexts, extras và raw job
  payload.
- Production trace sampling khởi đầu `0.1`.
- Load test dùng sampling `0` hoặc mức thấp.
- Sentry failure không được đổi application outcome.

### Local monitoring

- Prometheus và Grafana chạy bằng Docker Compose profile `monitoring`.
- Prometheus port `9090`.
- Grafana port `3000`.
- Scrape interval 30 giây.
- Retention 7 ngày.
- Có dashboard Project Overview, BullMQ và Receipt reference.

### VPS

- Prometheus memory limit khởi đầu khoảng 512 MB.
- Grafana memory limit khởi đầu khoảng 256 MB.
- `/metrics` chỉ truy cập qua private Docker network.
- Monitoring có thể tắt hoặc chuyển ra ngoài mà không đổi application code.

### Không làm

- Không thêm Loki/ELK.
- Không thêm OpenTelemetry Collector.
- Không instrument đầy đủ Report và Transaction trong feature này.
- Không public `/metrics`.
- Không dùng Prometheus để lưu logs.
- Không tự xây monitoring database/UI.

## Cấu hình mặc định

```env
METRICS_ENABLED=true
METRICS_ROUTE=/metrics
METRICS_QUEUE_POLL_INTERVAL_MS=15000
METRICS_DEFAULT_INTERVAL_MS=10000

SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_BACKGROUND_ERRORS_ENABLED=true

PROMETHEUS_SCRAPE_INTERVAL=30s
PROMETHEUS_RETENTION_TIME=7d
```

## Điều kiện hoàn thành

- Foundation APIs được test và documented.
- Receipt sử dụng foundation.
- Prometheus/Grafana local chạy được.
- Sentry background capture và privacy tests pass.
- Không có high-cardinality/sensitive labels.
- Metrics/Sentry failure không ảnh hưởng request/job.
