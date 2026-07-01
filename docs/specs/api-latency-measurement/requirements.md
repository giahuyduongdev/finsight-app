# API Latency Measurement - Requirements

Status: Draft.

## Introduction

The project already has an observability foundation with backend HTTP metrics,
Prometheus, Grafana and local monitoring documentation. This feature turns that
foundation into a practical API latency workflow: developers can measure latency
before release, and operators can read real production latency after release.

Production remains the source of truth for user-facing latency. Local and
staging load tests are used to catch obvious regressions, compare builds and
exercise important endpoints before deployment.

## Goals

- Measure latency for all backend HTTP APIs through existing Prometheus metrics.
- Show p50, p95 and p99 latency by normalized endpoint, method and status.
- Provide a repeatable load-test workflow for local and staging environments.
- Define where Postman fits: smoke testing, not load testing or long-term
  latency reporting.
- Add alerting guidance for sustained high latency.
- Keep all metrics privacy-safe and low-cardinality.
- Avoid duplicating the project observability foundation.

## Non-goals

- Do not replace the existing `project-observability-foundation` spec.
- Do not introduce OpenTelemetry, Loki, Elasticsearch or a new monitoring
  platform.
- Do not use Postman as the primary latency reporting tool.
- Do not expose `/metrics` publicly in production.
- Do not create metric labels from user IDs, emails, raw URLs, MongoDB IDs,
  request IDs, filenames or financial data.
- Do not require production load testing against real users or real financial
  records.

## User Stories

### Story 1 - Developer pre-release latency check

As a developer,
I want to run a repeatable load test against local or staging APIs,
so that I can detect obvious latency regressions before deployment.

### Story 2 - Operator production latency dashboard

As an operator,
I want a Grafana dashboard showing p50, p95 and p99 latency by API route,
so that I can identify slow endpoints from real production traffic.

### Story 3 - Release reviewer

As a release reviewer,
I want documented latency thresholds and a verification checklist,
so that I can decide whether a build is safe to promote.

### Story 4 - Backend maintainer

As a backend maintainer,
I want latency measurement to reuse the existing HTTP metrics middleware,
so that the project does not grow competing instrumentation paths.

## Functional Requirements

### R1. Metric source

API latency reporting must use the existing Prometheus histogram:

```text
finsight_http_request_duration_seconds
```

The implementation must verify that the histogram has bounded labels:

```text
method
route
status_code
```

Routes must be normalized Express route templates, not raw request paths.

### R2. Production dashboard

Grafana must provide an API latency view with:

- request rate by route and method;
- error rate by route and status class/code;
- p50 latency by route and method;
- p95 latency by route and method;
- p99 latency by route and method;
- a slowest endpoints table;
- a status-code breakdown for selected routes.

Dashboard queries must exclude `/metrics`, `/health` and `/ready`.

### R3. PromQL query catalog

The spec or implementation notes must document canonical PromQL queries for:

- p50, p95 and p99 over a short window;
- route-level request rate;
- route-level `5xx` rate;
- slowest endpoints by p95;
- whole-API p95 latency.

Queries must be reusable in Grafana panels and manual Prometheus checks.

### R4. Alerting

Alerts must focus on sustained conditions, not one-off slow requests.

Initial alert candidates:

- whole-API p95 latency above threshold for 10 minutes;
- one route p95 latency above threshold for 10 minutes;
- route `5xx` rate above threshold for 5 minutes;
- Prometheus target down.

Thresholds must be environment-configurable and reviewed after production
baseline data exists.

### R5. Load-test tooling

The project must provide a repeatable load-test workflow using one primary tool.

The preferred first tool is `k6` because it provides scripted scenarios,
thresholds and CI/staging compatibility. If installation cost is too high, a
smaller `autocannon` first pass is acceptable, but the spec should record that
tradeoff.

Load-test scripts must be committed under a clear location such as:

```text
backend/load-tests/
```

### R6. Load-test scenarios

Initial scenarios should cover high-value API flows without requiring production
data:

- health or readiness smoke check;
- auth login using seeded staging credentials;
- current user/profile read;
- dashboard or analytics read;
- transaction list read;
- transaction create/update/delete against disposable test data;
- report list or report settings read;
- receipt scan only if a safe fixture and provider cost control are available.

Scenarios that require external providers or expensive work must be optional and
disabled by default.

### R7. Test data and credentials

Load tests must not use real production user accounts or real financial data.

Staging tests should use:

- dedicated test users;
- disposable transaction data;
- documented environment variables for base URL and credentials;
- provider mocks or disabled expensive provider scenarios where possible.

Required environment variable names must be documented before implementation.

### R8. Postman workflow

Postman may be used for:

- manual smoke checks;
- inspecting one endpoint response time;
- verifying request payloads and auth flows.

Postman must not be treated as the primary source for p95/p99, concurrency or
production latency reporting.

If Newman is considered later, it should run API correctness smoke tests, not
replace the load-test harness.

### R9. Verification workflow

The feature must document a release verification sequence:

1. Run backend tests, lint, type-check and build.
2. Start local or staging monitoring.
3. Run smoke checks.
4. Run the load-test suite against local or staging.
5. Inspect Prometheus/Grafana latency panels.
6. Compare p95 and error rate against the current baseline.
7. Review production dashboard after deployment.

### R10. Privacy and cardinality

No dashboard, alert or load-test metric may introduce high-cardinality or
sensitive labels.

Forbidden labels and dashboard variables include:

- user ID;
- email;
- request ID or correlation ID;
- MongoDB document ID;
- transaction ID;
- raw URL or query string;
- filename;
- receipt image hash;
- financial amount or description.

## Acceptance Criteria

- [ ] API latency dashboard exists in Grafana or is defined clearly enough for
      implementation.
- [ ] Dashboard shows p50, p95 and p99 from
      `finsight_http_request_duration_seconds`.
- [ ] Slowest endpoint view uses normalized routes only.
- [ ] Canonical PromQL queries are documented.
- [ ] Alert candidates and threshold ownership are documented.
- [ ] Load-test tool choice is documented.
- [ ] Load-test scenarios cover the main API families without production data.
- [ ] Postman is documented as smoke-test tooling only.
- [ ] Release verification checklist includes pre-release and post-deploy
      latency checks.
- [ ] Privacy/cardinality rules match the observability foundation.

## Edge Cases

- An unmatched route should be grouped under a bounded fallback label.
- A route returning `4xx` may be fast but still high-volume; dashboards should
  separate latency from error rate.
- A route with low traffic may have unstable p99; dashboards should show request
  volume alongside percentile panels.
- External provider scenarios may be slower or costly; they must be optional.
- Local latency may differ from staging and production due to database, cache,
  network, CPU and data-size differences.

## Constraints

- Reuse the existing backend metrics middleware and Prometheus registry.
- Keep `/metrics` private in production.
- Keep load tests deterministic enough for repeated release checks.
- Avoid adding large infrastructure until the existing observability foundation
  is implemented and verified.
- Follow the project feature-development workflow.

## Success Criteria

- A developer can answer "which API endpoints are slow?" from Grafana.
- A developer can run one command or documented script to baseline staging
  latency before release.
- Production p95/p99 latency becomes visible without manually testing endpoints
  one by one.
- The project has a clear distinction between Postman smoke checks, load-test
  baselines and production monitoring.
