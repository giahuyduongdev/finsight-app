# System Notifications - Implementation Plan

## Overview

Implement a persisted notification inbox with realtime Socket.IO delivery and a real navbar dropdown. Keep existing domain socket behavior intact.

## Tasks

- [x] Create backend notification model, DTO/type, repository, service, controller, and routes.
- [x] Add notification indexes for user/date, user/unread/date, and optional idempotency.
- [x] Add `notification:created` socket emit helper or service method.
- [x] Add `GET /notifications`.
- [x] Add `PATCH /notifications/:notificationId/read`.
- [x] Add `PATCH /notifications/read-all`.
- [x] Wire notification creation into selected v1 sources:
  - [x] bulk import completed
  - [x] bulk import failed
  - [x] receipt scan completed
  - [x] receipt scan failed
  - [x] report generated
  - [x] report failed
  - [x] report no activity
  - [x] recurring transaction processed
- [x] Decide implementation handling for currency rate notifications:
  - [x] persist only if there is user context
  - [ ] defer persisted currency notification and keep existing realtime behavior
- [x] Add backend tests for service persistence, socket emit, user scoping, and read endpoints.
- [x] Create frontend notification types and API client endpoints.
- [x] Update `useAppSockets` to listen for `notification:created` and upsert/deduplicate notifications.
- [x] Replace hard-coded `NotificationNav` data with API-backed notification state.
- [x] Add unread visual states, empty state, click-to-read, and optional `Mark all as read`.
- [x] Implement notification click behavior:
  - [x] mark read
  - [x] navigate to `actionUrl` when present
  - [x] stay on page when no `actionUrl`
- [x] Add transaction table highlight support for `/transactions?highlight=<transactionId>`.
- [x] Navigate to `/transactions?highlight=<createdTransactionId>` after successful transaction creation.
- [x] Add bulk import batch filter support for `/transactions?importBatchId=<batchId>`.
- [x] Add frontend tests for dropdown rendering, unread state, socket insert, and click behavior.
- [x] Add frontend test coverage for transaction highlight.
- [ ] Keep direct-action feedback in the existing top-center toast stack with a 4-second default duration.
- [ ] Add a bottom-right stack for background-task toasts.
- [ ] Remove the generic gear icon and `BACKGROUND TASK` label from background-task toasts.
- [ ] Keep background-task toasts visible until dismissed or their action is followed.
- [ ] Restyle transaction highlight with a pale green tint and 4px left accent.
- [ ] Fade transaction highlight back to normal after 6 seconds.
- [ ] Add frontend tests for toast placement, dismissal behavior, and the revised transaction highlight.
- [x] Run backend tests, frontend tests, lint, typecheck, and build.
- [ ] Perform manual two-tab realtime verification.

## Dependencies

- Existing Socket.IO authentication and user room behavior.
- Existing auth middleware for backend routes.
- Existing transaction, report, receipt, and import flows.
- Existing frontend RTK Query and socket hook patterns.

## Validation Checklist

- [x] Backend unit tests pass.
- [x] Frontend tests pass.
- [x] Lint passes.
- [x] Typecheck passes.
- [x] Build passes.
- [x] Existing socket workflows still work.
- [x] Notifications are scoped to the current user.
- [x] Refresh loads persisted notification history.
- [x] Opening dropdown does not mark read.
- [x] Clicking notification marks it read.
- [x] Clicking notification with `actionUrl` navigates.
- [x] Transaction row can be highlighted when notification action includes `?highlight=<transactionId>`.
- [ ] Direct-action and background-task toasts render in their specified stacks.
- [ ] Background-task toasts render without a generic gear icon or category label.
- [ ] Transaction highlight uses the approved subtle style and clears after 6 seconds.
- [x] Socket disconnect/reconnect does not lose persisted notifications.
- [x] Security review completed because this adds user-scoped endpoints and persisted user data.
