# Receipt BullMQ Processing - Tasks

## Phase 0 - Baseline and configuration

- [ ] Capture current controller and legacy worker tests.
- [ ] Add validated receipt worker environment configuration.
- [ ] Add feature flag `RECEIPT_QUEUE_INTAKE_ENABLED`.
- [ ] Document local and all-in-one VPS profiles.
- [ ] Confirm current Gemini quota before production rollout.

## Phase 1 - Metrics foundation

- [ ] Add Prometheus-compatible metric registry and `/metrics` endpoint.
- [ ] Protect production metrics exposure.
- [ ] Add receipt counters, gauges and duration histograms.
- [ ] Add periodic queue-count collection without blocking requests.
- [ ] Verify metric labels contain no user, image or financial data.
- [ ] Add optional local Prometheus/Grafana Docker profile or documented curl
      workflow.

## Phase 2 - Durable receipt intake

- [ ] Extract receipt intake orchestration from transaction controller.
- [ ] Preserve MIME, size, compression and cache validation.
- [ ] Upload/reuse deterministic Cloudinary asset before enqueue.
- [ ] Build stable BullMQ-safe job ID from `userId + imageHash`.
- [ ] Enqueue URL-only receipt payload.
- [ ] Return `202` only after enqueue succeeds.
- [ ] Handle duplicate enqueue as the same accepted business job.
- [ ] Remove the untracked `void processReceiptScanInBackground()` path after
      rollout verification.

## Phase 3 - Worker migration

- [ ] Read concurrency and limiter from validated environment configuration.
- [ ] Preserve legacy payload support during migration.
- [ ] Optimize the new URL-only path.
- [ ] Enforce image download timeout and maximum response size.
- [ ] Preserve cache-first replay.
- [ ] Preserve permanent/transient error classification.
- [ ] Cache before socket completion.
- [ ] Emit terminal failure only for permanent/final failure.
- [ ] Add graceful shutdown coverage.

## Phase 4 - Status recovery

- [ ] Add authenticated receipt job status endpoint.
- [ ] Verify job ownership.
- [ ] Map BullMQ states to the public bounded status contract.
- [ ] Return cached completed result when available.
- [ ] Sanitize failed output.
- [ ] Update FE to recover after refresh/socket disconnect.
- [ ] Deduplicate repeated socket/status completion on the client.

## Phase 5 - Tests

- [ ] Unit test stable job identity.
- [ ] Unit test environment parsing and safe defaults.
- [ ] Unit test cache hit without Cloudinary/Gemini.
- [ ] Unit test Cloudinary failure does not enqueue or return `202`.
- [ ] Unit test enqueue failure handling.
- [ ] Unit test duplicate upload returns same job identity.
- [ ] Unit test URL-only worker payload.
- [ ] Unit test retryable and permanent failures.
- [ ] Unit test status authorization and sanitization.
- [ ] Unit test metrics and bounded labels.
- [ ] Redis integration test duplicate enqueue.
- [ ] Redis integration test configured concurrency.
- [ ] Restart/stalled integration test.
- [ ] Socket-loss recovery integration test.

## Phase 6 - Local verification

- [ ] Upload a receipt and observe it in Bull Board.
- [ ] Confirm job payload has URL and no base64.
- [ ] Submit more jobs than concurrency and observe waiting jobs.
- [ ] Upload the same image concurrently and verify one Gemini execution.
- [ ] Restart worker with waiting jobs and verify recovery.
- [ ] Verify `/metrics` changes for success, cache hit, retry and failure.
- [ ] Run lint, typecheck, unit tests, integration tests and build.

## Phase 7 - VPS rollout

- [ ] Configure one receipt worker with concurrency `2`.
- [ ] Configure global Gemini limiter from actual quota.
- [ ] Set Docker CPU/memory limits.
- [ ] Configure Redis persistence and MongoDB backup if self-hosted.
- [ ] Protect Bull Board and metrics.
- [ ] Observe CPU, memory, event-loop lag, queue wait p95, processing p95,
      retries and Gemini `429`.
- [ ] Reduce concurrency to `1` only if measurements show resource pressure.
- [ ] Do not increase above `2` without a new capacity review.
- [ ] Remove legacy base64 branch after retention window expires.

## Production verification gates

- [ ] Read the actual Gemini quota and lower the initial 10 RPM limiter if
      required.
- [ ] Verify API and worker run in separate containers.
- [ ] Verify self-hosted Redis persistence and MongoDB external backup.
- [ ] Verify metrics are reachable only through the private monitoring network.
- [ ] Verify receipt result/status retention is 24 hours.
- [ ] Verify cancellation remains out of scope.

## Validation checklist

- [ ] Requirements and design reviewed.
- [ ] Sequence matches implementation.
- [ ] No new receipt intake bypasses BullMQ.
- [ ] No new BullMQ job stores base64.
- [ ] Concurrency and limiter verified.
- [ ] Metrics verified locally.
- [ ] Security review completed.
- [ ] Acceptance criteria verified.
- [ ] Finishing-development-branch workflow completed.
