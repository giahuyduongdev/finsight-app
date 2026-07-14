# Receipt Scanner Effects Requirements

## Introduction

This spec covers the React Doctor follow-up branch `fix/receipt-scanner-effects`. The scope is limited to effect/callback timing in `client/src/features/transaction/components/reciept-scanner.tsx`.

## Current Findings

React Doctor reports receipt scanner warnings for:

- `prefer-use-effect-event` in the socket listener effect.
- `prefer-use-effect-event` in the polling effect.
- `no-prop-callback-in-effect` for `onLoadingChange`.

The component has no React Doctor errors. Previous branches already fixed timer cleanup.

## Goals

- Reduce unnecessary socket listener re-subscription.
- Reduce unnecessary polling effect re-subscription caused by callback identity changes.
- Preserve receipt scan behavior across immediate response, background socket completion, polling completion, failure, timeout, and restored pending job.
- Keep the change local to receipt scanner effect timing.

## Non-Goals

- Do not split `ReceiptScanner` into smaller components in this branch.
- Do not change backend API, socket event names, or receipt status contract.
- Do not change sessionStorage pending job format or TTL.
- Do not redesign upload/progress UI.

## Design

Use React's `useEffectEvent` for async callbacks that run inside effects:

- `completeSuccess`
- `resetState`
- `onScanComplete`
- `onLoadingChange`
- pending job clearing through local ref/state/sessionStorage updates

The socket listener effect should subscribe based on `socket` only. The polling effect should subscribe based on the active `pendingJobId` and API status trigger, while using effect events for result handling.

The upload handler can keep using existing callbacks directly because it is an event handler, not an effect subscription.

Because the local ESLint hooks plugin does not yet recognize `useEffectEvent`, the implementation uses narrow `react-hooks/exhaustive-deps` disables on the affected dependency arrays. The effect-event callbacks stay out of dependency arrays to satisfy React Doctor's `no-effect-event-in-deps` rule.

## Acceptance Criteria

- `pnpm.cmd --dir client run type-check` passes.
- `pnpm.cmd --dir client run lint` passes.
- `pnpm.cmd --dir client run build` passes.
- Full React Doctor scan is recorded.
- Manual upload receipt test checklist is recorded.
- No behavior changes outside receipt scanner.

## Final Results

- `type-check`, `lint`, `build`, and receipt scanner Vitest coverage pass.
- Full React Doctor result: `14 errors`, `20 warnings`, `21 affected files`, score `51/100`, label `Critical`.
- Targeted receipt scanner findings fixed: `prefer-use-effect-event`, `no-prop-callback-in-effect`, and receipt scanner `no-impure-state-updater`.
- Remaining receipt scanner findings are outside this branch's scope: `no-giant-component` and `no-pass-data-to-parent`.

## Manual Test Checklist

When backend/provider credentials are available, test:

- Upload a valid receipt image.
- Immediate scan completion fills the transaction form.
- Background `jobId` response shows progress and completes from socket or polling.
- Failed scan shows error and resets loading state.
- Timeout path resets progress and loading state.
- Closing/reopening with pending job restores polling.
