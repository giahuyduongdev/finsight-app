# Host and Redis Observability - Design

## Overview

This feature adds the missing infrastructure-level visibility around the
existing Finsight application metrics.

```text
Backend /metrics      -> Prometheus -> Grafana app dashboards
Node Exporter :9100   -> Prometheus -> Finsight Host/VPS
Redis Exporter :9121  -> Prometheus -> Finsight Redis
MongoDB Atlas         -> Atlas UI for database-level metrics
```

MongoDB remains managed by Atlas. Grafana keeps app-side MongoDB pool metrics in
`Finsight Performance`; Atlas remains the source of truth for cluster CPU,
storage, slow queries, and database operation metrics.

## Compose Services

### Node Exporter

Use `prom/node-exporter` for Linux host metrics. The container mounts the host
filesystem read-only and uses `--path.rootfs=/host`.

Node Exporter uses the `host-monitoring` profile so the default Windows local
monitoring command does not try to mount the host root filesystem. It is not
published through `ports`. Prometheus reaches it over the Compose network at:

```text
node-exporter:9100
```

### Redis Exporter

Use `oliver006/redis_exporter` to expose Redis metrics.

The exporter connects to:

```text
redis://redis:6379
```

The Redis password comes from:

```text
REDIS_PASSWORD
```

Redis Exporter is not published through `ports`. Prometheus reaches it over the
Compose network at:

```text
redis-exporter:9121
```

## Prometheus Scrape Config

Local config keeps backend scraping through:

```text
host.docker.internal:8000
```

Production config scrapes:

```text
backend-api:8000
node-exporter:9100
redis-exporter:9121
```

Run production with both profiles:

```text
--profile monitoring --profile host-monitoring
```

## Dashboards

### Finsight Host/VPS

Panels:

- CPU usage;
- load average;
- memory used and available;
- filesystem usage;
- disk read/write throughput;
- network receive/transmit throughput;
- uptime.

This dashboard answers whether the VPS itself is under pressure.

### Finsight Redis

Panels:

- memory used;
- maxmemory;
- memory used percentage;
- connected clients;
- commands per second;
- keyspace hit/miss rate;
- evicted and expired keys;
- blocked clients;
- uptime.

This dashboard answers whether Redis is close to memory pressure or command
pressure. BullMQ queue depth remains in `Finsight Performance` and
`Finsight BullMQ`.

## Alerts

Add conservative alert candidates:

- host available memory below 10 percent for 10 minutes;
- root filesystem usage above 85 percent for 15 minutes;
- Redis memory above 85 percent of configured maxmemory for 10 minutes;
- Redis evictions observed over 5 minutes;
- Redis rejected connections observed over 5 minutes.

## Security

Do not publish Node Exporter or Redis Exporter ports.

Keep Grafana and Prometheus bound to `127.0.0.1`; use SSH tunneling or another
private access layer for production access.

Redis remains password-protected and not publicly reachable.

## Risks

| Risk                                      | Mitigation                                      |
| ----------------------------------------- | ----------------------------------------------- |
| Node Exporter on Windows local is noisy   | Treat Host/VPS dashboard as Linux/VPS-first     |
| Redis password leaks in config            | Read password from environment only             |
| Exporters are exposed publicly            | Do not use public `ports` for exporter services |
| Alerts are noisy before baseline exists   | Use conservative thresholds and review later    |
| VPS resources are tight with monitoring   | Keep 30s scrape and short retention             |
