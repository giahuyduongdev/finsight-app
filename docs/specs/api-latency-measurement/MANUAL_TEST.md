# API Latency Measurement - Những Gì Đã Làm Và Cách Manual Test

## Đã Thêm Những Gì

### Spec

- Tạo `docs/specs/api-latency-measurement/requirements.md`.
- Tạo `docs/specs/api-latency-measurement/design.md`.
- Tạo `docs/specs/api-latency-measurement/tasks.md`.
- Tạo `docs/specs/api-latency-measurement/sequence.mmd`.
- Cập nhật spec theo tình hình infra hiện tại:
  - test latency local trước;
  - production monitoring là nguồn số liệu chuẩn;
  - staging để optional sau này.

### Grafana

- Thêm dashboard:

```text
monitoring/grafana/dashboards/finsight-api-latency.json
```

Dashboard có:

- p95 latency toàn API;
- p50/p95/p99 theo route;
- bảng endpoint chậm nhất theo p95;
- request rate;
- 5xx rate;
- breakdown theo status code;
- filter theo route và method.

### Prometheus Alerts

- Cập nhật:

```text
monitoring/prometheus/alerts.yml
```

Đã thêm:

- alert khi p95 toàn API cao;
- alert khi p95 của một route cao;
- route-level 5xx alert phục vụ workflow đo latency.

### k6 Load Tests

- Thêm:

```text
backend/load-tests/api-latency.k6.js
backend/load-tests/README.md
```

- Thêm script trong `backend/package.json`:

```powershell
pnpm --dir backend run loadtest:api
pnpm --dir backend run loadtest:api:public
```

Các scenario hiện có:

```text
smoke-public  health/readiness + auth redirect public, không cần credential
smoke         health/readiness + login
read          smoke + các API read có auth
write         smoke + tạo/sửa/xóa transaction test
all           smoke + read + write
```

### Docs

- Cập nhật `monitoring/README.md`.
- Ghi rõ Postman chỉ dùng để smoke/manual check, không dùng làm nguồn đo p95/p99 chính.
- Ghi rõ production Grafana/Prometheus là nguồn số liệu latency thật.
- Ghi đúng lệnh cài k6 trên Windows:

```powershell
winget install GrafanaLabs.k6
```

## Đã Verify Những Gì

Các lệnh sau đã chạy pass:

```powershell
pnpm --dir backend run lint
pnpm --dir backend run type-check
pnpm --dir backend run build
pnpm --dir backend run test:unit
```

Prometheus config/rules đã được validate bằng `promtool` trong Docker image local:

```powershell
docker run --rm -v "%cd%\monitoring\prometheus:/etc/prometheus:ro" --entrypoint /bin/promtool prom/prometheus:v3.4.1 check rules /etc/prometheus/alerts.yml
docker run --rm -v "%cd%\monitoring\prometheus:/etc/prometheus:ro" --entrypoint /bin/promtool prom/prometheus:v3.4.1 check config /etc/prometheus/prometheus.yml
```

`k6` public smoke test đã chạy pass:

```powershell
& 'C:\Program Files\k6\k6.exe' run backend/load-tests/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

Kết quả đã quan sát:

```text
http_req_failed: 0.00%
http_req_duration p95: khoảng 52.55ms
checks: 825 passed, 0 failed
```

Prometheus cũng đã được query và xác nhận:

- backend target là `up=1`;
- route `/api/v1/auth/callback` có request-rate data;
- route `/api/v1/auth/callback` có p95 latency data.

## Manual Test Nhanh

### 1. Kiểm Tra k6

Sau khi cài `k6`, mở terminal mới rồi chạy:

```powershell
k6 version
```

Nếu terminal hiện tại chưa nhận `k6` trong PATH:

```powershell
& 'C:\Program Files\k6\k6.exe' version
```

### 2. Chạy Backend

Backend cần bật metrics.

Env cần có:

```env
METRICS_ENABLED=true
METRICS_ROUTE=/metrics
```

Sau đó chạy backend như bình thường:

```powershell
pnpm --dir backend run dev
```

### 3. Chạy Local Monitoring

Mở terminal khác:

```powershell
docker compose --profile monitoring up -d
```

Mở các URL:

```text
Prometheus: http://localhost:9090
Grafana:    http://localhost:3000
Metrics:    http://localhost:8000/metrics
```

### 4. Chạy Public Smoke Load Test

Lệnh này không cần test account:

```powershell
pnpm --dir backend run loadtest:api:public
```

Nếu PATH chưa nhận `k6`:

```powershell
& 'C:\Program Files\k6\k6.exe' run backend/load-tests/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

Kỳ vọng:

```text
http_req_failed < 1%
http_req_duration p95 < 1000ms
checks_succeeded 100%
```

### 5. Kiểm Tra Prometheus Target

Mở:

```text
http://localhost:9090
```

Chạy query:

```promql
up{job="finsight-backend"}
```

Kỳ vọng:

```text
1
```

### 6. Kiểm Tra Request Rate Theo API Route

Chạy query:

```promql
sum by (route, method) (
  rate(finsight_http_requests_total{route!~"/metrics|/health|/ready"}[5m])
)
```

Kỳ vọng sau khi chạy `smoke-public`:

```text
GET /api/v1/auth/callback
```

có giá trị khác `0`.

### 7. Kiểm Tra p95 Theo Route

Chạy query:

```promql
histogram_quantile(
  0.95,
  sum by (le, route, method) (
    rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
  )
)
```

Kỳ vọng sau khi chạy `smoke-public`:

```text
GET /api/v1/auth/callback
```

có p95 dạng số, không phải `NaN`.

### 8. Kiểm Tra Grafana Dashboard

Mở:

```text
http://localhost:3000
```

Dashboard cần xem:

```text
Finsight API Latency
```

Kiểm tra các panel:

- `Whole API p95 latency`;
- `Route latency percentiles`;
- `Slowest endpoints by p95`;
- `Endpoint request volume`.

Sau khi chạy `smoke-public`, route `/api/v1/auth/callback` nên xuất hiện vì đây
là product route, không bị exclude như `/health`, `/ready`, `/metrics`.

## Manual Test Scenario Có Auth

Chỉ dùng phần này sau khi tạo một local test user riêng. Không dùng production
account và không dùng dữ liệu tài chính thật.

Set env:

```powershell
$env:BASE_URL='http://localhost:8000'
$env:TEST_USER_EMAIL='test@example.com'
$env:TEST_USER_PASSWORD='change-me'
$env:LOAD_TEST_SCENARIO='read'
$env:LOAD_TEST_VUS='5'
$env:LOAD_TEST_DURATION='1m'
```

Chạy read scenario:

```powershell
pnpm --dir backend run loadtest:api
```

Chạy write scenario:

```powershell
$env:LOAD_TEST_SCENARIO='write'
pnpm --dir backend run loadtest:api
```

Chạy full local scenario:

```powershell
$env:LOAD_TEST_SCENARIO='all'
pnpm --dir backend run loadtest:api
```

## Lưu Ý Khi Lên Production

- Không chạy load test concurrency cao vào production.
- Dùng production Grafana/Prometheus làm nguồn số liệu thật cho p50/p95/p99.
- Không expose `/metrics` public.
- Chỉnh threshold alert sau khi có baseline production.

## Troubleshooting

### `k6` Không Được Nhận

Mở terminal mới hoặc chạy trực tiếp:

```powershell
& 'C:\Program Files\k6\k6.exe' version
```

### Prometheus Target Down

Kiểm tra:

- backend đang chạy port `8000`;
- `METRICS_ENABLED=true`;
- Docker monitoring profile đang chạy;
- `monitoring/prometheus/prometheus.yml` target là
  `host.docker.internal:8000`.

### Dashboard Không Có Product Route Data

Chạy:

```powershell
pnpm --dir backend run loadtest:api:public
```

Sau đó chờ Prometheus scrape, thường tối đa khoảng 30 giây.

### p95 Là `NaN`

Thường là vì trong time window đang chọn chưa có request sample phù hợp. Chạy
`k6` để tạo traffic rồi query lại.
