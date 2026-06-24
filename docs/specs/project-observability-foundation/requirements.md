# Project Observability Foundation - Requirements

## Status

Approved scope, ready for implementation planning.

## Context

The project already has structured logs, correlation IDs, health/readiness
checks, Bull Board, circuit breakers and basic Sentry capture for HTTP `5xx`.
However, it does not have a shared metrics endpoint, common BullMQ/provider
instrumentation or background-worker Sentry capture.

Individual features must not invent incompatible metric names, labels, privacy
rules or Sentry behavior. This feature creates the reusable foundation first
and proves it through Receipt integration.

## Goals

- Expose Prometheus-compatible application metrics.
- Standardize HTTP, Node.js process, BullMQ and provider instrumentation.
- Extend Sentry safely to background workers and scheduled jobs.
- Define privacy and cardinality rules shared by the entire backend.
- Provide optional local Prometheus and Grafana services.
- Define host-level VPS metrics through Node Exporter.
- Keep production defaults suitable for a 2 shared vCPU / 8 GB VPS.
- Instrument Receipt as the first reference domain.

## Non-goals

- Do not instrument every business domain in this feature.
- Do not replace existing structured logs, health checks or Bull Board.
- Do not create a custom monitoring platform.
- Do not collect logs in Prometheus.
- Do not add OpenTelemetry Collector, Loki, Elasticsearch or distributed trace
  infrastructure in the first phase.
- Do not use Node Exporter for application, user or Receipt domain metrics.
- Do not expose `/metrics` publicly in production.

## Functional requirements

### R1. Metrics registry and endpoint

The backend must use one shared `prom-client` registry.

It must expose:

```text
GET /metrics
```

Requirements:

- Prometheus text format;
- disabled when `METRICS_ENABLED=false`;
- open on localhost in development;
- restricted to the private monitoring network in production;
- metric collection failure must not fail application requests.

### R2. Metric naming and labels

Metric names must use a project prefix and Prometheus conventions:

```text
finsight_http_requests_total
finsight_http_request_duration_seconds
finsight_bullmq_jobs_total
finsight_provider_requests_total
```

Labels must be bounded enums or normalized route names.

Forbidden labels:

- user ID;
- email;
- request/correlation ID;
- job ID;
- image hash;
- filename;
- MongoDB document ID;
- raw URL/query;
- error message;
- financial data.

### R3. HTTP metrics

Collect:

- request count;
- response status class/code;
- request duration histogram;
- active request gauge.

Use normalized Express route templates, not raw paths. Health, readiness and
metrics routes may be excluded from primary product traffic metrics.

### R4. Node.js process metrics

Collect standard `prom-client` process metrics with a conservative interval:

- CPU;
- resident memory and heap;
- event-loop lag;
- garbage collection where supported;
- uptime.

Do not collect per-request heap snapshots or other expensive diagnostics.

### R5. BullMQ metrics

Provide reusable helpers/listeners for:

- enqueued;
- completed;
- skipped;
- retry attempt;
- final failure;
- permanent failure;
- processing duration;
- queue wait duration;
- worker infrastructure error;
- current waiting/active/delayed/failed counts.

Queue names and outcomes must be bounded labels. Queue depth polling must be
periodic and must not occur on every application request.

### R6. Provider metrics

Provide a wrapper/helper contract for external providers:

- Gemini;
- Cloudinary;
- Resend;
- future providers.

Collect:

- request count by provider, operation, outcome and safe error class;
- duration histogram;
- circuit-breaker state transition count.

Do not label metrics by model API key, recipient, filename or provider error
message.

### R7. Sentry foundation

Retain HTTP `5xx` capture and add a background-safe capture helper that does not
require an Express request.

Capture:

- worker infrastructure errors;
- unexpected scheduled/background task failures;
- terminal failures selected by a domain;
- circuit-breaker open events;
- graceful shutdown timeout.

Do not capture:

- ordinary retries;
- cache misses;
- expected business skips;
- user validation errors;
- every provider `429`.

### R8. Sentry privacy and release metadata

Sentry must scrub sensitive data from:

- headers and cookies;
- request body;
- query string;
- breadcrumbs;
- contexts;
- extras;
- raw job payloads.

Configure through environment:

```text
SENTRY_RELEASE
SENTRY_TRACES_SAMPLE_RATE
SENTRY_BACKGROUND_ERRORS_ENABLED
```

Production release must identify the deployed commit/version. Sentry failure
must remain best-effort and must never change request or job outcome.

### R9. Receipt reference integration

Receipt is the first domain to prove the foundation.

It must use foundation APIs for:

- queue lifecycle metrics;
- Gemini and Cloudinary provider metrics;
- cache hit/miss/corrupt metrics;
- processing and queue wait duration;
- final/infrastructure Sentry capture.

Receipt-specific metrics may be added, but they must follow foundation naming,
privacy and label rules.

### R10. Local monitoring stack

Docker Compose must provide an optional `monitoring` profile:

```text
Prometheus :9090
Grafana    :3000
```

Prometheus:

- scrape interval: 30 seconds;
- local retention: 7 days;
- scrape backend `/metrics`.

Grafana:

- provision Prometheus datasource;
- include a minimal project overview dashboard;
- use persistent volumes that can be removed independently.

### R11. Production monitoring profile

Initial VPS limits:

- Prometheus memory limit: approximately 512 MB;
- Grafana memory limit: approximately 256 MB;
- scrape interval: 30 seconds;
- retention: 7 days;
- `/metrics` private to the Docker monitoring network.

Monitoring may be disabled or moved externally without changing application
instrumentation.

### R12. Alerts

Initial alerts:

- elevated HTTP `5xx` rate;
- BullMQ final failures;
- queue backlog above configured threshold;
- provider `429`/failure rate;
- circuit breaker open;
- high event-loop lag;
- high process memory;
- metrics target unavailable.

Alert thresholds must be configurable and initially conservative.

### R13. Node Exporter host metrics

Node Exporter must be added as an optional monitoring service for localhost and
the production VPS.

It must expose host-level metrics for:

- total CPU usage and load average;
- total and available memory;
- filesystem capacity and free space;
- disk read/write activity;
- network receive/transmit activity;
- host uptime.

Requirements:

- Prometheus scrapes Node Exporter through the monitoring network;
- the Node Exporter port is not publicly exposed in production;
- collectors use a bounded allowlist suitable for the deployment host;
- virtual, temporary and container-only filesystems are excluded where
  practical;
- Grafana includes a host/VPS dashboard;
- alerts cover sustained host CPU, memory and filesystem pressure.

Node Exporter complements, but does not replace, backend `prom-client` metrics:

```text
prom-client   -> Node.js process, HTTP, BullMQ, provider and domain metrics
Node Exporter -> whole VPS CPU, memory, disk, network and filesystem metrics
```

## Acceptance criteria

- `/metrics` exposes valid Prometheus output.
- Raw user IDs, job IDs, URLs and financial data never appear as labels.
- HTTP metrics use normalized routes.
- BullMQ queue lifecycle metrics are reusable across all workers.
- Background errors can be captured by Sentry without an Express request.
- Sentry scrubbing covers body, query, breadcrumbs, contexts and extras.
- Receipt uses the foundation without owning duplicate infrastructure.
- Prometheus and Grafana start through an optional local Docker profile.
- Dashboard displays HTTP, process, BullMQ and Receipt reference metrics.
- Host dashboard displays CPU, memory, disk, filesystem and network metrics
  when Node Exporter is enabled.
- Metrics/Sentry failures do not change application behavior.
- Tests, lint, typecheck and build pass.

## Success criteria

- New domains can add metrics without creating their own registry or naming
  conventions.
- Production incidents can be investigated through Sentry while capacity and
  trends are measured through Prometheus/Grafana.
- The foundation remains small enough to run on localhost and the planned VPS.
