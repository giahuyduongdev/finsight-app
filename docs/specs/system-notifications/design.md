# System Notifications - Design

## Overview

Add a persisted notification inbox and a normalized realtime event:

```ts
notification:created
```

Backend remains responsible for deciding which domain events deserve user-facing notifications. Frontend renders notifications from API-backed state and listens to the normalized socket event for realtime updates.

Existing domain events remain unchanged. They continue to refresh data, show workflow toasts, and handle auth/session behavior.

## Current State

Backend already has Socket.IO infrastructure:

- authenticated sockets
- users join their own room
- domain events for transactions, import, receipt scan, reports, auth session, user profile, and currency rates

Frontend already listens to several domain events in `useAppSockets`, but the navbar notification dropdown uses a hard-coded array.

## Architecture

### Backend

Add a notification domain:

- `notification.model.ts`
- `notification.repository.ts`
- `notification.service.ts`
- `notification.controller.ts`
- `notification.routes.ts`
- optional `notification-socket.util.ts`

The service creates a notification, persists it, then emits `notification:created` to the user's room.

Domain code calls the notification service only after the related business operation has succeeded.

### Frontend

Add notification state through RTK Query and a small socket integration:

- `features/notification/notificationType.ts`
- `features/notification/notificationAPI.ts`
- optional `features/notification/notificationSlice.ts` if local ordering/dedup is easier outside RTK Query
- update `useAppSockets` to listen for `notification:created`
- update `NotificationNav` to render real data
- update transactions page to support `highlight` query param

## Data Model

Recommended Mongo shape:

```ts
type NotificationDocument = {
  userId: ObjectId;
  type: string;
  title: string;
  description?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  unread: boolean;
  actionUrl?: string;
  metadata?: {
    entityType?: string;
    entityId?: string;
    highlightId?: string;
    [key: string]: unknown;
  };
  idempotencyKey?: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
```

Indexes:

- `{ userId: 1, createdAt: -1 }`
- `{ userId: 1, unread: 1, createdAt: -1 }`
- unique sparse `{ userId: 1, idempotencyKey: 1 }` if idempotency is implemented in v1

## Socket Contract

Event:

```ts
notification:created
```

Payload:

```ts
type NotificationCreatedPayload = {
  _id: string;
  type: string;
  title: string;
  description?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  unread: true;
  actionUrl?: string;
  metadata?: {
    entityType?: string;
    entityId?: string;
    highlightId?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  readAt?: null;
};
```

Do not include another user's `userId` in frontend payload unless needed for debugging. The socket room already scopes delivery.

## API Design

### GET `/notifications`

Returns recent notifications for the authenticated user.

Query params:

- `limit?: number`, default 20, max 50
- `cursor?: string`
- `unreadOnly?: boolean`

Response:

```ts
{
  data: NotificationDto[];
  meta: {
    unreadCount: number;
    nextCursor?: string;
  }
}
```

### PATCH `/notifications/:notificationId/read`

Marks one notification as read for the authenticated user.

Behavior:

- no-op if already read
- 404 if notification does not belong to the current user or does not exist

Response:

```ts
{
  data: NotificationDto
}
```

### PATCH `/notifications/read-all`

Marks all current user's unread notifications as read.

Response:

```ts
{
  data: {
    updatedCount: number;
    unreadCount: 0
  }
}
```

## Notification Sources

### Bulk Import

When import completes:

```ts
{
  type: 'bulk_import.completed',
  title: 'Transactions imported',
  description: '<n> transactions were added successfully.',
  severity: 'success',
  actionUrl: '/transactions?importBatchId=<batchId>',
  metadata: { entityType: 'import', entityId: '<batchId>' }
}
```

The Transactions API accepts `importBatchId` and scopes it by the authenticated user. The table shows only transactions created by that batch and renders a compact banner with a clear action to return to the normal list.

When import fails:

```ts
{
  type: 'bulk_import.failed',
  title: 'Transaction import failed',
  description: '<safe user-facing message>',
  severity: 'error',
  actionUrl: '/transactions'
}
```

### Receipt Scan

Receipt scan completion means OCR/scanning completed and the form can be filled. It does not mean a transaction row exists yet.

```ts
{
  type: 'receipt_scan.completed',
  title: 'Receipt scan completed',
  description: 'Receipt scan data is ready to review.',
  severity: 'success',
  actionUrl: '/transactions',
  metadata: {
    entityType: 'receipt'
  }
}
```

When scan fails:

```ts
{
  type: 'receipt_scan.failed',
  title: 'Receipt scan failed',
  description: '<safe user-facing message>',
  severity: 'error',
  actionUrl: '/transactions'
}
```

### Transaction Create Navigation

V1 does not create inbox notifications for ordinary transaction CRUD to avoid notification noise. However, after any successful manual transaction creation, the frontend should navigate to:

```txt
/transactions?highlight=<createdTransactionId>
```

This applies to regular Add Transaction and to transactions created after receipt scan fills the form. Backend already returns the created transaction DTO from `POST /transactions`; frontend should type that response and use `_id` for the highlight URL.

### Reports

Create notifications from terminal worker outcomes:

- `report.generated`
- `report.failed`
- `report.no_activity`

Use `actionUrl: '/reports'`.

Do not create duplicate notifications for the same final report state.

### Exchange Rates

When rates are updated:

```ts
{
  type: 'currency.rates_updated',
  title: 'Exchange rates updated',
  description: 'Latest currency rates are ready to use.',
  severity: 'info',
  actionUrl: '/rates',
  metadata: { entityType: 'rate' }
}
```

Because currency rates are broadcast-style system data, v1 should decide whether to persist one notification per user or keep this as frontend-only. Recommended v1 backend approach: only create user-specific notifications when there is a clear user context. If no user context exists, leave currency rates as existing realtime UI/toast behavior and add persisted notifications later.

### Recurring Transactions

When recurring transaction processing completes for a user:

```ts
{
  type: 'recurring_transaction.processed',
  title: 'Recurring transactions processed',
  description: '<safe summary message>',
  severity: 'success',
  actionUrl: '/transactions'
}
```

## Frontend Data Flow

1. App mounts and authenticated user exists.
2. `NotificationNav` queries `GET /notifications`.
3. `useAppSockets` listens for `notification:created`.
4. When socket event arrives, frontend inserts or upserts the notification by `_id`.
5. Bell indicator updates if unread count is greater than zero.
6. User opens dropdown. No read mutation is sent.
7. User clicks a notification.
8. Frontend calls mark-read mutation.
9. If `actionUrl` exists, frontend navigates to it.
10. If the destination supports highlight metadata or `highlight` query param, it highlights the matching entity temporarily.

## Toast Presentation

Use two toast stacks with different responsibilities:

### Direct-Action Toasts

Direct feedback follows an action initiated by the current user, such as successfully creating a transaction.

- keep the existing top-center placement
- preserve the current compact success/error style
- default to a 4-second duration
- avoid action buttons unless the result genuinely requires a next step

### Background-Task Toasts

Background feedback reports asynchronous work such as receipt scanning or report generation.

- place the stack at bottom-right
- render title, optional description, optional contextual action, and close control
- do not render a generic gear icon
- do not render a `BACKGROUND TASK` category label
- keep the toast visible until dismissed or its action is followed

The navbar notification dropdown and direct-action toast do not collide because the direct-action stack remains top-center. On narrow/mobile viewports, use one top stack while preserving each toast's content and dismissal rules.

## Highlight Design

Transactions page should parse:

```txt
/transactions?highlight=<transactionId>
```

If the highlighted transaction is visible in the current table:

- apply a pale green background tint
- add a 4px green accent on the row's left edge
- do not use a saturated fill, full-row outline, or temporary icon
- scroll into view if table virtualization or page layout requires it
- hold briefly and fade back to the normal row style after 6 seconds

If the highlighted transaction is not visible:

- keep normal table behavior
- optionally reset filters or fetch by id if existing APIs support it
- do not block navigation

The highlight is an orientation aid, not durable state.

## Error Handling

Backend:

- Creating the notification should not run before the main domain operation succeeds.
- If notification persistence fails, log it. Do not fail already-completed business work unless the notification is part of the requested operation.
- If socket emit fails after persistence, log it and keep the saved notification.
- Sanitize descriptions so internal errors are not exposed.

Frontend:

- If mark-read fails, keep the item visible and optionally leave it unread.
- If navigation action is invalid, regular router behavior applies.
- If socket disconnects, API fetch remains the recovery path.
- Deduplicate socket/API race by `_id`.

## Testing Strategy

Backend unit tests:

- notification service persists and emits to the correct user room
- emit failure does not delete persisted notification
- list endpoint scopes results to current user
- mark-read endpoint rejects notifications owned by another user
- read-all only updates current user's notifications
- domain integrations create expected notification payloads for selected v1 sources

Frontend tests:

- `NotificationNav` renders API notifications and empty state
- unread indicator appears when unread count is positive
- opening dropdown does not mark read
- clicking a notification calls mark-read
- clicking a notification with `actionUrl` navigates
- `notification:created` inserts/deduplicates a notification
- `/transactions?highlight=<id>` highlights the matching row when visible
- direct-action toasts use the top-center stack and default duration
- background-task toasts use the bottom-right stack without a category label or gear icon
- transaction highlight renders the pale tint and left accent, then clears after 6 seconds

Manual verification:

- Open two tabs as the same user.
- Trigger receipt scan completion.
- Both tabs receive a new navbar notification.
- Click the notification in one tab and confirm it marks read and navigates to `/transactions?highlight=<id>`.
- Confirm the created transaction row is temporarily highlighted.
- Refresh and confirm notification history is loaded from backend.

## Technical Decisions

- Use a normalized `notification:created` event rather than making the navbar understand every domain event.
- Persist notifications in backend so socket is not the source of truth.
- Do not mark read on dropdown open.
- Click notification means mark read, then navigate if an action exists.
- Add optional `metadata` for entity-specific behavior such as table row highlight.
- Exclude ordinary transaction CRUD notifications in v1 to avoid notification spam.
- Keep direct-action feedback top-center and background-task feedback bottom-right.
- Use content and persistence, rather than a visible category badge, to distinguish background-task toasts.
- Use a pale row tint and left accent for transaction orientation instead of a saturated fill or full outline.

## Tradeoffs

- Backend persistence is more work than frontend-only socket mapping, but it solves reload/history and unread state correctly.
- A normalized event adds another layer beside domain events, but it keeps frontend notification rendering stable as domain events evolve.
- Highlight support adds frontend complexity, but it materially improves usability for dense tables.

## Risks

- Duplicate notifications if domain workers retry. Mitigate with idempotency keys where available.
- Too many notifications from noisy background jobs. Keep v1 source list narrow.
- Currency rate updates may lack user context. Keep them out of persisted v1 if there is no user-specific trigger.
- Highlight behavior may be limited by current transaction table pagination/filter API.
