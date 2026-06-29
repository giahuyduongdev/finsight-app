# Receipt Scan Stale Pending Job Requirements

## Problem

The receipt scanner can show stale error toasts when the browser still has an old pending receipt scan job in `sessionStorage`, but the backend no longer has the scan result cached.

Observed UI:

- `Receipt result is no longer available. Please scan again`
- Immediately followed by `Receipt is being processed in background`

This means an old restored job and a new upload job can overlap in the UI.

## Goal

Make receipt scan state predictable when an old pending job is restored, expired, replaced, or completed without cached result.

## Scope

- Update client receipt scanner state handling.
- Add a short TTL to pending receipt jobs stored in `sessionStorage`.
- Clear old pending jobs before starting a new upload.
- Stop old polling/timers when a pending job becomes invalid.
- Improve user-facing message for expired previous scans.
- Add focused tests for stale pending-job behavior if the existing client test setup supports it.

## Non-Goals

- Do not redesign receipt scanning.
- Do not change OCR provider behavior.
- Do not change BullMQ worker processing.
- Do not change Redis TTL policy unless client-only handling is insufficient.
- Do not add a new notification system.

## Requirements

### R1: Store Pending Job With Metadata

The client must store pending receipt scan state as JSON instead of a bare string:

```json
{
  "jobId": "receipt-scan-user-hash",
  "createdAt": 1782730800000
}
```

The parser must tolerate the previous bare-string format and clear invalid values.

### R2: Pending Job TTL

When restoring a pending job from `sessionStorage`, the client must ignore and remove it if it is older than the allowed restore window.

Recommended TTL: 2 minutes.

### R3: New Upload Replaces Old Pending Job

When the user selects a new receipt image, the client must:

- stop old polling
- stop old safety timeout
- clear old pending job from state and `sessionStorage`
- then create the new scan request

### R4: Completed Without Receipt Means Expired Result

If backend status is `completed` but no `receipt` is present, the client must:

- clear the pending job
- stop polling
- stop progress simulation
- show a clear message:

```text
Previous receipt scan expired. Please upload again.
```

### R5: No Duplicate Toasts From Old Job

After a new upload starts, responses from the old job must not trigger success/error toasts.

### R6: Existing Success Path Remains

The current success paths must continue to work:

- immediate scan response with `receipt`
- background response with `jobId`
- socket event `receipt:scan-completed`
- polling response with `completed` and `receipt`

## Acceptance Criteria

- Reloading the page with an expired pending job does not keep polling forever.
- Uploading a new file after a stale job does not show the stale job error toast.
- A completed job without cached receipt result is cleared and shown as an expired previous scan.
- Current receipt scan success behavior still fills the transaction form.
