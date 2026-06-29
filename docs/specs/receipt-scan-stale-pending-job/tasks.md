# Receipt Scan Stale Pending Job Tasks

## 1. Client State Model

- [ ] Add `PendingReceiptJob` type in `reciept-scanner.tsx`.
- [ ] Add `PENDING_RECEIPT_JOB_TTL_MS`.
- [ ] Add helper to parse pending job storage safely.
- [ ] Add helper to write pending job storage with `createdAt`.
- [ ] Clear invalid or expired pending job storage on restore.

## 2. New Upload Reset

- [ ] Clear existing pending job before processing a newly selected file.
- [ ] Stop old progress simulation before new upload starts.
- [ ] Stop old safety timeout before new upload starts.
- [ ] Stop old completion timeout before new upload starts.
- [ ] Keep blob URL cleanup behavior unchanged.

## 3. Polling Result Handling

- [ ] Keep `completed` with `receipt` success behavior.
- [ ] Treat `completed` without `receipt` as expired previous result.
- [ ] Clear pending state and storage when result is expired.
- [ ] Stop polling/timers when result is expired.
- [ ] Use message: `Previous receipt scan expired. Please upload again.`

## 4. Socket Safety

- [ ] Keep job id mismatch guard in socket success handler.
- [ ] Keep job id mismatch guard in socket failure handler.
- [ ] Confirm old job events do not update the form after new upload starts.

## 5. Tests

- [ ] Add or update client tests for expired pending job restore.
- [ ] Add or update client tests for invalid pending job storage.
- [ ] Add or update client tests for new upload clearing old pending job.
- [ ] Add or update client tests for completed-without-receipt handling.

## 6. Verification

- [ ] Run `pnpm.cmd --dir client run type-check`.
- [ ] Run `pnpm.cmd --dir client run lint`.
- [ ] Run `pnpm.cmd --dir client run test`.
- [ ] Run `pnpm.cmd --dir client run build`.
- [ ] Run `git diff --check`.
