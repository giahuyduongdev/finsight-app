# Local monitoring

Start Redis, Prometheus and Grafana:

```powershell
docker compose --profile monitoring up -d
```

The backend must run on port `8000` with:

```env
METRICS_ENABLED=true
METRICS_ROUTE=/metrics
```

Open:

- Backend metrics: <http://localhost:8000/metrics>
- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3000>

Useful dashboards:

- `Finsight Overview`: project-level request, queue, provider and receipt
  panels.
- `Finsight API Latency`: p50/p95/p99, slowest endpoints, request rate and
  status-code breakdown by normalized API route.

Stop the monitoring profile:

```powershell
docker compose --profile monitoring down
```

Remove monitoring data only:

```powershell
docker volume rm finsight_prometheus-data finsight_grafana-data
```

For production, do not publish `/metrics` publicly. Prometheus should scrape the
backend through the private Docker network. Mount
`monitoring/prometheus/prometheus.production.yml` instead of the local config;
its default target is `backend-api:8000`.

Alert thresholds are intentionally kept in
`monitoring/prometheus/alerts.yml` so each deployment can review and override
them alongside its actual VPS limits.

## API latency workflow

Use Postman for manual smoke checks and inspecting one response at a time. Use
the load-test harness for repeatable local checks:

```powershell
winget install k6.k6
```

```powershell
pnpm --dir backend run loadtest:api:public
```

Authenticated scenarios require a dedicated test user:

```powershell
$env:BASE_URL='http://localhost:8000'
$env:TEST_USER_EMAIL='test@example.com'
$env:TEST_USER_PASSWORD='change-me'
$env:LOAD_TEST_SCENARIO='read'
$env:LOAD_TEST_VUS='5'
$env:LOAD_TEST_DURATION='1m'
pnpm --dir backend run loadtest:api
```

With one VPS, do not run high-concurrency load tests against production. Use
local load tests before deploy, then use the production `Finsight API Latency`
dashboard as the source of truth for real p50/p95/p99 latency.
