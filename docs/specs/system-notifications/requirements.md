# System Notifications - Requirements

## Status

Draft for review.

## Introduction

The current notification dropdown is static frontend data. Backend already emits many Socket.IO domain events, but there is no normalized notification inbox, no unread state, and no persistence.

This feature adds a user-facing system notification inbox backed by backend persistence and realtime socket delivery. Existing domain socket events continue to drive cache invalidation and workflow-specific UI. The notification system adds a separate, consistent surface for user-visible system activity.

## Goals

- Show real system notifications in the navbar dropdown instead of hard-coded items.
- Deliver new notifications realtime to the correct user via Socket.IO.
- Persist notification history so refresh, new tabs, and later sessions can load recent notifications.
- Track unread/read state per user.
- Allow notifications to navigate to related screens through an optional `actionUrl`.
- Allow related records to be highlighted after navigation through optional metadata or URL query params.

## Non-Goals

- Do not replace existing socket events used for cache invalidation, report refresh, auth logout, or import progress.
- Do not notify every transaction create/update/delete in v1 because that can spam the inbox.
- Do not build a full notification preferences system in v1.
- Do not add push notifications, email notifications, or browser service workers in v1.
- Do not make socket delivery the source of truth. The persisted notification API is the source of truth.

## User Stories

### Story 1 - Realtime Inbox

As a signed-in user,
I want new system notifications to appear in the navbar dropdown without refreshing,
so that I can notice background activity while using the app.

### Story 2 - Notification History

As a signed-in user,
I want recent notifications to still be visible after reload or login,
so that I do not lose important system updates.

### Story 3 - Read State

As a signed-in user,
I want unread notifications to be visually distinct,
so that I can tell what is new.

### Story 4 - Related Navigation

As a signed-in user,
I want clicking a notification to open the related page when available,
so that I can inspect the result quickly.

### Story 5 - Highlight Related Entity

As a signed-in user,
I want a clicked notification to highlight the related record when possible,
so that I can find it in a dense table.

## Functional Requirements

### R1. Persist Notification Records

Backend must store notification records with at least:

```ts
type Notification = {
  _id: string;
  userId: string;
  type: string;
  title: string;
  description?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  unread: boolean;
  actionUrl?: string;
  metadata?: {
    entityType?: 'transaction' | 'report' | 'receipt' | 'import' | 'rate' | 'session';
    entityId?: string;
    highlightId?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  readAt?: string | null;
};
```

### R2. Emit Normalized Realtime Event

After backend creates a user-visible notification, it must emit:

```ts
notification:created
```

to the target user's Socket.IO room.

Payload should be the saved notification document or a DTO with the same fields needed by the frontend.

### R3. Keep Domain Events

Existing events such as `bulk-import:completed`, `report:list-updated`, `receipt:scan-completed`, and `currency:rates_updated` must remain available for existing frontend behavior.

The normalized notification event is additive.

### R4. Initial Notification Sources

V1 should create notifications for background/system events:

- bulk import completed
- bulk import failed
- receipt scan completed
- receipt scan failed
- report generated
- report failed
- report no activity
- exchange rates updated
- recurring transaction processed

V1 should not create notifications for ordinary transaction CRUD by default.

Bulk import completion should navigate to the imported batch view rather than highlighting many rows:

```txt
/transactions?importBatchId=<batchId>
```

The Transactions table should show only transactions from that import batch and provide a clear action to return to the normal all-transactions view.

### R5. Notification API

Backend must expose authenticated endpoints:

- `GET /notifications` to fetch recent notifications for the current user.
- `PATCH /notifications/:notificationId/read` to mark one notification as read.
- `PATCH /notifications/read-all` to mark all current user's notifications as read.

All endpoints must scope by authenticated user.

### R6. Unread Behavior

Opening the notification dropdown must not automatically mark notifications as read.

Clicking a notification marks that notification as read.

The dropdown may include a `Mark all as read` action.

### R7. Click Behavior

When a notification is clicked:

- frontend marks it read
- if `actionUrl` exists, frontend navigates there
- if `actionUrl` does not exist, frontend stays on the current page

### R8. Highlight Related Entity

When a notification contains related entity metadata, frontend should preserve that context during navigation.

Receipt scan completion only means OCR/scanning completed. It should not imply that a transaction row exists yet.

When a transaction is actually saved and the created transaction id is available, frontend should navigate with either:

```ts
actionUrl: '/transactions?highlight=<transactionId>'
metadata: {
  entityType: 'transaction',
  entityId: '<transactionId>',
  highlightId: '<transactionId>'
}
```

or an equivalent contract. This applies to all successful transaction creation flows, including a transaction created after receipt scan data fills the form.

The transactions page should highlight the matching row temporarily, not permanently:

- apply a pale green background tint
- apply a 4px green accent on the row's left edge
- do not apply a full green outline or saturated green fill
- keep table columns aligned and do not add a temporary leading icon
- hold the highlight briefly, then fade back to the normal row style after 6 seconds
- if filters or pagination hide the row, the page should attempt a reasonable fallback such as reset filters or fetch by id if supported

### R9. Navbar Rendering

The notification dropdown must render from real notification state, not a hard-coded array.

Unread notifications should be visually distinct:

- unread dot or badge
- stronger title weight/color
- navbar bell indicator while unread count is greater than zero

Read notifications should be quieter:

- no red unread dot or a neutral dot
- normal title weight
- muted description/time

### R10. Frontend State

Frontend must maintain notification state through a shared store or RTK Query cache so `NotificationNav` and socket listeners use the same source.

On `notification:created`, frontend must add the notification to the visible list and update unread state without reload.

### R11. Source of Truth

The notification API is the source of truth. Socket events are best-effort delivery.

If socket is disconnected, refresh or later navigation must still load persisted notifications from the API.

### R12. Toast Presentation

Frontend must distinguish direct-action feedback from background-task notifications.

Direct-action feedback:

- uses the existing top-center toast placement
- keeps the existing compact success/error presentation
- automatically dismisses after 4 seconds unless the message requires user action

Background-task notifications:

- appear in a separate bottom-right toast stack
- contain a title and optional description
- may contain a contextual action such as `Review receipt`
- include a close control
- do not show a category label such as `BACKGROUND TASK`
- do not show a generic gear icon
- remain visible until dismissed or until the user follows the action

The top-center toast and bottom-right toast stack must not overlap the navbar notification dropdown.

On narrow/mobile viewports, both toast types may share a top stack, but their content and dismissal behavior must remain distinct.

## Acceptance Criteria

- The navbar notification dropdown no longer shows hard-coded placeholder notifications.
- New notification records are persisted for the v1 event sources.
- Connected clients receive `notification:created` realtime for their own notifications.
- Other users do not receive notifications that do not belong to them.
- Refreshing the page reloads recent notifications from backend.
- Clicking a notification marks it read.
- Opening the dropdown alone does not mark notifications read.
- Clicking a notification with `actionUrl` navigates to the related page.
- Creating a transaction can navigate to transactions and temporarily highlight the created transaction row when the transaction id is available.
- `Mark all as read` clears unread indicators for the current user.
- Existing cache invalidation/toast socket flows continue working.
- Direct-action feedback appears in the existing top-center toast position.
- Background-task notifications appear at bottom-right without a generic category label or gear icon.
- The transaction highlight uses a pale tint and left accent, then fades after 6 seconds.

## Edge Cases

- Socket emit fails after persistence: backend logs the failure but keeps the saved notification.
- Socket event arrives before initial API fetch completes: frontend should deduplicate by notification id.
- Duplicate domain events should not create duplicate notifications when an idempotency key is available.
- Notification action points to a record that was deleted or no longer visible: frontend still navigates and shows normal empty/not-found behavior.
- Highlighted entity is not on the current table page: frontend uses the best available fallback without breaking table state.
- User has no notifications: dropdown shows an empty state.
- User has many notifications: API paginates or limits recent notifications.

## Constraints

- Preserve existing Socket.IO authentication and per-user room model.
- Use existing backend controller/service/repository patterns.
- Use existing frontend RTK Query/socket hook patterns where practical.
- Keep v1 small and focused on system/background notifications.
- Do not introduce a new realtime library.

## Success Criteria

- Users can see system activity in the navbar notification dropdown without manual refresh.
- Notification state survives reload.
- Notification click behavior is predictable: mark read first, then navigate when possible.
- Related entity highlight helps users find the target record in dense screens.
- Existing tests for socket workflows still pass.
