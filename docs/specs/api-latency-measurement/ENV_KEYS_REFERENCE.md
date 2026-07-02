# Tham Chiếu Toàn Bộ Env Keys

File này giải thích toàn bộ key hiện có trong:

```text
.env.example
backend/.env.example
```

Trạng thái kiểm tra gần nhất:

```text
.env         khớp .env.example
backend/.env khớp backend/.env.example
```

Không commit `.env` thật vì các file đó có thể chứa secret.

## Root `.env`

Root `.env` dùng cho Docker Compose ở thư mục project root.

| Key                      | Ý nghĩa                                                  | Gợi ý local                                                     |
| ------------------------ | -------------------------------------------------------- | --------------------------------------------------------------- |
| `REDIS_PASSWORD`         | Password cho Redis container trong `docker-compose.yml`. | Đặt một chuỗi riêng cho local.                                  |
| `GRAFANA_ADMIN_USER`     | Username đăng nhập Grafana local.                        | `admin`                                                         |
| `GRAFANA_ADMIN_PASSWORD` | Password đăng nhập Grafana local.                        | Local có thể dùng đơn giản; production phải dùng password mạnh. |

## Backend `.env`

Backend `.env` dùng cho API server trong thư mục `backend`.

## App Và Server

| Key         | Ý nghĩa                                                                            | Gợi ý local   |
| ----------- | ---------------------------------------------------------------------------------- | ------------- |
| `NODE_ENV`  | Môi trường chạy app. Ảnh hưởng cookie, Sentry environment, config theo môi trường. | `development` |
| `PORT`      | Port backend lắng nghe. Monitoring local đang trỏ tới port này.                    | `8000`        |
| `BASE_PATH` | Prefix API chính trước version route. Với code hiện tại route v1 là `/api/v1`.     | `/api`        |

## MongoDB Và Resource

| Key                              | Ý nghĩa                                               | Gợi ý local                       |
| -------------------------------- | ----------------------------------------------------- | --------------------------------- |
| `MONGO_URI`                      | Connection string MongoDB. Đây là secret/config thật. | Dùng Mongo local hoặc Mongo test. |
| `MONGO_MAX_POOL_SIZE`            | Số connection Mongo tối đa trong pool.                | `50`                              |
| `MONGO_SERVER_SELECTION_TIMEOUT` | Timeout chọn Mongo server, tính bằng ms.              | `8000`                            |
| `MONGO_SOCKET_TIMEOUT`           | Timeout socket Mongo, tính bằng ms.                   | `45000`                           |
| `MONGO_CONNECT_TIMEOUT`          | Timeout connect Mongo, tính bằng ms.                  | `10000`                           |
| `MONGO_MAX_POOL_SIZE_PER_CORE`   | Giới hạn pool theo CPU core.                          | `5`                               |
| `MEMORY_THRESHOLD_MB`            | Ngưỡng memory app dùng cho health/resource warning.   | `500`                             |

## JWT Và Token

| Key                      | Ý nghĩa                                                                   | Gợi ý local        |
| ------------------------ | ------------------------------------------------------------------------- | ------------------ |
| `JWT_SECRET`             | Secret ký access token. Phải giữ kín.                                     | Chuỗi random mạnh. |
| `JWT_EXPIRES_IN`         | Thời hạn access token.                                                    | `15m`              |
| `JWT_ISSUER`             | Issuer claim trong JWT, cho biết token do service nào phát hành.          | `finsight-api`     |
| `JWT_REFRESH_SECRET`     | Secret ký refresh token. Phải khác `JWT_SECRET`.                          | Chuỗi random mạnh. |
| `JWT_REFRESH_EXPIRES_IN` | Thời hạn refresh token.                                                   | `7d`               |
| `ENCRYPTION_SECRET`      | Secret mã hóa dữ liệu nhạy cảm. Phải giữ kín và ổn định.                  | Chuỗi random mạnh. |
| `TOKEN_HASH_SECRET`      | Secret HMAC cho OTP, reset token, refresh token digest, blacklist digest. | Chuỗi random mạnh. |

## Provider/API Bên Ngoài

| Key                     | Ý nghĩa                               | Gợi ý local                      |
| ----------------------- | ------------------------------------- | -------------------------------- |
| `GEMINI_API_KEY`        | API key Gemini cho receipt/report AI. | Dùng key dev/test nếu có.        |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name.                | Theo account Cloudinary của bạn. |
| `CLOUDINARY_API_KEY`    | Cloudinary API key.                   | Secret thật, không commit.       |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret.                | Secret thật, không commit.       |
| `RESEND_API_KEY`        | API key Resend để gửi email.          | Secret thật, không commit.       |
| `RESEND_MAILER_SENDER`  | Email sender mặc định cho Resend.     | Email/domain đã verify.          |

## Sentry

Sentry dùng để capture exception và background error. Không bắt buộc để đo latency
bằng Prometheus/Grafana.

| Key                                | Ý nghĩa                                                               | Gợi ý local            |
| ---------------------------------- | --------------------------------------------------------------------- | ---------------------- |
| `SENTRY_DSN`                       | DSN kết nối tới project Sentry. Nếu trống thì Sentry không gửi event. | Có thể để trống local. |
| `SENTRY_RELEASE`                   | Version/release đang chạy, thường là commit hash/tag khi deploy.      | Có thể để trống local. |
| `SENTRY_TRACES_SAMPLE_RATE`        | Tỷ lệ sampling trace. `0.1` nghĩa là 10%.                             | `0.1`                  |
| `SENTRY_BACKGROUND_ERRORS_ENABLED` | Bật capture lỗi background worker/job lên Sentry.                     | `true`                 |

## Metrics Và Monitoring

Nhóm này cần cho API latency dashboard.

| Key                              | Ý nghĩa                                               | Gợi ý local |
| -------------------------------- | ----------------------------------------------------- | ----------- |
| `METRICS_ENABLED`                | Bật endpoint Prometheus metrics.                      | `true`      |
| `METRICS_ROUTE`                  | Route expose metrics.                                 | `/metrics`  |
| `METRICS_QUEUE_POLL_INTERVAL_MS` | Chu kỳ poll queue metrics, tính bằng ms.              | `15000`     |
| `METRICS_DEFAULT_INTERVAL_MS`    | Chu kỳ collect default/process metrics, tính bằng ms. | `10000`     |

Kiểm tra sau khi backend chạy:

```text
http://localhost:8000/metrics
```

## Redis

| Key                      | Ý nghĩa                                              | Gợi ý local                        |
| ------------------------ | ---------------------------------------------------- | ---------------------------------- |
| `REDIS_URL`              | Redis connection string backend dùng.                | Trỏ tới Redis local/container.     |
| `REDIS_MAXMEMORY`        | Cấu hình memory Redis nếu app đọc để audit/document. | Theo docker/local config.          |
| `REDIS_MAXMEMORY_POLICY` | Policy Redis khi đầy memory.                         | `noeviction` hoặc policy bạn chọn. |
| `UPSTASH_REDIS_URL`      | Redis URL cho Upstash nếu dùng provider này.         | Để trống nếu không dùng.           |

## Auth0

| Key                   | Ý nghĩa                            | Gợi ý local                       |
| --------------------- | ---------------------------------- | --------------------------------- |
| `AUTH0_DOMAIN`        | Domain tenant Auth0.               | Theo Auth0 app.                   |
| `AUTH0_CLIENT_ID`     | Client ID Auth0.                   | Theo Auth0 app.                   |
| `AUTH0_CLIENT_SECRET` | Client secret Auth0. Phải giữ kín. | Secret thật.                      |
| `AUTH0_CALLBACK_URL`  | Callback URL OAuth backend nhận.   | Ví dụ local callback của backend. |

## Exchange Rate

| Key                              | Ý nghĩa                                              | Gợi ý local                                  |
| -------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| `EXCHANGE_RATE_FALLBACK_API_URL` | Base URL fallback nếu primary exchange-rate API lỗi. | Có thể để trống.                             |
| `EXCHANGE_RATE_PRIMARY_API_URL`  | Base URL chính cho API tỷ giá.                       | `https://api.exchangerate-api.com/v4/latest` |

Lưu ý: key cũ `EXCHANGE_RATE_API_URL` không còn nằm trong `.env.example`. Nếu
thấy key này trong `.env`, hãy chuyển giá trị sang `EXCHANGE_RATE_PRIMARY_API_URL`.

## Receipt Queue Và Worker

| Key                                 | Ý nghĩa                                              | Gợi ý local |
| ----------------------------------- | ---------------------------------------------------- | ----------- |
| `RECEIPT_QUEUE_INTAKE_ENABLED`      | Bật nhận request scan receipt vào queue.             | `true`      |
| `RECEIPT_WORKER_ENABLED`            | Bật worker xử lý receipt queue.                      | `true`      |
| `RECEIPT_WORKER_CONCURRENCY`        | Số job receipt xử lý song song. VPS nhỏ nên để thấp. | `2`         |
| `RECEIPT_MAX_ATTEMPTS`              | Số lần retry tối đa cho receipt job.                 | `3`         |
| `RECEIPT_BACKOFF_DELAY_MS`          | Delay giữa retry, tính bằng ms.                      | `10000`     |
| `RECEIPT_AI_RATE_LIMIT_MAX`         | Số request AI tối đa trong một window.               | `10`        |
| `RECEIPT_AI_RATE_LIMIT_DURATION_MS` | Độ dài window rate limit AI, tính bằng ms.           | `60000`     |
| `RECEIPT_DOWNLOAD_TIMEOUT_MS`       | Timeout download receipt file/image, tính bằng ms.   | `10000`     |
| `RECEIPT_PROCESSING_TIMEOUT_MS`     | Timeout xử lý receipt scan, tính bằng ms.            | `60000`     |
| `RECEIPT_MAX_DOWNLOAD_BYTES`        | Kích thước file receipt tối đa được download.        | `5242880`   |
| `RECEIPT_SCAN_CACHE_TTL_SECONDS`    | TTL cache kết quả receipt scan, tính bằng giây.      | `86400`     |

## Frontend

| Key               | Ý nghĩa                                                     | Gợi ý local             |
| ----------------- | ----------------------------------------------------------- | ----------------------- |
| `FRONTEND_ORIGIN` | Origin frontend dùng cho CORS, redirect OAuth, cookie flow. | `http://localhost:5173` |

## Cách Kiểm Tra Lại Key Thiếu/Thừa

Chạy từ project root:

```powershell
node -e "const fs=require('fs'); const parse=f=>fs.existsSync(f)?[...fs.readFileSync(f,'utf8').matchAll(/^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=/gm)].map(m=>m[1]):[]; for (const [env, ex] of [['.env','.env.example'],['backend/.env','backend/.env.example']]) { const a=parse(env), b=parse(ex); const missing=b.filter(k=>!a.includes(k)); const extra=a.filter(k=>!b.includes(k)); console.log('## '+env+' vs '+ex); console.log('missing='+(missing.length?missing.join(','):'(none)')); console.log('extra='+(extra.length?extra.join(','):'(none)')); }"
```

Kết quả tốt:

```text
missing=(none)
extra=(none)
```

## Cách Kiểm Tra Metrics Sau Khi Cập Nhật Env

1. Restart backend.
2. Mở:

```text
http://localhost:8000/metrics
```

3. Nếu thấy Prometheus text metrics, metrics đã bật.
4. Chạy:

```powershell
pnpm --dir backend run loadtest:api:public
```

5. Mở Grafana dashboard:

```text
Finsight API Latency
```
