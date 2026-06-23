# Project Observability Foundation - Tasks

## Phase 0 - Baseline

- [ ] Inventory existing logs, Sentry, health/readiness, circuit breakers and
      Bull Board behavior.
- [ ] Record baseline backend resource usage without monitoring stack.
- [ ] Add validated observability environment configuration.
- [ ] Add `prom-client`.

## Phase 1 - Metrics registry and endpoint

- [ ] Create one shared Prometheus registry.
- [ ] Register default Node.js process metrics once.
- [ ] Add `/metrics` endpoint behind `METRICS_ENABLED`.
- [ ] Exclude `/metrics`, `/health` and `/ready` from product traffic metrics.
- [ ] Add registry reset/isolation support for tests.
- [ ] Test duplicate imports and hot reload behavior.

## Phase 2 - HTTP metrics

- [ ] Add request count, duration and active request middleware.
- [ ] Normalize Express route templates.
- [ ] Use bounded method/status/route labels.
- [ ] Test dynamic IDs do not create unique label values.
- [ ] Verify metrics failure does not affect HTTP responses.

## Phase 3 - Sentry foundation

- [ ] Add `SENTRY_RELEASE`, sampling and background-enable configuration.
- [ ] Create background-safe capture helper.
- [ ] Extend scrubber to body, query, cookies, breadcrumbs, contexts and extras.
- [ ] Add bounded allowlist for tags.
- [ ] Capture circuit breaker open and graceful shutdown timeout.
- [ ] Test HTTP and background capture policies.
- [ ] Test forbidden receipt/provider data is removed.
- [ ] Test Sentry SDK failure is non-fatal.

## Phase 4 - BullMQ metrics

- [ ] Create reusable queue/worker registration helper.
- [ ] Record completed, skipped, retry, permanent and final outcomes.
- [ ] Record queue wait and processing duration.
- [ ] Record worker infrastructure errors.
- [ ] Poll waiting, active, delayed and failed counts periodically.
- [ ] Prevent duplicate event listener registration.
- [ ] Add tests for all three existing queues.

## Phase 5 - Provider metrics

- [ ] Create provider observation helper.
- [ ] Define bounded provider, operation, outcome and error-class values.
- [ ] Instrument Gemini.
- [ ] Instrument Cloudinary.
- [ ] Instrument Resend.
- [ ] Record circuit breaker state transitions.
- [ ] Verify original errors and retry behavior remain unchanged.

## Phase 6 - Receipt reference integration

- [ ] Use generic BullMQ metrics in Receipt Worker.
- [ ] Use provider metrics for Receipt Gemini and Cloudinary operations.
- [ ] Add receipt cache result counter.
- [ ] Add receipt scan outcome counter.
- [ ] Use Sentry helper for terminal/infrastructure failures only.
- [ ] Verify no duplicate domain/generic duration histograms.
- [ ] Update Receipt spec dependencies and validation checklist.

## Phase 7 - Prometheus and Grafana local profile

- [ ] Add optional Docker Compose `monitoring` profile.
- [ ] Configure Prometheus 30-second scrape and 7-day retention.
- [ ] Provision Grafana Prometheus datasource.
- [ ] Add Project Overview dashboard.
- [ ] Add BullMQ dashboard.
- [ ] Add Receipt reference panels.
- [ ] Add independent monitoring volumes.
- [ ] Document start, stop and cleanup commands.

## Phase 8 - Alerts

- [ ] Add sustained HTTP `5xx` alert.
- [ ] Add queue backlog/final failure alerts.
- [ ] Add provider error/429 alert.
- [ ] Add circuit breaker open alert.
- [ ] Add event-loop lag and memory alerts.
- [ ] Add Prometheus target-down alert.
- [ ] Keep thresholds configurable.

## Phase 9 - Verification

- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Build passes.
- [ ] Prometheus target is up.
- [ ] Grafana dashboards load.
- [ ] Metrics contain no sensitive/high-cardinality labels.
- [ ] Sentry fixtures contain no receipt/provider secrets.
- [ ] Load test uses low/disabled Sentry trace sampling.
- [ ] Measure monitoring CPU, RAM and disk usage.
- [ ] Security review complete.

## Later domain migrations

- [ ] Report observability feature.
- [ ] Transaction/import/recurring observability feature.
- [ ] Project-wide SLO/SLI feature if production traffic requires it.
