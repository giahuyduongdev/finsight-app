# Backend Load Tests

These scripts provide pre-release API latency checks. They do not replace
production Prometheus/Grafana monitoring; production remains the source of truth
for real user latency.

## Tool

Use `k6` for the first-pass load-test harness.

Install it outside the project, then run the scripts from the repository root or
from `backend/`.

## Environment

Required for authenticated scenarios:

```text
BASE_URL=http://localhost:8000
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
```

Optional:

```text
LOAD_TEST_SCENARIO=smoke
LOAD_TEST_VUS=5
LOAD_TEST_DURATION=1m
```

Supported scenarios:

```text
smoke-public  health/readiness only, no credentials
smoke         health/readiness plus login
read          smoke plus authenticated read APIs
write         smoke plus disposable transaction create/update/delete
all           smoke, read and write
```

Receipt/provider-heavy scenarios are intentionally not enabled in the first
pass. They need explicit cost and rate-limit controls before load testing.

## Commands

Public smoke check:

```bash
k6 run backend/load-tests/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

Authenticated smoke check:

```bash
k6 run backend/load-tests/api-latency.k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e TEST_USER_EMAIL=test@example.com \
  -e TEST_USER_PASSWORD=change-me \
  -e LOAD_TEST_SCENARIO=smoke
```

Read-heavy check:

```bash
k6 run backend/load-tests/api-latency.k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e TEST_USER_EMAIL=test@example.com \
  -e TEST_USER_PASSWORD=change-me \
  -e LOAD_TEST_SCENARIO=read \
  -e LOAD_TEST_VUS=5 \
  -e LOAD_TEST_DURATION=1m
```

Full local check:

```bash
k6 run backend/load-tests/api-latency.k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e TEST_USER_EMAIL=test@example.com \
  -e TEST_USER_PASSWORD=change-me \
  -e LOAD_TEST_SCENARIO=all \
  -e LOAD_TEST_VUS=5 \
  -e LOAD_TEST_DURATION=1m
```

## Safety Rules

- Do not run high-concurrency load tests against production.
- Use a dedicated test user.
- Use disposable test data only.
- Keep provider-heavy scenarios disabled unless cost and quota are controlled.
- Read p95/p99 together with request volume; low-traffic percentiles can be
  noisy.

## Expected Output

`k6` prints latency percentiles and failure rate, including:

```text
http_req_duration
http_req_failed
checks
```

The default thresholds are intentionally conservative:

```text
http_req_failed < 1%
http_req_duration p95 < 1000ms
```

After the first production baseline exists, adjust thresholds to match real
service expectations.
