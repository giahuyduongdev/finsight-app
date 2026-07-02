# Backend Load Tests

These scripts provide pre-release API latency checks. They do not replace
production Prometheus/Grafana monitoring; production remains the source of truth
for real user latency.

## Tool

Use `k6` for the first-pass load-test harness.

Install it outside the project, then run the scripts from the repository root or
from `backend/`.

Windows install options:

```powershell
winget install GrafanaLabs.k6
```

or:

```powershell
choco install k6
```

Verify:

```powershell
k6 version
```

If the current terminal does not recognize `k6` immediately after installation,
open a new terminal or run it directly from:

```powershell
& 'C:\Program Files\k6\k6.exe' version
```

Docker alternative, useful when you do not want to install `k6` locally:

```powershell
docker run --rm -i -v ${PWD}/backend/load-tests:/scripts grafana/k6 run /scripts/api-latency.k6.js -e LOAD_TEST_SCENARIO=smoke-public
```

Do not install or run `k6` on the production VPS unless you explicitly want that
machine to generate test traffic. Prefer running load tests from your local
machine against local backend, then use production Grafana for real latency.

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
ENABLE_EMAIL_SCENARIOS=false
ENABLE_PROVIDER_SCENARIOS=false
ENABLE_PASSWORD_MUTATION_SCENARIOS=false
```

Supported scenarios:

```text
smoke-public                health/readiness plus public auth redirects, no credentials
smoke                       smoke-public plus login
read                        authenticated user, analytics, transactions list, reports list
write                       disposable transaction create/update/delete
all                         legacy read plus write
auth-core                   login, refresh-token, logout, logout-all
analytics-full              all analytics routes
transaction-full            create/get/update/duplicate/bulk/delete transaction routes
report-safe                 reports list and report settings
all-safe                    read, transaction-full, report-safe; no email/provider/password mutation
email-optional              email/OTP/password/email-change auth routes; requires ENABLE_EMAIL_SCENARIOS=true
provider-optional           report generate/resend and receipt scan; requires ENABLE_PROVIDER_SCENARIOS=true
password-mutation-optional  reversible user password change; requires ENABLE_PASSWORD_MUTATION_SCENARIOS=true
coverage-optional           email-optional plus provider-optional
coverage-all                all-safe, auth-core, email-optional, provider-optional, password-mutation-optional
```

The safe route coverage command is `LOAD_TEST_SCENARIO=all-safe`. It covers the
main authenticated API surface without changing account credentials or calling
provider-heavy routes.

The optional scenarios are behind flags because they can send email, consume AI
or report-provider quota, change email/password state, or require a real receipt
fixture. Use them only with a disposable local/staging account.

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

Safe broad local check:

```bash
k6 run backend/load-tests/api-latency.k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e TEST_USER_EMAIL=test@example.com \
  -e TEST_USER_PASSWORD=change-me \
  -e LOAD_TEST_SCENARIO=all-safe \
  -e LOAD_TEST_VUS=5 \
  -e LOAD_TEST_DURATION=1m
```

Auth lifecycle check. Keep this at low concurrency because `logout-all` revokes
sessions:

```bash
k6 run backend/load-tests/api-latency.k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e TEST_USER_EMAIL=test@example.com \
  -e TEST_USER_PASSWORD=change-me \
  -e LOAD_TEST_SCENARIO=auth-core \
  -e LOAD_TEST_VUS=1 \
  -e LOAD_TEST_DURATION=30s
```

Optional email/OTP/provider/password coverage example:

```bash
k6 run backend/load-tests/api-latency.k6.js \
  -e BASE_URL=http://localhost:8000 \
  -e TEST_USER_EMAIL=test@example.com \
  -e TEST_USER_PASSWORD=change-me \
  -e LOAD_TEST_SCENARIO=coverage-all \
  -e LOAD_TEST_VUS=1 \
  -e LOAD_TEST_DURATION=30s \
  -e ENABLE_EMAIL_SCENARIOS=true \
  -e ENABLE_PROVIDER_SCENARIOS=true \
  -e ENABLE_PASSWORD_MUTATION_SCENARIOS=true \
  -e TEST_TEMP_PASSWORD=TempLoadTest123!
```

Add these only when the specific route can be exercised safely:

```text
TEST_EMAIL_FLOW_EMAIL=loadtest-register@example.com
TEST_EMAIL_FLOW_PASSWORD=LoadTest123!
TEST_OTP=123456
TEST_RESET_TOKEN=reset-token-from-test-flow
TEST_NEW_EMAIL=loadtest-new@example.com
TEST_OLD_EMAIL_OTP=123456
TEST_NEW_EMAIL_OTP=654321
TEST_REPORT_ID=report-id-to-resend
REPORT_FROM=2026-07-01
REPORT_TO=2026-07-02
RECEIPT_FIXTURE_PATH=./load-tests/fixtures/receipt.png
RECEIPT_FIXTURE_NAME=receipt.png
RECEIPT_FIXTURE_MIME=image/png
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
