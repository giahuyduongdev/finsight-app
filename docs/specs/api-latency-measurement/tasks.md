# API Latency Measurement - Tasks

Status: Draft.

## Phase 0 - Preconditions

- [ ] Confirm `project-observability-foundation` HTTP metrics are implemented.
- [ ] Confirm `/metrics` is available when `METRICS_ENABLED=true`.
- [ ] Confirm Prometheus can scrape the backend locally.
- [ ] Confirm Grafana provisioning loads existing dashboards.
- [ ] Confirm dynamic route labels are normalized and bounded.

## Phase 1 - Query and Dashboard Design

- [ ] Document canonical PromQL queries for p50, p95 and p99.
- [ ] Document request-rate and `5xx`-rate queries.
- [ ] Add or extend an API latency Grafana dashboard.
- [ ] Add panels for whole-API p95 and route-level p50/p95/p99.
- [ ] Add a slowest endpoints table.
- [ ] Add request-rate panels beside latency panels.
- [ ] Add status-code breakdown panels.
- [ ] Exclude `/metrics`, `/health` and `/ready` from product traffic panels.
- [ ] Verify dashboard variables are bounded to route, method and status code.

## Phase 2 - Alerts

- [ ] Add whole-API p95 latency alert candidate.
- [ ] Add route-level p95 latency alert candidate.
- [ ] Add route-level `5xx` alert candidate.
- [ ] Keep thresholds configurable and conservative.
- [ ] Validate Prometheus alert rule syntax.
- [ ] Document that thresholds must be reviewed after production baseline data
      exists.

## Phase 3 - Load-Test Harness

- [ ] Choose the first implementation tool: `k6` preferred, `autocannon`
      acceptable for a smaller first pass.
- [ ] Add load-test scripts under `backend/load-tests/`.
- [ ] Add environment variable documentation.
- [ ] Add smoke scenario for health/readiness and login.
- [ ] Add read-heavy scenario for profile/dashboard/transactions/reports.
- [ ] Add write scenario using disposable transaction test data.
- [ ] Keep receipt/provider-heavy scenarios optional and disabled by default.
- [ ] Add conservative thresholds for failed requests and p95 latency.
- [ ] Ensure scripts fail clearly when credentials or target URL are missing.

## Phase 4 - Test Data and Safety

- [ ] Define staging test user requirements.
- [ ] Define disposable data marker or cleanup strategy.
- [ ] Ensure load tests do not require production accounts.
- [ ] Ensure load tests do not use real financial records.
- [ ] Ensure provider-backed scenarios require explicit opt-in.
- [ ] Document provider cost and rate-limit risks.

## Phase 5 - Documentation

- [ ] Document Postman as manual smoke-test tooling.
- [ ] Document load-test usage for local and staging.
- [ ] Document how to read the Grafana API latency dashboard.
- [ ] Document how to compare staging load-test results with baseline.
- [ ] Document that production monitoring is the source of truth.
- [ ] Add a release verification checklist.

## Phase 6 - Verification

- [ ] Backend unit tests pass.
- [ ] Backend lint passes.
- [ ] Backend type-check passes.
- [ ] Backend build passes.
- [ ] Grafana dashboard JSON parses.
- [ ] Prometheus alert rules parse.
- [ ] Prometheus target is up locally.
- [ ] Load-test smoke scenario runs against local or staging.
- [ ] Load-test output includes p50/p95/p99 and error rate.
- [ ] Dashboard shows data while load tests run.
- [ ] Metrics labels contain no user IDs, emails, raw URLs or financial data.

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
