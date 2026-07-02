# API Latency - Ma Tran Phu API k6

File nay tra loi cau hoi: k6 da test API nao, API nao phai bat flag rieng,
va vi sao khong nen chay tat ca bang concurrency cao.

## Nhom Chay An Toan

Scenario nen dung de phu rong local:

```powershell
$env:LOAD_TEST_SCENARIO='all-safe'
$env:LOAD_TEST_VUS='5'
$env:LOAD_TEST_DURATION='1m'
pnpm --dir backend run loadtest:api
```

`all-safe` goi cac API co auth nhung khong doi password/email, khong gui email,
khong upload receipt, va khong goi provider ton quota.

## Matrix Route

| Route                                          | Scenario                                         | Ghi chu                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `GET /health`                                  | `smoke-public`                                   | Public health check.                                                                                     |
| `GET /ready`                                   | `smoke-public`                                   | Readiness check.                                                                                         |
| `GET /api/v1/auth/oauth/:provider`             | `smoke-public`                                   | Kiem tra redirect OAuth, khong follow redirect.                                                          |
| `GET /api/v1/auth/callback`                    | `smoke-public`                                   | Product route public, dung de tao data dashboard.                                                        |
| `POST /api/v1/auth/login`                      | `smoke`, `auth-core`, setup cua scenario co auth | Can `TEST_USER_EMAIL` va `TEST_USER_PASSWORD`.                                                           |
| `POST /api/v1/auth/refresh-token`              | `auth-core`                                      | Dung refresh token tu cookie login.                                                                      |
| `POST /api/v1/auth/logout`                     | `auth-core`                                      | Nen chay `LOAD_TEST_VUS=1`.                                                                              |
| `POST /api/v1/auth/logout-all`                 | `auth-core`                                      | Co the revoke session, khong nam trong `all-safe`.                                                       |
| `POST /api/v1/auth/register`                   | `email-optional`                                 | Can `ENABLE_EMAIL_SCENARIOS=true`; co the tao user/email.                                                |
| `POST /api/v1/auth/register/verify-otp`        | `email-optional`                                 | Chi goi khi co `TEST_OTP`.                                                                               |
| `POST /api/v1/auth/register/resend`            | `email-optional`                                 | Co the gui email.                                                                                        |
| `POST /api/v1/auth/password/forgot`            | `email-optional`                                 | Co the gui email.                                                                                        |
| `POST /api/v1/auth/password/verify-otp`        | `email-optional`                                 | Chi goi khi co `TEST_OTP`.                                                                               |
| `POST /api/v1/auth/password/resend`            | `email-optional`                                 | Co the gui email.                                                                                        |
| `POST /api/v1/auth/password/reset`             | `email-optional`                                 | Chi goi khi co `TEST_RESET_TOKEN`; co the doi password.                                                  |
| `POST /api/v1/auth/password/change-request`    | `email-optional`                                 | Co the bat dau flow doi password.                                                                        |
| `POST /api/v1/auth/password/change-verify`     | `email-optional`                                 | Chi goi khi co `TEST_OTP`; co the doi password.                                                          |
| `POST /api/v1/auth/password/change-resend`     | `email-optional`                                 | Co the gui email.                                                                                        |
| `POST /api/v1/auth/email/change-request`       | `email-optional`                                 | Chi goi khi co `TEST_NEW_EMAIL`; co the bat dau flow doi email.                                          |
| `POST /api/v1/auth/email/change-verify`        | `email-optional`                                 | Can OTP cu va moi; co the doi email.                                                                     |
| `POST /api/v1/auth/email/change-resend`        | `email-optional`                                 | Co the gui email.                                                                                        |
| `GET /api/v1/users/me`                         | `read`, `all-safe`                               | API doc profile.                                                                                         |
| `PATCH /api/v1/users/me`                       | `read`, `all-safe`                               | Update timezone/currency ve gia tri on dinh.                                                             |
| `PUT /api/v1/users/change-password`            | `password-mutation-optional`                     | Can `ENABLE_PASSWORD_MUTATION_SCENARIOS=true` va `TEST_TEMP_PASSWORD`; script doi sang temp roi doi lai. |
| `GET /api/v1/analytics/summary`                | `read`, `analytics-full`, `all-safe`             | API doc analytics.                                                                                       |
| `GET /api/v1/analytics/chart`                  | `read`, `analytics-full`, `all-safe`             | API doc chart.                                                                                           |
| `GET /api/v1/analytics/expense-breakdown`      | `read`, `analytics-full`, `all-safe`             | API doc breakdown.                                                                                       |
| `GET /api/v1/analytics/rates`                  | `read`, `analytics-full`, `all-safe`             | API doc exchange rates.                                                                                  |
| `POST /api/v1/analytics/rates/refresh`         | `read`, `analytics-full`, `all-safe`             | Co the goi provider/cache; van nam trong safe vi khong doi account.                                      |
| `POST /api/v1/transactions`                    | `write`, `transaction-full`, `all-safe`          | Tao transaction disposable.                                                                              |
| `GET /api/v1/transactions/all`                 | `read`, `all-safe`                               | Doc danh sach transaction.                                                                               |
| `GET /api/v1/transactions/:id`                 | `transaction-full`, `all-safe`                   | Dung transaction vua tao.                                                                                |
| `GET /api/v1/transactions/:id/children`        | `transaction-full`, `all-safe`                   | Dung transaction vua tao.                                                                                |
| `PUT /api/v1/transactions/:id`                 | `write`, `transaction-full`, `all-safe`          | Update transaction disposable.                                                                           |
| `POST /api/v1/transactions/:id/duplicate`      | `transaction-full`, `all-safe`                   | Duplicate transaction disposable.                                                                        |
| `POST /api/v1/transactions/bulk`               | `transaction-full`, `all-safe`                   | Tao bulk disposable.                                                                                     |
| `DELETE /api/v1/transactions/:id`              | `write`, `transaction-full`, `all-safe`          | Xoa transaction disposable.                                                                              |
| `DELETE /api/v1/transactions/bulk`             | `transaction-full`, `all-safe`                   | Xoa transaction disposable.                                                                              |
| `POST /api/v1/transactions/scan-receipt`       | `provider-optional`                              | Can `ENABLE_PROVIDER_SCENARIOS=true` va `RECEIPT_FIXTURE_PATH`; co the ton AI/provider quota.            |
| `GET /api/v1/transactions/scan-receipt/:jobId` | `provider-optional`                              | Chi goi neu scan tra ve `jobId`.                                                                         |
| `GET /api/v1/reports`                          | `read`, `report-safe`, `all-safe`                | Doc danh sach report.                                                                                    |
| `PATCH /api/v1/reports/settings`               | `report-safe`, `all-safe`                        | Set `isEnabled=true`.                                                                                    |
| `GET /api/v1/reports/generate`                 | `provider-optional`                              | Co the generate report/provider work.                                                                    |
| `POST /api/v1/reports/resend/:reportId`        | `provider-optional`                              | Chi goi khi co `TEST_REPORT_ID`; co the gui email.                                                       |
| `GET /metrics`                                 | khong load test                                  | Prometheus scrape endpoint nay; khong tinh la business API.                                              |
| Swagger/docs/admin/debug routes                | khong load test                                  | Route van hanh/dev, khong dua vao p95 business API.                                                      |

## Cach Doc Ket Qua

- `http_req_duration p(95)=345ms` nghia la p95 bang `0.345` giay.
- `http_req_failed=0.00%` nghia la khong co request fail theo k6.
- `checks_succeeded=100%` nghia la cac dieu kien check trong script deu pass.
- Tren Grafana, route chi hien sau khi Prometheus scrape duoc sample, thuong doi
  toi da khoang 30 giay.

## Khuyen Nghi Chay

- Local nhanh: `smoke-public`.
- Local co login: `smoke`.
- Phu rong an toan: `all-safe`.
- Auth lifecycle: `auth-core` voi `LOAD_TEST_VUS=1`.
- Muon gan 100% route: chay them `coverage-all` voi cac flag optional va account
  test rieng.
