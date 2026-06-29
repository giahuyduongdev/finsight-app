# Receipt Scan Stale Pending Job Design

## Current Behavior

`RecieptScanner` stores only the pending job id:

```ts
sessionStorage.setItem('finsight:pending-receipt-job', jobId)
```

On mount, the component restores that job id and starts polling. If the job already completed but Redis no longer has the cached receipt result, the backend returns `completed` without `receipt`. The client then shows a stale error.

The issue becomes confusing when the user starts a new scan while the old restored poll is still active.

## Proposed Client Changes

### Pending Job Shape

Replace the bare string storage value with a JSON payload:

```ts
type PendingReceiptJob = {
  jobId: string
  createdAt: number
}
```

Keep a parser that accepts:

- valid JSON payload
- legacy bare string job id
- invalid data, which is cleared

Legacy bare strings should be treated as expired or restored only if we intentionally want compatibility. Recommended behavior: clear legacy strings to avoid unknown age.

### Restore Guard

Add:

```ts
const PENDING_RECEIPT_JOB_TTL_MS = 2 * 60 * 1000
```

On mount:

1. Read pending job payload.
2. If missing, do nothing.
3. If invalid or expired, remove it.
4. If valid, restore `pendingJobId`, set loading state, and start progress.

### New Upload Guard

At the start of `handleReceiptUpload`, before setting preview or sending the request:

1. Stop polling interval.
2. Stop progress simulation.
3. Stop safety timeout.
4. Stop completion timeout.
5. Clear current pending job from state and storage.

This ensures an old job cannot race with the new job.

### Polling Behavior

When polling receives:

- `completed` with `receipt`: fill form and clear pending job.
- `completed` without `receipt`: clear pending job, reset UI, show expired previous scan message.
- `failed`: clear pending job, reset UI, show failure message.
- `waiting` or `active`: keep polling.

The existing `pendingJobIdRef.current !== pendingJobId` guard remains important and should stay.

### Socket Behavior

Socket success/failure handlers already check the current job id:

```ts
if (!pendingJobIdRef.current || payload.jobId !== pendingJobIdRef.current) return
```

Keep that guard. It prevents old socket events from updating the UI after a new scan starts.

## Optional Backend Improvement

If client-only handling is not clear enough, backend can return a distinct status when the job is completed but cached result is gone:

```ts
status: 'expired'
```

Then the client can handle `expired` directly. This is optional for the first fix because the current response shape can already be handled safely.

## Testing

Preferred client tests:

- restores valid fresh pending job
- clears expired pending job on mount
- clears legacy/invalid pending job values
- clears old pending job before new upload
- handles `completed` without receipt as expired and stops polling
- ignores old socket event when `jobId` does not match current pending job

Manual test:

1. Put an expired pending job payload in `sessionStorage`.
2. Open Add Transaction.
3. Confirm no stale background polling toast appears.
4. Upload a new receipt.
5. Confirm only the new scan state is shown.
