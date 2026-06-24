# Project Observability Foundation - Design

## Overview

The foundation separates four observability concerns:

```text
Structured logs -> detailed event stream
Sentry          -> unexpected exception investigation
Prometheus      -> numeric time-series storage
Grafana         -> dashboards and alerts
Node Exporter   -> whole-host/VPS resource metrics
```

Bull Board remains the operational interface for inspecting individual BullMQ
jobs. Health/readiness endpoints remain deployment probes.

Node Exporter is a host observer. It does not understand users, Receipt jobs,
Gemini requests or business outcomes.

## Selected approach

Build shared instrumentation in the backend, then integrate one reference
domain—Receipt. Do not instrument every domain in the same change.

This approach provides reusable contracts without creating a large,
high-risk rewrite.

## Alternatives considered

### Full-project instrumentation in one feature

Would provide broad coverage immediately, but changes every worker, provider and
HTTP path at once. Rejected because review, validation and rollback boundaries
would be too large.

### Infrastructure only

Would run Prometheus/Grafana without meaningful application metrics. Rejected
because it does not prove the instrumentation API.

### Foundation plus Receipt reference integration

Selected. It validates the common APIs through real queue/provider behavior and
allows Report and Transaction to migrate later.

## Backend modules

Suggested structure:

```text
backend/src/observability/
├── metrics.registry.ts
├── metrics.config.ts
├── http.metrics.ts
├── process.metrics.ts
├── bullmq.metrics.ts
├── provider.metrics.ts
├── sentry-background.ts
├── sanitization.ts
└── index.ts
```

The exact filenames may follow existing project conventions, but ownership must
remain explicit.

### Metrics registry

Responsibilities:

- own one custom `Registry`;
- register default process metrics once;
- export content type and serialized output;
- avoid duplicate metric registration in tests/hot reload;
- expose test reset utilities only in test builds.

### HTTP middleware

Record start time and active requests, then observe after response finish.

Route resolution priority:

1. matched Express route template;
2. router base path + route path;
3. bounded fallback such as `unmatched`;

Never use raw path strings containing IDs.

### BullMQ instrumentation

Instrumentation has two parts:

1. Lifecycle counters/histograms recorded by queue/worker events.
2. Periodic queue depth collector using `getJobCounts()`.

Use a small explicit registration API instead of monkey-patching BullMQ:

```ts
registerBullMQMetrics({
  queue,
  worker,
  queueName: 'receipt'
})
```

Domain handlers may record `skipped` because BullMQ itself sees skipped outcomes
as completed jobs.

### Provider instrumentation

Use a helper that measures one operation:

```ts
observeProviderCall(
  {
    provider: 'gemini',
    operation: 'receipt_extract'
  },
  () => callProvider()
)
```

The helper classifies errors into bounded classes:

```text
rate_limit
timeout
unavailable
validation
authentication
unknown
```

It rethrows the original error and does not decide retry policy.

### Background Sentry capture

Add a helper:

```ts
captureBackgroundError(error, {
  component: 'receipt_worker',
  queueName: 'receipt',
  eventType: 'final_failure',
  attempt: 3,
  maxAttempts: 3,
  correlationId
})
```

Only bounded fields become tags. High-cardinality identifiers stay in sanitized
context or are omitted.

The helper catches SDK errors and logs one warning without rethrowing.

### Sanitization

Use one recursive redaction policy for both Sentry and observability metadata.

Sensitive keys/patterns include:

```text
authorization
cookie
token
secret
apiKey
password
fileBuffer
base64
imageUrl
receiptUrl
email
amount
description
```

Large objects and arrays must be bounded or removed. Raw provider responses and
job payloads are never attached.

## Metric catalog

### HTTP

```text
finsight_http_requests_total{method,route,status_code}
finsight_http_request_duration_seconds{method,route,status_code}
finsight_http_active_requests{method,route}
```

### BullMQ

```text
finsight_bullmq_jobs_total{queue,job_name,outcome}
finsight_bullmq_job_processing_seconds{queue,job_name,outcome}
finsight_bullmq_job_wait_seconds{queue,job_name}
finsight_bullmq_queue_jobs{queue,state}
finsight_bullmq_worker_errors_total{queue,error_class}
```

`job_name` must come from a bounded declared set.

### Providers

```text
finsight_provider_requests_total{provider,operation,outcome,error_class}
finsight_provider_request_duration_seconds{provider,operation,outcome}
finsight_circuit_breaker_transitions_total{service,from_state,to_state}
```

### Receipt reference metrics

```text
finsight_receipt_cache_total{result}
finsight_receipt_scans_total{outcome}
```

Generic BullMQ/provider histograms already cover queue and processing duration;
do not create duplicate domain histograms without a distinct question.

## Histogram buckets

Initial HTTP buckets:

```text
0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5
```

Initial background/provider buckets:

```text
0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60
```

Buckets may change only after reviewing observed distributions.

## Sentry policy

### Capture

- HTTP `5xx`;
- worker infrastructure errors;
- domain-selected final failures;
- circuit breaker open;
- shutdown timeout.

### Do not capture

- expected `4xx`;
- ordinary retry attempts;
- cache misses;
- business skips;
- user-caused non-receipt errors;
- each individual provider `429`.

### Sampling

```text
Development normal use: 1.0
Development load tests: 0 or low value
Production initial: 0.1
```

Sampling is environment-configurable and never hardcoded by domain modules.

## Prometheus and Grafana

### Local

Docker profile:

```powershell
docker compose --profile monitoring up -d
```

Prometheus scrapes the backend host address available from Docker. Grafana is
provisioned with:

- Prometheus datasource;
- Project Overview dashboard;
- BullMQ dashboard;
- Receipt reference panel.

### Production

Nginx must not expose `/metrics` publicly. Prometheus reaches the backend over
the private Docker network.

Initial retention is seven days to limit NVMe usage. Persistent volumes remain
separate from application databases.

## Node Exporter

### Responsibility

Node Exporter answers host-capacity questions that backend `prom-client` cannot:

- Is the whole VPS CPU saturated?
- Is the host running out of RAM or swap?
- Is the NVMe filesystem almost full?
- Is disk I/O or network throughput under pressure?
- Is high application latency correlated with host pressure?

The data flow is:

```text
Backend /metrics ----┐
Node Exporter :9100 -+-> Prometheus -> Grafana
                     └-> Prometheus alert rules
```

### Deployment

Node Exporter is an optional Docker Compose monitoring service. Localhost may
publish `9100` for learning and troubleshooting. Production must keep it on the
private monitoring network and must not expose it through Nginx or a public
firewall rule.

The container requires read-only access to selected host filesystems and host
process information. Deployment must use the minimum mounts/collectors needed
for the VPS operating system.

### Dashboard

Add a `Finsight Host/VPS` dashboard with:

- CPU usage and load average;
- total/available memory;
- root filesystem usage;
- disk read/write throughput;
- network receive/transmit throughput;
- host uptime.

Do not mix user IDs, Receipt fields or application error messages into this
dashboard.

## Dashboard v1

Project Overview:

- request rate;
- HTTP p50/p95/p99;
- `5xx` rate;
- process CPU/RAM/event-loop lag;
- BullMQ waiting/active/failed by queue;
- provider request/error rate;
- circuit breaker states.

Host/VPS:

- CPU usage and load;
- memory availability;
- filesystem usage;
- disk I/O;
- network throughput;
- host uptime.

Receipt panel:

- scan outcomes;
- cache hit ratio;
- Receipt queue depth;
- Gemini/Cloudinary duration and errors.

## Alerts v1

Alerts should require sustained conditions to avoid noise:

- HTTP `5xx` ratio above threshold for five minutes;
- queue waiting above threshold for ten minutes;
- final failure increase;
- provider `429` sustained;
- circuit breaker open;
- event-loop lag sustained;
- process memory near configured limit;
- Prometheus target down.
- host CPU, memory or filesystem pressure from Node Exporter.

Exact thresholds remain environment configuration, not application code.

## Configuration

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

NODE_EXPORTER_ENABLED=true
NODE_EXPORTER_PORT=9100
```

All numeric application configuration must be validated centrally.

## Privacy and security

- No sensitive/high-cardinality metric labels.
- `/metrics` is private in production.
- Sentry scrubs all event surfaces.
- Grafana credentials are not committed.
- Prometheus/Grafana volumes do not contain application secrets.
- Dashboard links must not embed tokens.
- Metrics report classes and counts, not user-level activity.

## Testing strategy

- Registry initializes once.
- Duplicate imports/hot reload do not duplicate metrics.
- HTTP routes are normalized.
- Forbidden labels are absent.
- BullMQ metrics classify completed/skipped/retry/final failure correctly.
- Provider helper records duration/outcome and rethrows original error.
- Sentry background helper captures allowlisted events only.
- Recursive scrubbing removes receipt/provider secrets.
- Metrics/Sentry failure does not alter request/job result.
- Prometheus configuration validates.
- Grafana provisioning files parse and reference the correct datasource.
- Receipt reference integration produces expected metrics.

## Rollout

1. Add registry, configuration and `/metrics`.
2. Add process and HTTP metrics.
3. Add Sentry background helper and stronger scrubbing.
4. Add generic BullMQ metrics.
5. Add generic provider metrics.
6. Integrate Receipt as reference domain.
7. Add local Prometheus/Grafana profile and dashboards.
8. Verify resource usage.
9. Expand Report and Transaction in later domain features.
10. Add Node Exporter and the Host/VPS dashboard as a separate monitoring
    expansion.

## Risks

| Risk                                | Mitigation                                            |
| ----------------------------------- | ----------------------------------------------------- |
| Metric cardinality increases memory | Bounded label allowlists and tests                    |
| Sentry leaks receipt data           | Recursive scrubber and fixture tests                  |
| Metrics slow requests               | In-memory observations only; async queue polling      |
| Duplicate instrumentation           | One registry and explicit registration                |
| Monitoring consumes VPS resources   | 30s scrape, 7d retention, memory limits               |
| Node Exporter exposes host data     | Private network, no public port, minimal collectors   |
| Alert noise                         | Sustained conditions and separate retry/final signals |
| Foundation becomes a framework      | Keep helpers narrow; domain owns semantics            |
