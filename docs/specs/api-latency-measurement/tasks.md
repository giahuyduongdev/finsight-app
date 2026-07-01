# API Latency Measurement - Tasks

Status: Draft.

## Phase 0 - Preconditions

- [x] Confirm `project-observability-foundation` HTTP metrics are implemented.
- [x] Confirm `/metrics` is available when `METRICS_ENABLED=true`.
- [x] Confirm Prometheus can scrape the backend locally.
- [x] Confirm Grafana provisioning loads existing dashboards.
- [x] Confirm dynamic route labels are normalized and bounded.

## Phase 1 - Query and Dashboard Design

- [x] Document canonical PromQL queries for p50, p95 and p99.
- [x] Document request-rate and `5xx`-rate queries.
- [x] Add or extend an API latency Grafana dashboard.
- [x] Add panels for whole-API p95 and route-level p50/p95/p99.
- [x] Add a slowest endpoints table.
- [x] Add request-rate panels beside latency panels.
- [x] Add status-code breakdown panels.
- [x] Exclude `/metrics`, `/health` and `/ready` from product traffic panels.
- [x] Verify dashboard variables are bounded to route, method and status code.

## Phase 2 - Alerts

- [x] Add whole-API p95 latency alert candidate.
- [x] Add route-level p95 latency alert candidate.
- [x] Add route-level `5xx` alert candidate.
- [x] Keep thresholds conservative.
- [x] Validate Prometheus alert rule syntax.
- [x] Document that thresholds must be reviewed after production baseline data
      exists.

## Phase 3 - Load-Test Harness

- [x] Choose the first implementation tool: `k6` preferred, `autocannon`
      acceptable for a smaller first pass.
- [x] Add load-test scripts under `backend/load-tests/`.
- [x] Add environment variable documentation.
- [x] Add smoke scenario for health/readiness and login.
- [x] Add read-heavy scenario for profile/dashboard/transactions/reports.
- [x] Add write scenario using disposable transaction test data.
- [x] Keep receipt/provider-heavy scenarios optional and disabled by default.
- [x] Add conservative thresholds for failed requests and p95 latency.
- [x] Ensure scripts fail clearly when credentials or target URL are missing.

## Phase 4 - Test Data and Safety

- [x] Define local test user requirements.
- [x] Define disposable data marker or cleanup strategy.
- [x] Ensure load tests do not require production accounts.
- [x] Ensure load tests do not use real financial records.
- [x] Ensure provider-backed scenarios require explicit opt-in.
- [x] Document provider cost and rate-limit risks.

## Phase 5 - Documentation

- [x] Document Postman as manual smoke-test tooling.
- [x] Document load-test usage for local.
- [x] Document how to read the Grafana API latency dashboard.
- [x] Document how to compare local load-test results with baseline.
- [x] Document that production monitoring is the source of truth.
- [x] Add a release verification checklist.

## Phase 6 - Verification

- [x] Backend unit tests pass.
- [x] Backend lint passes.
- [x] Backend type-check passes.
- [x] Backend build passes.
- [x] Grafana dashboard JSON parses.
- [x] Prometheus alert rules parse.
- [x] Prometheus target is up locally.
- [x] Load-test smoke scenario runs against local.
- [x] Load-test output includes p50/p95/p99 and error rate.
- [x] Dashboard shows data while load tests run.
- [x] Metrics labels contain no user IDs, emails, raw URLs or financial data.

## Suggested Execution Order

1. Verify current HTTP metrics and route normalization.
2. Add query catalog and dashboard panels.
3. Add alert candidates with conservative thresholds.
4. Add the load-test harness and smoke scenario.
5. Add read/write API scenarios.
6. Document local, staging and production workflows.
7. Run verification and record the first baseline.

## Out Of Scope For First Pass

- Distributed tracing.
- Per-service or per-database-span latency breakdowns.
- Production load testing against real users.
- Full SLO policy and error-budget process.
- Automatic Postman collection generation.
- Provider-heavy receipt/report load tests enabled by default.
