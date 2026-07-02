# API Latency Measurement - Design

Status: Draft.

## Overview

This feature builds on `project-observability-foundation`. The backend already
has HTTP duration metrics, a Prometheus scrape endpoint and Grafana provisioning.
This design adds the practical layer needed to measure API responsiveness:

- production dashboard panels for endpoint latency;
- canonical PromQL queries for p50, p95 and p99;
- alert rules for sustained latency problems;
- a repeatable load-test workflow for pre-release checks;
- documentation that separates Postman smoke tests from load testing and
  production monitoring.

Production monitoring is the source of truth. Local load tests are the first
early-warning tool while the project has only one VPS. Staging remains optional
future infrastructure.

## Architecture

```text
Postman smoke checks        -> Backend API
k6/autocannon load tests    -> Backend API
Client/real production use  -> Backend API

Backend httpMetricsMiddleware
  -> finsight_http_request_duration_seconds
  -> /metrics
  -> Prometheus
  -> Grafana dashboards and alerts
```

The feature should not create a second HTTP timing middleware unless the current
middleware cannot support route-level latency safely. Any fixes to route
normalization should be made inside the existing observability module.

## Components

### Backend HTTP metrics

Existing owner:

```text
backend/src/observability/http.metrics.ts
```

Responsibilities:

- record request duration in seconds;
- use normalized route labels;
- exclude non-product routes;
- preserve bounded labels;
- keep measurement best-effort and non-blocking.

Implementation should verify that dynamic routes such as
`/api/v1/transactions/:id` do not become one metric series per ID.

### Prometheus

Existing owner:

```text
monitoring/prometheus/
```

Responsibilities:

- scrape backend `/metrics`;
- evaluate latency and error alerts;
- retain local and production data long enough for release comparison.

### Grafana dashboard

Existing owner:

```text
monitoring/grafana/dashboards/
```

Add or extend a dashboard with API latency panels:

- whole-API p95 latency;
- p50/p95/p99 by selected route;
- slowest routes by p95;
- request rate by route;
- `5xx` rate by route;
- status-code breakdown.

Panel variables should include bounded values only:

```text
route
method
status_code
```

### Load-test scripts

Suggested owner:

```text
backend/load-tests/
```

Preferred first tool:

```text
k6
```

Rationale:

- scenarios can be committed as code;
- thresholds can fail a release check;
- environment variables support local targets and optional staging targets;
- results include percentile latency and error rates.

Acceptable first-pass alternative:

```text
autocannon
```

Use `autocannon` only if the first implementation needs the smallest possible
dependency footprint. It is better for quick endpoint pressure tests than full
multi-step authenticated flows.

### Documentation

Update monitoring or backend documentation with:

- how to run smoke checks;
- how to run local load tests;
- how to read the Grafana dashboard;
- how to compare local baseline and production results;
- why production latency is the final source of truth.

## Data Flow

1. A client, Postman or load-test script calls a backend API.
2. `httpMetricsMiddleware` records start time and observes duration after the
   response finishes.
3. The metric is exported through `/metrics`.
4. Prometheus scrapes `/metrics`.
5. Grafana queries Prometheus for route-level latency percentiles.
6. Alerts evaluate sustained latency or error conditions.
7. Release verification compares local load-test results with baseline
   expectations.

## PromQL Query Catalog

### Whole-API p95

```promql
histogram_quantile(
  0.95,
  sum by (le) (
    rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
  )
)
```

### Route-level p95

```promql
histogram_quantile(
  0.95,
  sum by (le, route, method) (
    rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
  )
)
```

### Route-level p50 and p99

Use the same query shape as route-level p95 with quantiles `0.50` and `0.99`.

### Request rate by route

```promql
sum by (route, method) (
  rate(finsight_http_requests_total{route!~"/metrics|/health|/ready"}[5m])
)
```

### Route-level 5xx rate

```promql
sum by (route, method) (
  rate(finsight_http_requests_total{status_code=~"5.."}[5m])
)
```

### Slowest routes by p95

```promql
topk(
  10,
  histogram_quantile(
    0.95,
    sum by (le, route, method) (
      rate(finsight_http_request_duration_seconds_bucket{route!~"/metrics|/health|/ready"}[5m])
    )
  )
)
```

## Load-Test Design

### Environment variables

Initial variables:

```text
BASE_URL
TEST_USER_EMAIL
TEST_USER_PASSWORD
LOAD_TEST_VUS
LOAD_TEST_DURATION
LOAD_TEST_SCENARIO
```

Optional variables for provider-heavy scenarios:

```text
ENABLE_PROVIDER_SCENARIOS
RECEIPT_FIXTURE_PATH
```

### Scenario groups

#### Smoke

Purpose: confirm the target is reachable and auth works.

Examples:

- `GET /health`;
- `GET /ready`;
- `POST /api/v1/auth/login`.

#### Read-heavy API

Purpose: approximate normal app browsing.

Examples:

- current user/profile;
- dashboard/analytics summary;
- transaction list;
- report list or report settings.

#### Write API with disposable data

Purpose: exercise validation, database write paths and cleanup.

Examples:

- create transaction;
- update transaction;
- delete transaction.

The scenario must create data with a test marker and clean up after itself where
possible.

#### Optional expensive/provider API

Purpose: measure provider-backed APIs only when cost and fixtures are controlled.

Examples:

- receipt scan with a safe fixture;
- report generation if it calls external services.

These must be disabled by default.

### Thresholds

Initial load-test thresholds should be conservative until the project has real
baseline data.

Example policy:

```text
http_req_failed < 1%
p95 for smoke/read scenarios < agreed staging threshold
no unexpected 5xx responses
```

Do not hardcode final production SLOs in the first implementation. Establish
baseline first, then tighten thresholds.

## API Design

No new product API endpoints are required.

The feature relies on existing endpoints:

```text
GET /metrics
GET /health
GET /ready
```

Product APIs remain unchanged. Load tests call public application APIs through
the same contracts used by clients.

## Error Handling

- Metrics collection failure must not fail API requests.
- Prometheus scrape failure should surface as a target-down alert.
- Load-test auth failure should fail the test early with a clear message.
- Provider-backed scenarios should skip when required fixtures or enable flags
  are missing.
- A route with too little traffic should be interpreted together with request
  rate before treating p99 as meaningful.

## Testing Strategy

### Unit tests

Add or extend backend observability tests if route normalization changes.

Important checks:

- dynamic IDs do not appear in route labels;
- excluded routes are not counted in product traffic panels;
- metrics middleware does not change response behavior.

### Dashboard/config validation

Validate that:

- Grafana JSON parses;
- Prometheus alert rules parse;
- dashboard panels reference existing metric names;
- variables do not expose sensitive labels.

### Load-test verification

Run the load-test suite against local with seeded credentials. The same scripts
can target staging later by changing `BASE_URL`.

Validate:

- login/setup works;
- scenarios produce request volume;
- thresholds fail on unexpected errors;
- optional provider scenarios remain disabled by default.

### Release verification

Before promotion:

1. Run tests, lint, type-check and build.
2. Start or verify monitoring.
3. Run smoke checks.
4. Run load tests against local.
5. Inspect Grafana p95 and error panels.
6. Compare against the current baseline.
7. After deployment, inspect production dashboard for real latency.

## Technical Decisions

### Use production monitoring as source of truth

Production includes real network paths, data size, database/cache state,
concurrency and deployment resources. Local tests are useful, but they do not
replace production measurements.

### Prefer k6 for scripted load testing

`k6` is a better first target than Postman for latency measurement because it
supports concurrency, thresholds and repeatable scenarios. Postman remains
useful for manual smoke checks.

### Reuse existing metrics

The project already has `finsight_http_request_duration_seconds`. Reusing it
keeps metric naming and privacy rules consistent.

### Avoid early SLO commitments

The first implementation should establish a baseline. Hard production SLOs
should be set after observing real traffic.

## Risks

| Risk                                                  | Mitigation                                         |
| ----------------------------------------------------- | -------------------------------------------------- |
| Dashboard shows misleading p99 for low-traffic routes | Show request rate next to percentile panels        |
| Load tests mutate shared data                         | Use dedicated staging users and disposable records |
| External provider tests create cost/noise             | Disable provider scenarios by default              |
| Route labels create high cardinality                  | Test normalized Express route labels               |
| Local results are mistaken for production truth       | Document local/staging as baseline only            |
| Alerts are noisy before baseline exists               | Start with conservative thresholds                 |

## Tradeoffs

### New spec instead of editing observability foundation

This keeps foundation concerns separate from operational workflow and load
testing. The tradeoff is one more spec folder, but the boundary is clearer.

### k6 instead of Postman

Postman is easier for manual checks, but it does not naturally answer p95/p99
under concurrency. k6 adds a small tooling requirement but fits the measurement
goal better.

### Route-level dashboard before per-controller code timing

Route-level latency answers the first operational question: which API is slow?
Controller, service, DB and provider breakdowns can be added later if the
dashboard identifies a route that needs deeper investigation.
