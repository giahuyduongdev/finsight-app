# Receipt BullMQ Processing - Design

## Decision summary

The selected approach uploads the compressed image to Cloudinary before
enqueueing and stores only `imageUrl` in BullMQ.

```text
FE
  -> API validate/compress/hash
  -> cache lookup
  -> deterministic Cloudinary upload/reuse
  -> RECEIPT_QUEUE.add(stable jobId, imageUrl)
  -> HTTP 202
  -> Receipt Worker
  -> cache lookup
  -> download bounded image
  -> Gemini extraction
  -> cache result
  -> socket completion
```

## Current problems addressed

| Current behavior                            | Consequence                            | Proposed correction                  |
| ------------------------------------------- | -------------------------------------- | ------------------------------------ |
| Controller starts an untracked Promise      | Restart loses accepted work            | Enqueue before returning `202`       |
| FE scans bypass `RECEIPT_QUEUE`             | Concurrency `2` and retry do not apply | Route all new scans through queue    |
| No receipt-specific backpressure            | Traffic can fan out Gemini calls       | Worker concurrency + global limiter  |
| Bull Board sees only legacy jobs            | Operations cannot inspect new scans    | New scans use the existing queue     |
| No durable status recovery                  | Socket loss leaves client uncertain    | Authenticated status endpoint        |
| No time-series metrics                      | Capacity cannot be tuned safely        | Prometheus-compatible metrics        |
| Duplicate requests race before cache write  | Duplicate Gemini cost                  | Stable job ID from user + image hash |
| Base64 legacy payload can consume Redis RAM | Queue depth risks Redis pressure       | URL-only payload for new jobs        |

## Alternatives considered

### A. Queue base64

Fastest intake after compression, but each waiting job can consume megabytes in
Redis. This is rejected for production and for the all-in-one VPS.

### B. Upload Cloudinary then enqueue URL

Selected. Intake waits for upload, but accepted jobs are durable, Redis payloads
remain small and retries can redownload the same deterministic asset.

### C. Dedicated object storage or temporary upload service

Good for larger scale, but adds infrastructure without solving a current
requirement better than Cloudinary.

## Components

### Receipt intake service

Move orchestration out of the controller into a focused service. The controller
only maps HTTP input/output.

Responsibilities:

- validation and compression;
- hash and cache lookup;
- deterministic Cloudinary upload;
- stable job ID construction;
- enqueue;
- public intake response.

This service must not perform Gemini extraction.

### Receipt queue

New job payload:

```ts
type ScanReceiptJobData = {
  userId: string
  imageUrl: string
  imageHash: string
  fileName: string
  fileSize: number
  correlationId?: string
  enqueuedAt: string
}
```

New jobs never set `fileBuffer`. The worker may temporarily retain legacy union
support during migration, then remove it after queue retention guarantees no
legacy jobs remain.

Suggested stable ID:

```text
receipt-scan-<userId>-<imageHash>
```

Only BullMQ-safe characters may be used.

### Receipt worker

The worker remains an I/O-heavy async worker. Sharp compression stays in intake;
Gemini extraction stays in the worker.

Worker options are built from validated environment variables:

```ts
{
  concurrency,
  limiter: {
    max: aiRateLimitMax,
    duration: aiRateLimitDurationMs
  }
}
```

Concurrency limits active promises. It is not the same as requests per minute.
The global limiter protects provider quota across workers.

### Status endpoint

The endpoint reads BullMQ state and verifies `job.data.userId` against the
authenticated user. It maps internal BullMQ states to a small public contract.

Completed results should preferably come from receipt cache, not unbounded job
return values. Failed output returns a sanitized message.

### Metrics

Use the shared registry, helpers and `/metrics` endpoint defined by
`docs/specs/project-observability-foundation`. Receipt does not create a second
registry or monitoring stack.

Use counters, gauges and histograms:

```text
receipt_jobs_total{outcome}
receipt_provider_calls_total{provider,outcome,error_class}
receipt_cache_total{result}
receipt_queue_jobs{state}
receipt_queue_wait_seconds
receipt_processing_seconds
receipt_provider_duration_seconds{provider}
receipt_worker_concurrency
```

Allowed labels are bounded enums only. Queue gauges may be refreshed
periodically with `getJobCounts()`; request processing must not block on metric
collection.

### Sentry

Use the shared Sentry background helper and sanitization policy defined by
`docs/specs/project-observability-foundation`.

Add a background-safe capture helper that accepts sanitized queue metadata
without requiring an Express request. Capture only:

- worker infrastructure errors;
- circuit-breaker open events;
- final BullMQ failure;
- unexpected permanent invariant failures.

Retry attempts, cache misses, duplicate jobs and user-caused non-receipt errors
remain logs/metrics only.

Receipt supplies only bounded domain metadata and never attaches raw job or
provider payloads. A Sentry SDK failure remains best-effort and never changes
the BullMQ outcome.

## Capacity model

For average processing time `T` seconds:

```text
approximate throughput = total concurrency × 60 / T jobs per minute
```

Examples for one worker:

| Concurrency | Average scan | Approximate maximum |
| ----------: | -----------: | ------------------: |
|           1 |    5 seconds |           12/minute |
|           2 |    5 seconds |           24/minute |
|           1 |   10 seconds |            6/minute |
|           2 |   10 seconds |           12/minute |

These are queue-processing estimates, not Gemini quota guarantees.

### Local profile

- concurrency `2`;
- one worker;
- metrics endpoint enabled;
- Bull Board enabled;
- rate limiter set conservatively but easy to override.

### Planned all-in-one VPS profile

Target machine:

- 2 AMD EPYC shared cores;
- 8 GB RAM;
- 35 GB NVMe.

Initial deployment:

- one API process;
- one worker process;
- receipt concurrency `2`;
- MongoDB and Redis may initially share the VPS for learning;
- Cloudinary and Gemini remain external;
- Docker resource limits and external database backups are required.

After observing CPU, event-loop lag, queue wait p95 and Gemini `429` rate,
concurrency may be reduced to `1` if the shared VPS experiences resource
pressure. No value higher than `2` is approved by this spec without new
measurements.

Moving MongoDB and Redis to managed services later requires environment changes,
not application redesign.

## Reliability boundaries

### Commit point

For intake, returning `202` is allowed only after `queue.add()` succeeds.

For processing, the durable completion point is a valid cache entry. Socket
delivery is best-effort and occurs after cache write.

### Idempotency

- Queue deduplication: stable `jobId`.
- Provider asset idempotency: deterministic Cloudinary public ID.
- Business replay: cache by `userId + imageHash`.

Gemini has no provider idempotency key. A crash after Gemini response but before
cache write may repeat extraction. This is accepted initially and measured.

### Shutdown

API and worker may be separated later. The worker close path must stop taking
new jobs and wait for active work within a configured shutdown timeout.

## Error classification

| Condition                                    | Classification         | Outcome                    |
| -------------------------------------------- | ---------------------- | -------------------------- |
| Unsupported file or missing payload          | HTTP/permanent         | reject before queue        |
| Non-receipt image                            | permanent              | failed without retry       |
| Invalid cached JSON                          | recoverable cache miss | continue and record metric |
| Cloudinary upload failure during intake      | request failure        | do not return `202`        |
| Image download timeout                       | retryable              | BullMQ retry               |
| Gemini `429`, `503`, `504`                   | retryable              | BullMQ retry/backoff       |
| Invalid Gemini JSON representing non-receipt | permanent              | no retry                   |
| Socket emit failure after cache              | secondary failure      | job remains completed      |

## Security

- Keep upload validation and compression limits.
- Reject downloads larger than a configured maximum.
- Process only URLs created by server-side Cloudinary upload.
- Do not log signed URLs, base64 or extracted financial fields.
- Do not send signed URLs, filenames, job payloads or extracted financial fields
  to Sentry.
- Protect `/metrics` in production through network policy, reverse proxy or
  explicit credentials.
- Protect status endpoint with JWT and job ownership checks.

## Migration and rollout

1. Add metrics and configuration validation.
2. Add intake service and enqueue path behind `RECEIPT_QUEUE_INTAKE_ENABLED`.
3. Keep legacy worker payload compatibility.
4. Enable locally and verify Bull Board/metrics.
5. Deploy with concurrency `1`.
6. Observe before removing old controller background code.
7. Remove base64 legacy branch only after old jobs cannot remain in Redis.

Rollback disables queue intake and restores the old path only during the
transition window. After rollout is accepted, the old untracked Promise path
must be deleted rather than maintained permanently.

## Testing strategy

- Unit tests for stable job ID, environment validation and error classification.
- Controller/service tests for cache hit, Cloudinary failure, enqueue failure
  and successful `202`.
- Worker tests for URL-only payload, replay, retry and permanent failure.
- Integration test with Redis for duplicate enqueue and concurrency.
- Restart test: enqueue, stop worker, start worker, verify completion.
- Status endpoint authorization tests.
- Metric tests for counters/histograms without sensitive labels.
- Load test with synthetic provider delay to verify active jobs never exceed
  configured concurrency.

## Risks

| Risk                                                         | Mitigation                                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Cloudinary upload increases intake latency                   | Accept bounded latency; return `202` only after durable enqueue                           |
| Shared VPS CPU contention                                    | Start concurrency `1`, measure before increasing                                          |
| Redis/Mongo on same VPS compete for memory/I/O               | Resource limits, persistence, backup and later managed migration                          |
| Gemini quota unknown                                         | Global rate limiter + `429` metrics + deployment gate                                     |
| Metric cardinality explosion                                 | Bounded enum labels; no user/job/image labels                                             |
| Job remains after cache expiry                               | Retention and status contract are independent; re-upload becomes new processing after TTL |
| Same image content changes after compression settings change | Compression version must be considered when changing hashing behavior                     |

## Decisions already made

- Use Cloudinary-before-queue.
- Queue URL only for new jobs.
- Keep asynchronous `202 + socket` UX.
- Add polling/status recovery.
- Make capacity settings environment-driven.
- Start all-in-one VPS receipt concurrency at `2`.
- Provide metrics from localhost onward.

## Final decisions

`DECISIONS.md` is the authoritative decision record for this feature.

The remaining production work is verification, not design:

1. Read the actual Gemini quota and lower the initial 10 RPM limiter if needed.
2. Run API and worker in separate production containers.
3. Allow Redis and MongoDB on the learning VPS initially.
4. Expose metrics only through the private Docker monitoring network.
5. Keep receipt result cache for 24 hours.
6. Do not support job cancellation in this phase.
