# Project Observability Foundation - Tasks

## Phase 0 - Baseline

- [x] Inventory existing logs, Sentry, health/readiness, circuit breakers and
      Bull Board behavior.
- [ ] Record baseline backend resource usage without monitoring stack.
- [x] Add validated observability environment configuration.
- [x] Add `prom-client`.

## Phase 1 - Metrics registry and endpoint

- [x] Create one shared Prometheus registry.
- [x] Register default Node.js process metrics once.
- [x] Add `/metrics` endpoint behind `METRICS_ENABLED`.
- [x] Exclude `/metrics`, `/health` and `/ready` from product traffic metrics.
- [x] Add registry reset/isolation support for tests.
- [x] Test duplicate imports and hot reload behavior.

## Phase 2 - HTTP metrics

- [x] Add request count, duration and active request middleware.
- [x] Normalize Express route templates.
- [x] Use bounded method/status/route labels.
- [x] Test dynamic IDs do not create unique label values.
- [x] Verify metrics failure does not affect HTTP responses.

## Phase 3 - Sentry foundation

- [x] Add `SENTRY_RELEASE`, sampling and background-enable configuration.
- [x] Create background-safe capture helper.
- [x] Extend scrubber to body, query, cookies, breadcrumbs, contexts and extras.
- [x] Add bounded allowlist for tags.
- [x] Capture circuit breaker open and graceful shutdown timeout.
- [x] Test HTTP and background capture policies.
- [x] Test forbidden receipt/provider data is removed.
- [x] Test Sentry SDK failure is non-fatal.

## Phase 4 - BullMQ metrics

- [x] Create reusable queue/worker registration helper.
- [x] Record completed, skipped, retry, permanent and final outcomes.
- [x] Record queue wait and processing duration.
- [x] Record worker infrastructure errors.
- [x] Poll waiting, active, delayed and failed counts periodically.
- [x] Prevent duplicate event listener registration.
- [x] Add tests for all three existing queues.

## Phase 5 - Provider metrics

- [x] Create provider observation helper.
- [x] Define bounded provider, operation, outcome and error-class values.
- [x] Instrument Gemini.
- [x] Instrument Cloudinary.
- [x] Instrument Resend.
- [x] Record circuit breaker state transitions.
- [x] Verify original errors and retry behavior remain unchanged.

## Phase 6 - Receipt reference integration

- [x] Use generic BullMQ metrics in Receipt Worker.
- [x] Use provider metrics for Receipt Gemini and Cloudinary operations.
- [x] Add receipt cache result counter.
- [x] Add receipt scan outcome counter.
- [x] Use Sentry helper for terminal/infrastructure failures only.
- [x] Verify no duplicate domain/generic duration histograms.
- [x] Update Receipt spec dependencies and validation checklist.

## Phase 7 - Prometheus and Grafana local profile

- [x] Add optional Docker Compose `monitoring` profile.
- [x] Configure Prometheus 30-second scrape and 7-day retention.
- [x] Provision Grafana Prometheus datasource.
- [x] Add Project Overview dashboard.
- [x] Add BullMQ dashboard.
- [x] Add Receipt reference panels.
- [x] Add independent monitoring volumes.
- [x] Document start, stop and cleanup commands.

## Phase 8 - Alerts

- [x] Add sustained HTTP `5xx` alert.
- [x] Add queue backlog/final failure alerts.
- [x] Add provider error/429 alert.
- [x] Add circuit breaker open alert.
- [x] Add event-loop lag and memory alerts.
- [x] Add Prometheus target-down alert.
- [x] Keep thresholds configurable.

## Phase 9 - Verification

- [x] Unit tests pass.
- [x] Integration tests pass.
- [x] Lint passes.
- [x] Typecheck passes.
- [x] Build passes.
- [x] Prometheus target is up.
- [x] Grafana dashboards load.
- [x] Metrics contain no sensitive/high-cardinality labels.
- [x] Sentry fixtures contain no receipt/provider secrets.
- [ ] Load test uses low/disabled Sentry trace sampling.
- [ ] Measure monitoring CPU, RAM and disk usage.
- [x] Security review complete.

## Phase 10 - Node Exporter host observability

- [ ] Add optional Node Exporter service to the Docker Compose `monitoring`
      profile.
- [ ] Configure Prometheus to scrape Node Exporter every 30 seconds.
- [ ] Keep Node Exporter private in the production monitoring network.
- [ ] Select the minimum host mounts and collectors required for the target VPS.
- [ ] Exclude virtual, temporary and container-only filesystems where practical.
- [ ] Provision a `Finsight Host/VPS` Grafana dashboard.
- [ ] Add CPU, load average, memory, filesystem, disk I/O, network and uptime
      panels.
- [ ] Add sustained host CPU, memory and filesystem alerts.
- [ ] Verify Node Exporter resource usage on localhost.
- [ ] Verify Node Exporter target is `UP` in Prometheus.
- [ ] Document production firewall/reverse-proxy restrictions.

## Later domain migrations

- [ ] Report observability feature.
- [ ] Transaction/import/recurring observability feature.
- [ ] Project-wide SLO/SLI feature if production traffic requires it.
