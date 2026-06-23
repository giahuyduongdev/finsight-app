# Receipt BullMQ Processing - Requirements

## Status

Draft ready for review before implementation.

## Context

The receipt upload endpoint currently returns `202 Accepted` and starts
`processReceiptScanInBackground()` inside the API process. New receipt scans do
not enter `RECEIPT_QUEUE`; therefore BullMQ concurrency, retry, backoff,
retention and Bull Board do not protect or observe them.

The existing receipt worker is a compatibility path for legacy jobs. It already
supports cache-first replay, retryable provider failures, permanent
non-receipt failures and deterministic Cloudinary assets.

## Goals

- Move every new receipt scan into `RECEIPT_QUEUE`.
- Keep Redis payloads small by queueing a Cloudinary URL, never a new base64
  payload.
- Bound Gemini concurrency and request rate.
- Survive API/worker restart without losing accepted scans.
- Prevent duplicate Gemini work for the same user and image.
- Expose useful local and production metrics.
- Preserve the current asynchronous UX: HTTP `202`, then socket completion.
- Support an all-in-one learning VPS as well as external MongoDB/Redis.

## Non-goals

- No generic job framework.
- No replacement of BullMQ, Cloudinary or Gemini.
- No guarantee of exactly-once queue delivery.
- No automatic transaction creation from extracted receipt data.
- No production autoscaling in this feature.
- No requirement to deploy Prometheus/Grafana before local implementation.

## Functional requirements

### R1. Durable intake

The upload endpoint must:

1. authenticate the user;
2. validate MIME type and file size;
3. compress the image;
4. calculate `imageHash`;
5. return a valid cached result immediately when present;
6. upload/reuse the image in Cloudinary with deterministic public ID;
7. enqueue a BullMQ job containing `imageUrl`, not `fileBuffer`;
8. return `202 Accepted` with the stable `jobId`.

The endpoint must not start an untracked background Promise.

### R2. Stable identity and duplicate intake

Receipt business identity is:

```text
userId + imageHash
```

The queue job ID must be derived from this identity. Concurrent uploads of the
same compressed image by the same user must resolve to one queued/active job.

The same image uploaded by different users remains a separate business job.

### R3. Worker behavior

The worker must:

- read cache before downloading or calling providers;
- download the Cloudinary image with a bounded timeout;
- call Gemini and validate the extracted result;
- write the cache before emitting success;
- return `succeeded` or `skipped` for valid completed outcomes;
- throw `UnrecoverableError` for permanent failures;
- throw a normal error for transient failures.

### R4. Retry and terminal failure

- Default attempts: `3`.
- Default backoff: exponential, starting at `10 seconds`.
- A non-receipt or malformed permanent payload must not retry.
- Provider timeout, `429`, `503`, `504` and temporary network errors may retry.
- Failure socket events must only represent permanent or final failure.
- Worker restart must allow waiting/active-stalled work to continue.

### R5. Capacity controls

The following must be environment-configurable:

```text
RECEIPT_WORKER_ENABLED
RECEIPT_WORKER_CONCURRENCY
RECEIPT_AI_RATE_LIMIT_MAX
RECEIPT_AI_RATE_LIMIT_DURATION_MS
RECEIPT_DOWNLOAD_TIMEOUT_MS
RECEIPT_SCAN_CACHE_TTL_SECONDS
```

Safe initial profiles:

| Environment                              | Worker instances | Concurrency per instance |
| ---------------------------------------- | ---------------: | -----------------------: |
| Local development                        |                1 |                        2 |
| All-in-one VPS, 2 shared vCPU / 8 GB RAM |                1 |                        2 |
| VPS fallback under resource pressure     |                1 |                        1 |

Total active scans are approximately:

```text
worker instances × concurrency per instance
```

The BullMQ rate limiter must be global for `RECEIPT_QUEUE` so adding worker
instances does not accidentally multiply Gemini request rate.

### R6. Status recovery

Socket.IO remains the fast notification channel, but it is not the source of
truth. An authenticated status endpoint must allow the client to recover after
refresh or socket disconnection:

```text
GET /api/v1/transactions/scan-receipt/:jobId
```

It must only expose jobs belonging to the authenticated user and return a
bounded public status:

```text
waiting | active | completed | failed
```

Completed cache-backed results may be returned when available. Internal stack,
provider response and raw job payload must never be returned.

### R7. Metrics and observability

Metrics must be available on localhost and usable later on the VPS.

Required metrics:

- receipt jobs enqueued;
- duplicate enqueue/cache hit;
- waiting and active job count;
- completed, skipped and failed jobs;
- retry count;
- final failure count;
- processing duration histogram;
- queue wait duration histogram;
- Gemini call duration and error count by safe error class;
- Cloudinary upload duration and error count;
- cache hit/miss count;
- current configured worker concurrency.

Metrics must not contain user ID, email, filename, image hash, receipt values or
other high-cardinality/sensitive labels.

Bull Board remains an operational UI, but it does not replace time-series
metrics.

### R8. Security and privacy

- Never log or expose base64 image data.
- Do not include receipt contents in metric labels.
- Status lookup must enforce job ownership.
- Cloudinary URL handling must not become a generic URL-fetch endpoint; workers
  process only server-generated job payloads.
- Download size and timeout must be bounded.
- Error messages sent to clients must be sanitized.

### R9. Graceful shutdown and deployment

- API and worker shutdown must wait for BullMQ close within a bounded timeout.
- A worker must not report terminal failure merely because the process is
  shutting down.
- `RECEIPT_WORKER_ENABLED=false` must allow an API-only process.
- Multiple API replicas must not all run workers unless deployment explicitly
  enables them.

## Acceptance criteria

- New FE receipt uploads appear in `RECEIPT_QUEUE` and Bull Board.
- New jobs contain an image URL and do not contain base64.
- At most the configured number of scans are active per worker instance.
- Duplicate concurrent intake for the same user/image does not call Gemini
  twice.
- Restarting the API after a `202` does not lose the accepted job.
- Retryable errors retry; permanent errors do not.
- Socket loss can be recovered through the status endpoint.
- Local metrics show queue depth, durations, retries, cache behavior and
  failures.
- Unit, integration, lint, typecheck and build checks pass.

## Edge cases

- Cloudinary succeeds but enqueue fails: deterministic asset remains reusable;
  the API returns an error and a later upload reuses the same asset.
- Client retries HTTP after timeout: stable job identity prevents duplicate
  business work.
- Cache becomes valid while a duplicate job waits: worker returns `skipped`.
- Socket emit fails after cache write: status/cache recovery still works.
- Worker crashes after Gemini succeeds but before cache write: BullMQ may call
  Gemini again; this limitation must be measured and documented.
- Redis unavailable after Cloudinary upload: no job is accepted as `202`.
- Gemini quota is lower than configured rate: metrics reveal `429`, then
  production configuration must be reduced.

## Success criteria

- Receipt capacity is controlled rather than determined by incoming traffic.
- Accepted scans are durable across process restarts.
- Redis memory grows with small job metadata, not image payload size.
- The same code works locally, on an all-in-one VPS and with managed
  MongoDB/Redis by changing environment variables only.
