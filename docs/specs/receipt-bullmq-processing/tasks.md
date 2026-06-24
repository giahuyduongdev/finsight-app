# Receipt BullMQ Processing - Tasks

## Phase 0 - Baseline and configuration

- [x] Capture current controller and legacy worker tests.
- [x] Add validated receipt worker environment configuration.
- [x] Add feature flag `RECEIPT_QUEUE_INTAKE_ENABLED`.
- [x] Document local and all-in-one VPS profiles.
- [ ] Record active Gemini RPM, input TPM and RPD from Google AI Studio for each
      Receipt model/project without recording API key values.
- [ ] Confirm whether the five configured Gemini keys belong to one project or
      multiple projects.
- [ ] Confirm current Gemini quota again before production rollout.

## Phase 1 - Metrics foundation

- [x] Confirm `project-observability-foundation` contracts are available.
- [x] Register Receipt queue lifecycle with shared BullMQ metrics.
- [x] Add receipt cache/outcome metrics through the shared registry.
- [x] Use shared provider metrics for Gemini and Cloudinary.
- [x] Verify metric labels contain no user, image or financial data.
- [x] Use the shared background-safe Sentry capture helper.
- [x] Capture Receipt Worker infrastructure error, circuit-breaker open and
      final failure.
- [x] Verify retries, cache misses, duplicates and user non-receipt errors do
      not create Sentry noise.
- [x] Verify Sentry failure cannot change job outcome.

## Phase 2 - Durable receipt intake

- [x] Extract receipt intake orchestration from transaction controller.
- [x] Preserve MIME, size, compression and cache validation.
- [x] Upload/reuse deterministic Cloudinary asset before enqueue.
- [x] Build stable BullMQ-safe job ID from `userId + imageHash`.
- [x] Enqueue URL-only receipt payload.
- [x] Return `202` only after enqueue succeeds.
- [x] Handle duplicate enqueue as the same accepted business job.
- [x] Remove the untracked `void processReceiptScanInBackground()` path after
      rollout verification.

## Phase 3 - Worker migration

- [x] Read concurrency and limiter from validated environment configuration.
- [x] Preserve legacy payload support during migration.
- [x] Optimize the new URL-only path.
- [x] Enforce image download timeout and maximum response size.
- [x] Preserve cache-first replay.
- [x] Preserve permanent/transient error classification.
- [x] Cache before socket completion.
- [x] Emit terminal failure only for permanent/final failure.
- [ ] Add graceful shutdown coverage.

## Phase 4 - Status recovery

- [x] Add authenticated receipt job status endpoint.
- [x] Verify job ownership.
- [x] Map BullMQ states to the public bounded status contract.
- [x] Return cached completed result when available.
- [x] Sanitize failed output.
- [x] Update FE to recover after refresh/socket disconnect.
- [x] Deduplicate repeated socket/status completion on the client.

## Phase 5 - Tests

- [x] Unit test stable job identity.
- [x] Unit test environment parsing and safe defaults.
- [x] Unit test cache hit without Cloudinary/Gemini.
- [x] Unit test Cloudinary failure does not enqueue or return `202`.
- [x] Unit test enqueue failure handling.
- [x] Unit test duplicate upload returns same job identity.
- [x] Unit test URL-only worker payload.
- [x] Unit test retryable and permanent failures.
- [x] Unit test status authorization and sanitization.
- [x] Unit test metrics and bounded labels.
- [x] Unit test Sentry worker capture allowlist.
- [x] Unit test Sentry receipt payload and URL scrubbing.
- [x] Unit test retry/non-receipt paths do not capture Sentry events.
- [x] Unit test terminal/infrastructure failure capture.
- [x] Redis integration test duplicate enqueue.
- [x] Redis integration test configured concurrency.
- [x] Restart/stalled integration test.
- [x] Socket-loss recovery integration test.

## Phase 6 - Local verification

- [ ] Upload a receipt and observe it in Bull Board.
- [ ] Confirm job payload has URL and no base64.
- [ ] Submit more jobs than concurrency and observe waiting jobs.
- [x] Submit at least six jobs concurrently and verify active jobs never exceed
      `2`.
- [ ] Submit more than 10 distinct jobs within one minute and verify the global
      limiter delays excess jobs without failing them.
- [ ] Upload the same image concurrently and verify one Gemini execution.
- [x] Restart worker with waiting jobs and verify recovery.
- [ ] Verify `/metrics` changes for success, cache hit, retry and failure.
- [ ] Record queue wait p95, processing p95, Gemini `429`, CPU and RAM.
- [ ] If Gemini returns `429`, reduce the limiter to 5 jobs/minute and rerun the
      same test.
- [ ] If there is no `429` and the queue remains backlogged, test 15 jobs/minute
      before considering 20.
- [ ] Verify Cloudinary failure prevents enqueue and prevents a `202` response.
- [ ] Trigger one terminal worker failure and verify a sanitized Sentry event.
- [ ] Trigger retryable failures and verify they affect metrics without creating
      one Sentry issue per attempt.
- [ ] Run load tests with trace sampling disabled or reduced.
- [x] Run lint, typecheck, unit tests, integration tests and build.

## Phase 7 - VPS rollout

- [x] Configure one receipt worker with concurrency `2`.
- [ ] Configure global Gemini limiter from actual quota.
- [ ] Set Docker CPU/memory limits.
- [ ] Configure Redis persistence and MongoDB backup if self-hosted.
- [ ] Protect Bull Board and metrics.
- [ ] Observe CPU, memory, event-loop lag, queue wait p95, processing p95,
      retries and Gemini `429`.
- [ ] Reduce concurrency to `1` only if measurements show resource pressure.
- [x] Do not increase above `2` without a new capacity review.
- [ ] Remove legacy base64 branch after retention window expires.

## Production verification gates

- [ ] Read the actual Gemini quota and lower the initial 10 RPM limiter if
      required.
- [ ] Verify API and worker run in separate containers.
- [ ] Verify self-hosted Redis persistence and MongoDB external backup.
- [ ] Verify metrics are reachable only through the private monitoring network.
- [x] Verify receipt result/status retention is 24 hours.
- [x] Verify cancellation remains out of scope.

## Validation checklist

- [x] Implementation và manual-test guide được ghi tại
      `IMPLEMENTATION_AND_MANUAL_TEST.md`.
- [x] Requirements and design reviewed.
- [x] Sequence matches implementation.
- [x] No new receipt intake bypasses BullMQ.
- [x] No new BullMQ job stores base64.
- [x] Concurrency and limiter verified.
- [x] Metrics verified locally.
- [x] Security review completed.
- [x] Acceptance criteria verified.
- [ ] Finishing-development-branch workflow completed.
