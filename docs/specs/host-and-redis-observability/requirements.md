# Host and Redis Observability - Requirements

## Introduction

Finsight already exposes application metrics for HTTP, Node.js runtime, BullMQ,
providers, Receipt, and MongoDB pool usage. Production still needs host-level
VPS visibility and Redis engine visibility so operators can answer whether API
latency or queue pressure is caused by CPU, memory, disk, network, or Redis
resource pressure.

MongoDB remains on MongoDB Atlas. This feature does not move MongoDB into the
VPS and does not duplicate Atlas database-level monitoring.

## Goals

- Add Linux/VPS host metrics through Node Exporter.
- Add Redis metrics through Redis Exporter.
- Provide Grafana dashboards for host/VPS and Redis health.
- Keep exporters private to the Docker network.
- Keep local development usable while making production Compose ready.
- Add conservative alert candidates for host and Redis pressure.

## Non-goals

- Do not run MongoDB in Docker.
- Do not add MongoDB Atlas API integration.
- Do not add cAdvisor or full container-level monitoring in this slice.
- Do not expose exporter, Prometheus, Grafana, Redis, or `/metrics` publicly.
- Do not replace MongoDB Atlas dashboards for database-level query/storage
  metrics.

## Deployment Assumptions

Production default:

- `backend-api` runs as a Docker service on the VPS.
- `redis` runs as a Docker service on the VPS.
- Prometheus, Grafana, Node Exporter, and Redis Exporter run as Docker services.
- MongoDB is MongoDB Atlas.
- Nginx is the only public ingress on ports `80` and `443`.
- Grafana is reached through SSH tunnel or another private access layer.

Local development:

- backend may run outside Docker with `pnpm.cmd --dir backend run dev`;
- Redis, Prometheus, Grafana, and Redis Exporter can run through Compose;
- Node Exporter is Linux/VPS-first and uses the `host-monitoring` profile so it
  is not started by the default Windows local command.

## Functional Requirements

### R1. Node Exporter

Compose must define a `node-exporter` service for Linux/VPS host metrics under
the `host-monitoring` profile.

Prometheus must scrape:

```text
node-exporter:9100
```

Node Exporter must remain private to the Docker network.

### R2. Redis Exporter

Compose must define a `redis-exporter` service that connects to the internal
Redis service:

```text
redis://redis:6379
```

It must use `REDIS_PASSWORD` from the environment and must not expose the
password in committed files.

Prometheus must scrape:

```text
redis-exporter:9121
```

Redis Exporter must remain private to the Docker network.

### R3. Finsight Host/VPS Dashboard

Grafana must include a `Finsight Host/VPS` dashboard with:

- CPU usage;
- load average;
- memory available and used;
- filesystem usage;
- disk read/write throughput;
- network receive/transmit throughput;
- host uptime.

### R4. Finsight Redis Dashboard

Grafana must include a `Finsight Redis` dashboard with:

- memory used;
- configured max memory;
- memory used percentage;
- connected clients;
- commands per second;
- keyspace hits and misses;
- evicted keys;
- expired keys;
- blocked clients;
- Redis uptime.

### R5. Alerts

Prometheus alert candidates must cover:

- host memory low;
- root filesystem near full;
- Redis memory close to configured max memory;
- Redis evictions;
- Redis rejected connections.

Thresholds must be conservative and reviewed after VPS baseline data exists.

### R6. Privacy and Security

Exporters must not be published through public ports.

Grafana and Prometheus remain bound to `127.0.0.1` on the host for SSH tunnel
access. Redis remains bound to `127.0.0.1` for local development and private
Docker network access for containerized production services.

## Acceptance Criteria

- Docker Compose config renders for local monitoring.
- Docker Compose config renders with the production override.
- Prometheus scrapes backend, Node Exporter, and Redis Exporter in production
  config when `monitoring` and `host-monitoring` profiles are enabled.
- Grafana provisioning loads `Finsight Host/VPS` and `Finsight Redis`.
- Redis password remains environment-driven.
- No new monitoring port is publicly bound.
- Documentation explains local and production commands.
