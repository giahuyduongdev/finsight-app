# API Latency Measurement - Giải Thích Từ A Đến Z

File này giải thích toàn bộ feature **API Latency Measurement** theo cách dễ
hiểu hơn: đã làm gì, dùng để làm gì, các thuật ngữ nghĩa là gì, và khi chạy thì
dữ liệu đi qua những bước nào.

## 1. Mục Tiêu Feature Này

Mục tiêu là để trả lời các câu hỏi:

- API nào đang chậm?
- API chậm bao nhiêu ms/giây?
- API có bị lỗi `5xx` không?
- Khi nhiều request cùng chạy thì latency có tăng không?
- Sau khi deploy production, user thật đang gặp latency như thế nào?

Trước đây nếu dùng Postman thì chỉ biết một request đơn lẻ mất bao lâu. Cách đó
không đủ để biết p95/p99, không biết API nào chậm nhất, và không theo dõi được
production lâu dài.

Feature này thêm workflow đúng hơn:

```text
Backend ghi metrics -> Prometheus lưu số liệu -> Grafana hiển thị dashboard
                       k6 tạo traffic test local
```

## 2. Những Gì Đã Làm

### 2.1. Tạo Spec

Đã tạo thư mục:

```text
docs/specs/api-latency-measurement/
```

Trong đó có:

```text
requirements.md
design.md
tasks.md
sequence.mmd
MANUAL_TEST.md
API_COVERAGE_MATRIX.vi.md
ENV_GAP_EXPLANATION.md
ENV_KEYS_REFERENCE.md
```

Ý nghĩa:

- `requirements.md`: feature cần đạt gì.
- `design.md`: thiết kế kỹ thuật.
- `tasks.md`: checklist implementation/verification.
- `sequence.mmd`: sơ đồ luồng dữ liệu.
- `MANUAL_TEST.md`: cách test thủ công.
- `API_COVERAGE_MATRIX.vi.md`: route nào được k6 scenario nào test.
- `ENV_GAP_EXPLANATION.md`: giải thích key env thiếu/thừa.
- `ENV_KEYS_REFERENCE.md`: giải thích toàn bộ env key.

### 2.2. Thêm Grafana Dashboard

Đã thêm file:

```text
monitoring/grafana/dashboards/finsight-api-latency.json
```

Dashboard tên:

```text
Finsight API Latency
```

Dashboard này dùng để xem:

- p95 latency toàn API;
- p50/p95/p99 theo từng route;
- API nào chậm nhất;
- request rate;
- 5xx rate;
- breakdown theo status code;
- filter theo route và method.

### 2.3. Thêm Prometheus Alerts

Đã cập nhật:

```text
monitoring/prometheus/alerts.yml
```

Đã thêm alert cho:

- p95 toàn API cao;
- p95 từng route cao;
- lỗi `5xx` theo HTTP.

Alert nghĩa là nếu latency/error vượt ngưỡng trong một khoảng thời gian đủ lâu,
Prometheus sẽ đánh dấu có vấn đề. Hiện tại mới là rule nội bộ; muốn gửi Telegram,
Email, Slack thì sau này cần thêm Alertmanager/integration.

### 2.4. Thêm k6 Load Test

Đã thêm:

```text
backend/load-tests/api-latency.k6.js
backend/load-tests/README.md
```

Và thêm script:

```powershell
pnpm --dir backend run loadtest:api
pnpm --dir backend run loadtest:api:public
```

`k6` dùng để tạo traffic test local. Ví dụ chạy 5 virtual users trong 1 phút để
xem API phản hồi thế nào.

### 2.5. Cập Nhật Docs

Đã cập nhật:

```text
monitoring/README.md
```

Docs nói rõ:

- Postman chỉ dùng smoke/manual check;
- k6 dùng để load test local;
- Prometheus/Grafana dùng để đo và xem số liệu;
- production mới là nguồn latency chuẩn nhất.

## 3. Luồng Hoạt Động Tổng Thể

Khi có một request gọi vào backend:

```text
Client/Postman/k6
  -> Backend API
  -> httpMetricsMiddleware đo duration
  -> /metrics expose số liệu
  -> Prometheus scrape /metrics
  -> Grafana query Prometheus
  -> Dashboard hiển thị p50/p95/p99
```

Ví dụ bạn chạy:

```powershell
pnpm --dir backend run loadtest:api:public
```

Thì k6 sẽ gọi:

```text
GET /health
GET /ready
GET /api/v1/auth/callback
```

Trong đó `/api/v1/auth/callback` là product route, nên nó xuất hiện trên dashboard
API latency.

## 4. Các Thành Phần Chính

## 4.1. Backend Metrics

Backend đang có middleware:

```text
backend/src/observability/http.metrics.ts
```

Middleware này đo:

- API method: `GET`, `POST`, `PUT`, `DELETE`;
- route: ví dụ `/api/v1/auth/callback`;
- status code: `200`, `302`, `400`, `500`;
- duration: request xử lý mất bao lâu.

Metric chính:

```text
finsight_http_request_duration_seconds
```

Metric này là histogram, dùng để tính p50/p95/p99.

## 4.2. `/metrics`

Endpoint:

```text
http://localhost:8000/metrics
```

Đây là nơi backend expose số liệu dạng Prometheus text format.

Bạn không đọc `/metrics` bằng mắt để phân tích hằng ngày. Prometheus sẽ scrape
endpoint này, rồi Grafana hiển thị đẹp hơn.

Production lưu ý:

```text
/metrics không nên public ra internet
```

Nó nên chỉ để Prometheus nội bộ truy cập.

## 4.3. Prometheus

Prometheus là nơi **lưu số liệu theo thời gian**.

Nó làm việc này:

```text
cứ mỗi 30 giây -> gọi backend /metrics -> lưu số liệu
```

Config local nằm ở:

```text
monitoring/prometheus/prometheus.yml
```

Alert rules nằm ở:

```text
monitoring/prometheus/alerts.yml
```

Mở local:

```text
http://localhost:9090
```

## 4.4. Grafana

Grafana là nơi **vẽ dashboard** từ dữ liệu Prometheus.

Mở local:

```text
http://localhost:3000
```

Dashboard cần xem:

```text
Finsight API Latency
```

Grafana không tự đo API. Nó chỉ query Prometheus rồi hiển thị.

## 4.5. k6

`k6` là tool tạo request test.

Nó dùng để trả lời:

```text
Nếu 5 user cùng gọi API trong 1 phút thì latency thế nào?
```

Nó không thay thế production monitoring. Nó chỉ giúp test trước khi deploy hoặc
test local.

## 5. Giải Thích Thuật Ngữ

## 5.1. API

API là endpoint backend cho frontend/mobile/tool gọi.

Ví dụ:

```text
GET /api/v1/transactions/all
POST /api/v1/auth/login
GET /api/v1/analytics/summary
```

## 5.2. Latency

Latency là thời gian từ lúc request bắt đầu đến lúc nhận response.

Ví dụ:

```text
GET /api/v1/transactions/all mất 120ms
```

thì latency là `120ms`.

Latency thấp thì app phản hồi nhanh. Latency cao thì user thấy chậm.

## 5.3. Duration

Trong Prometheus metric, duration là thời gian xử lý request, thường tính bằng
giây.

Ví dụ:

```text
0.12 seconds = 120ms
```

## 5.4. p50

p50 là median latency.

Nghĩa là 50% request nhanh hơn hoặc bằng mức này.

Ví dụ:

```text
p50 = 100ms
```

thì một nửa request phản hồi trong khoảng 100ms hoặc nhanh hơn.

## 5.5. p95

p95 nghĩa là 95% request nhanh hơn hoặc bằng mức này.

Ví dụ:

```text
p95 = 800ms
```

thì 95% request phản hồi trong 800ms hoặc nhanh hơn, còn 5% chậm hơn.

p95 rất quan trọng vì nó phản ánh trải nghiệm của nhóm user bị chậm, không chỉ
user trung bình.

## 5.6. p99

p99 nghĩa là 99% request nhanh hơn hoặc bằng mức này.

p99 giúp nhìn case xấu hơn p95. Nhưng nếu traffic ít, p99 có thể nhiễu.

Vì vậy khi xem p99 phải xem kèm request rate.

## 5.7. Request Rate

Request rate là số request mỗi giây.

Ví dụ:

```text
10 req/s
```

nghĩa là mỗi giây có khoảng 10 request.

Nếu latency cao nhưng request rate rất thấp, có thể chỉ là vài request lẻ. Nếu
latency cao và request rate cao, đó là vấn đề đáng chú ý hơn.

## 5.8. 5xx

`5xx` là nhóm HTTP status code lỗi server.

Ví dụ:

```text
500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
```

Nếu 5xx tăng, backend hoặc hạ tầng đang lỗi.

## 5.9. Route

Route là đường dẫn API đã được normalize.

Ví dụ tốt:

```text
/api/v1/transactions/:id
```

Ví dụ không nên dùng làm label:

```text
/api/v1/transactions/64fabc123...
```

Lý do: ID thật tạo ra quá nhiều label khác nhau, làm Prometheus tốn RAM và khó
đọc dashboard.

## 5.10. Label

Label là metadata gắn vào metric.

Ví dụ:

```text
method="GET"
route="/api/v1/auth/callback"
status_code="302"
```

Label giúp filter dashboard. Nhưng không được đưa dữ liệu nhạy cảm hoặc dữ liệu
quá nhiều biến thể vào label.

Không dùng các thứ này làm label:

- user ID;
- email;
- transaction ID;
- raw URL;
- request ID;
- amount;
- description.

## 5.11. Histogram

Histogram là loại metric dùng để đo phân phối latency.

Prometheus dùng histogram bucket để tính p50/p95/p99.

Metric:

```text
finsight_http_request_duration_seconds_bucket
```

Sau đó query bằng:

```promql
histogram_quantile(...)
```

## 5.12. PromQL

PromQL là ngôn ngữ query của Prometheus.

Ví dụ query p95:

```promql
histogram_quantile(
  0.95,
  sum by (le, route, method) (
    rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
  )
)
```

Bạn dùng PromQL trong Prometheus hoặc Grafana panel.

## 5.13. Scrape

Scrape nghĩa là Prometheus đi lấy metrics.

Ví dụ:

```text
Prometheus -> gọi http://backend:8000/metrics mỗi 30 giây
```

## 5.14. Dashboard

Dashboard là màn hình tổng hợp biểu đồ.

Trong feature này dashboard chính là:

```text
Finsight API Latency
```

## 5.15. Alert

Alert là rule cảnh báo.

Ví dụ:

```text
Nếu p95 toàn API > 1.5s trong 10 phút -> cảnh báo
```

Hiện tại alert rule nằm trong Prometheus. Muốn gửi thông báo ra Telegram/Email
thì cần setup thêm Alertmanager hoặc integration khác.

## 5.16. Smoke Test

Smoke test là test nhanh để kiểm tra hệ thống có chạy cơ bản không.

Ví dụ:

```text
GET /health
GET /ready
GET /api/v1/auth/callback
```

Smoke test không kiểm tra toàn bộ business logic.

## 5.17. Load Test

Load test là test tạo nhiều request hơn bình thường để xem hệ thống chịu tải
thế nào.

Ví dụ:

```text
5 virtual users chạy trong 1 phút
```

Load test local giúp phát hiện lỗi rõ ràng trước khi deploy. Nhưng production
traffic mới là số liệu thật nhất.

## 5.18. Virtual User

Virtual user, viết tắt là VU, là user giả do k6 tạo ra.

Ví dụ:

```text
LOAD_TEST_VUS=5
```

nghĩa là k6 giả lập 5 user cùng chạy scenario.

## 5.19. Scenario

Scenario là kịch bản test.

Trong k6 script có các scenario:

```text
smoke-public
smoke
read
write
all
auth-core
analytics-full
transaction-full
report-safe
all-safe
email-optional
provider-optional
password-mutation-optional
coverage-optional
coverage-all
```

Ví dụ `read` sẽ login rồi gọi các API đọc dữ liệu.

Scenario nên dùng để phủ rộng local là:

```text
all-safe
```

`all-safe` gọi các API chính nhưng không đổi password/email, không gửi email,
không scan receipt, và không gọi report/provider-heavy route.

Muốn phủ thêm gần hết route còn lại thì dùng:

```text
coverage-all
```

Nhưng scenario này cần flag riêng vì có thể gửi email, đổi password/email, upload
receipt hoặc dùng provider quota.

## 5.20. Production Monitoring

Production monitoring là theo dõi hệ thống thật đang phục vụ user thật.

Đây là nguồn latency chuẩn nhất vì có:

- dữ liệu thật;
- traffic thật;
- network thật;
- CPU/RAM thật;
- cache/DB thật.

## 6. Vì Sao Không Chỉ Dùng Postman

Postman tốt để gọi thử một API.

Ví dụ:

```text
POST /api/v1/auth/login
Time: 230ms
```

Nhưng Postman không đủ cho việc:

- đo p95/p99;
- chạy nhiều user song song;
- theo dõi production liên tục;
- tạo dashboard;
- alert khi API chậm.

Vì vậy:

```text
Postman    -> smoke/manual check
k6         -> load test local
Prometheus -> lưu số liệu
Grafana    -> dashboard
Production -> nguồn latency thật
```

## 7. Cách Chạy Local Từ Đầu

### 7.1. Chạy Backend

Đảm bảo `backend/.env` có:

```env
METRICS_ENABLED=true
METRICS_ROUTE=/metrics
```

Chạy:

```powershell
pnpm --dir backend run dev
```

### 7.2. Chạy Monitoring

Ở project root:

```powershell
docker compose --profile monitoring up -d
```

Mở:

```text
Prometheus: http://localhost:9090
Grafana:    http://localhost:3000
Metrics:    http://localhost:8000/metrics
```

### 7.3. Chạy k6 Smoke Public

```powershell
pnpm --dir backend run loadtest:api:public
```

Nếu terminal chưa nhận `k6`:

```powershell
& 'C:\Program Files\k6\k6.exe' run backend/load-tests/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

### 7.4. Kiểm Tra Prometheus

Query target:

```promql
up{job="finsight-backend"}
```

Kỳ vọng:

```text
1
```

Query request rate:

```promql
sum by (route, method) (
  rate(finsight_http_requests_total{route!~"/metrics|/health|/ready"}[5m])
)
```

Kỳ vọng thấy:

```text
GET /api/v1/auth/callback
```

Query route p95:

```promql
histogram_quantile(
  0.95,
  sum by (le, route, method) (
    rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
  )
)
```

Kỳ vọng `/api/v1/auth/callback` có số p95.

### 7.5. Kiểm Tra Grafana

Mở:

```text
http://localhost:3000
```

Dashboard:

```text
Finsight API Latency
```

Nếu chưa thấy data, chờ khoảng 30 giây cho Prometheus scrape.

## 8. Các File Chính Cần Nhớ

```text
backend/src/observability/http.metrics.ts
monitoring/prometheus/prometheus.yml
monitoring/prometheus/alerts.yml
monitoring/grafana/dashboards/finsight-api-latency.json
backend/load-tests/api-latency.k6.js
backend/load-tests/README.md
monitoring/README.md
```

## 9. Khi Lên Production Cần Nhớ

Với VPS 2 CPU / 8GB RAM:

```env
MONGO_MAX_POOL_SIZE=20
MONGO_MAX_POOL_SIZE_PER_CORE=10
MEMORY_THRESHOLD_MB=700
```

Monitoring:

```env
METRICS_ENABLED=true
METRICS_ROUTE=/metrics
```

Không public `/metrics` ra internet.

Không chạy load test mạnh vào production.

Sau khi production có traffic thật, xem dashboard rồi mới chỉnh threshold alert.

## 10. Kết Luận

Feature này không làm API tự nhanh hơn. Nó giúp bạn **nhìn thấy API nào nhanh,
API nào chậm, chậm ở mức nào, và khi nào cần điều tra tiếp**.

Workflow đúng là:

```text
Local: chạy k6 để bắt lỗi rõ ràng
Production: dùng Prometheus/Grafana để đo số liệu thật
Sau khi có baseline: chỉnh alert threshold và tối ưu endpoint chậm
```
