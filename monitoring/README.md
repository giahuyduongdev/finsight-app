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
