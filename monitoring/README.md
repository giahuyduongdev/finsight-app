# Local monitoring

Start Redis, Prometheus, Grafana and Redis Exporter:

```powershell
docker compose --profile monitoring up -d
```

The local compose file binds Redis, Prometheus and Grafana to `127.0.0.1`.
They are reachable from your machine, but not exposed to other machines on the
LAN.

Redis Exporter is a private Docker-network scrape target for Prometheus.
Node Exporter is Linux/VPS-first and is not started by the default local command
because Docker Desktop on Windows may report the Docker VM rather than the
physical Windows host.

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
- `Finsight Performance`: API, Node.js, MongoDB pool, BullMQ, provider and
  Receipt performance signals.
- `Finsight Host/VPS`: CPU, load, memory, filesystem, disk, network and uptime.
- `Finsight Redis`: Redis memory, clients, commands/sec, keyspace hit/miss,
  evictions, rejected connections and uptime.

Stop the monitoring profile:

```powershell
docker compose --profile monitoring down
```

Remove monitoring data only:

```powershell
docker volume rm finsight_prometheus-data finsight_grafana-data
```

## Production monitoring

For production, do not publish `/metrics`, Redis, Prometheus or Grafana
publicly. Do not publish Node Exporter or Redis Exporter either. The compose
files bind Redis, Prometheus and Grafana to `127.0.0.1` on the host, and the
exporters stay private to the Docker network.

Run production monitoring with the override file:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring --profile host-monitoring up -d
```

The production override mounts
`monitoring/prometheus/prometheus.production.yml`; its default scrape target is
`backend-api:8000` on the private Docker network. It also scrapes
`node-exporter:9100` and `redis-exporter:9121`.

MongoDB remains on MongoDB Atlas. Use Atlas for database-level query, storage
and cluster metrics; Grafana only shows app-side MongoDB pool signals.

View Grafana from your local machine through an SSH tunnel:

```bash
ssh -L 3000:127.0.0.1:3000 user@your-vps-ip
```

Then open:

```text
http://localhost:3000
```

Alert thresholds are intentionally kept in
`monitoring/prometheus/alerts.yml` so each deployment can review and override
them alongside its actual VPS limits.

## API latency workflow

Use Postman for manual smoke checks and inspecting one response at a time. Use
the load-test harness for repeatable local checks:

```powershell
winget install GrafanaLabs.k6
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
