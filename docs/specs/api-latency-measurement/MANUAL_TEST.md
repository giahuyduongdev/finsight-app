# API Latency Measurement - Implementation and Manual Test

## What Was Added

### Spec

- Created `docs/specs/api-latency-measurement/requirements.md`.
- Created `docs/specs/api-latency-measurement/design.md`.
- Created `docs/specs/api-latency-measurement/tasks.md`.
- Created `docs/specs/api-latency-measurement/sequence.mmd`.
- Updated the spec to match the current infra reality: local load testing first,
  production monitoring as the source of truth, staging optional later.

### Grafana

- Added `monitoring/grafana/dashboards/finsight-api-latency.json`.
- Dashboard includes:
  - whole-API p95 latency;
  - route p50/p95/p99;
  - slowest endpoints by p95;
  - request rate;
  - 5xx rate;
  - status-code breakdown;
  - route and method filters.

### Prometheus Alerts

- Updated `monitoring/prometheus/alerts.yml`.
- Added:
  - whole-API p95 latency alert;
  - route-level p95 latency alert;
  - route-level 5xx alert coverage already fits the latency workflow.

### k6 Load Tests

- Added `backend/load-tests/api-latency.k6.js`.
- Added `backend/load-tests/README.md`.
- Added backend scripts:
  - `pnpm --dir backend run loadtest:api`
  - `pnpm --dir backend run loadtest:api:public`

Supported scenarios:

```text
smoke-public  health/readiness plus public auth redirect, no credentials
smoke         health/readiness plus login
read          smoke plus authenticated read APIs
write         smoke plus disposable transaction create/update/delete
all           smoke, read and write
```

### Docs

- Updated `monitoring/README.md` with the local latency workflow.
- Documented that Postman is for smoke checks only.
- Documented that production Grafana is the source of truth for real latency.
- Documented the correct Windows install command:

```powershell
winget install GrafanaLabs.k6
```

## Verification Already Run

The following checks were run successfully:

```powershell
pnpm --dir backend run lint
pnpm --dir backend run type-check
pnpm --dir backend run build
pnpm --dir backend run test:unit
```

Prometheus validation was run through the local Docker image:

```powershell
docker run --rm -v "%cd%\monitoring\prometheus:/etc/prometheus:ro" --entrypoint /bin/promtool prom/prometheus:v3.4.1 check rules /etc/prometheus/alerts.yml
docker run --rm -v "%cd%\monitoring\prometheus:/etc/prometheus:ro" --entrypoint /bin/promtool prom/prometheus:v3.4.1 check config /etc/prometheus/prometheus.yml
```

`k6` public smoke test was run successfully:

```powershell
& 'C:\Program Files\k6\k6.exe' run backend/load-tests/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

Observed result from the successful run:

```text
http_req_failed: 0.00%
http_req_duration p95: about 52.55ms
checks: 825 passed, 0 failed
```

Prometheus was also queried and confirmed:

- backend target was `up=1`;
- route `/api/v1/auth/callback` had request-rate data;
- route `/api/v1/auth/callback` had p95 latency data.

## Manual Test - Quick Path

### 1. Confirm k6 Is Available

Open a new terminal after installing `k6`, then run:

```powershell
k6 version
```

If the current terminal does not know `k6` yet:

```powershell
& 'C:\Program Files\k6\k6.exe' version
```

### 2. Start Backend

Run the backend with metrics enabled.

Required env:

```env
METRICS_ENABLED=true
METRICS_ROUTE=/metrics
```

Then start backend as usual:

```powershell
pnpm --dir backend run dev
```

### 3. Start Local Monitoring

In another terminal:

```powershell
docker compose --profile monitoring up -d
```

Open:

```text
Prometheus: http://localhost:9090
Grafana:    http://localhost:3000
Metrics:    http://localhost:8000/metrics
```

### 4. Run Public Smoke Load Test

This does not need test credentials:

```powershell
pnpm --dir backend run loadtest:api:public
```

If PATH does not include `k6` yet:

```powershell
& 'C:\Program Files\k6\k6.exe' run backend/load-tests/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

Expected:

```text
http_req_failed < 1%
http_req_duration p95 < 1000ms
checks_succeeded 100%
```

### 5. Check Prometheus Target

Open Prometheus:

```text
http://localhost:9090
```

Run:

```promql
up{job="finsight-backend"}
```

Expected:

```text
1
```

### 6. Check API Request Rate

Run:

```promql
sum by (route, method) (
  rate(finsight_http_requests_total{route!~"/metrics|/health|/ready"}[5m])
)
```

Expected:

```text
GET /api/v1/auth/callback
```

with a non-zero value after `smoke-public`.

### 7. Check Route p95 Latency

Run:

```promql
histogram_quantile(
  0.95,
  sum by (le, route, method) (
    rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
  )
)
```

Expected:

```text
GET /api/v1/auth/callback
```

with a numeric p95 value.

### 8. Check Grafana Dashboard

Open:

```text
http://localhost:3000
```

Dashboard:

```text
Finsight API Latency
```

Check:

- `Whole API p95 latency`;
- `Route latency percentiles`;
- `Slowest endpoints by p95`;
- `Endpoint request volume`.

After `smoke-public`, `/api/v1/auth/callback` should appear because it is a
product route and is not excluded like `/health`, `/ready` or `/metrics`.

## Manual Test - Authenticated Scenarios

Use this only after creating a dedicated local test user. Do not use production
accounts or real financial data.

Set env:

```powershell
$env:BASE_URL='http://localhost:8000'
$env:TEST_USER_EMAIL='test@example.com'
$env:TEST_USER_PASSWORD='change-me'
$env:LOAD_TEST_SCENARIO='read'
$env:LOAD_TEST_VUS='5'
$env:LOAD_TEST_DURATION='1m'
```

Run:

```powershell
pnpm --dir backend run loadtest:api
```

Write scenario:

```powershell
$env:LOAD_TEST_SCENARIO='write'
pnpm --dir backend run loadtest:api
```

Full local scenario:

```powershell
$env:LOAD_TEST_SCENARIO='all'
pnpm --dir backend run loadtest:api
```

## Production Notes

- Do not run high-concurrency load tests against production.
- Use production Grafana/Prometheus as the source of truth for real p50/p95/p99.
- Keep `/metrics` private in production.
- Tune alert thresholds after production baseline data exists.

## Troubleshooting

### `k6` Is Not Recognized

Open a new terminal or run:

```powershell
& 'C:\Program Files\k6\k6.exe' version
```

### Prometheus Target Is Down

Check:

- backend is running on port `8000`;
- `METRICS_ENABLED=true`;
- Docker monitoring profile is running;
- `monitoring/prometheus/prometheus.yml` target is
  `host.docker.internal:8000`.

### Dashboard Shows No Product Route Data

Run:

```powershell
pnpm --dir backend run loadtest:api:public
```

Then wait for the Prometheus scrape interval, usually up to 30 seconds.

### p95 Is `NaN`

This usually means no matching request samples exist in the selected time
window. Generate traffic with `k6`, then query again.
