# Socket Profile Sync Requirements

Status: Draft.

## Goal

Synchronize user profile and account-setting changes across active app sessions through existing authenticated app socket events.

The first target is timezone consistency after the timezone-normalization feature. The broader target is a reusable profile-sync event that can cover Account Settings changes without adding one socket event per field.

## Scope

General profile sync means synchronizing user-owned settings that affect visible UI, cached data, or server-side calculations.

Initial fields:

- `name`
- `profilePicture`
- `timezone`
- `preferredCurrency`
- report settings summary when the existing account settings flow updates report preferences, if that flow shares the same profile update boundary

Derived data affected by these fields:

- analytics summaries, charts, and expense breakdowns
- transaction list date-range filtering when it depends on user timezone
- report generation previews and report list state when settings or timezone/currency affect displayed report data
- navbar/account UI that displays name or profile picture

Out of scope for the first version:

- password, email, and auth credential changes
- refresh-token/session revocation events
- notification history or toast persistence
- broadcasting full sensitive user records over sockets
- replacing RTK Query HTTP fetching with socket-driven data storage

## Users

- Users signed in on multiple browser tabs.
- Users signed in on multiple devices.
- Frontend features that rely on current user timezone, currency, name, or profile picture.
- Backend services that need cached analytics/report data invalidated after profile-affecting changes.

## User Stories

- As a user, when I update timezone in Account Settings, my other active tabs use the new timezone without waiting for a full manual refresh.
- As a user, when I update preferred currency, dashboard analytics and reports refresh with the new currency.
- As a user, when I update name or profile picture, account UI in other active tabs updates or refetches.
- As a developer, I can emit one profile-sync event after account settings changes instead of adding separate socket events for every profile field.

## Acceptance Criteria

- Backend emits an authenticated room event after a successful profile/account settings update.
- The event is emitted only to the affected user's socket room.
- Frontend listens for the event from the existing app socket hook.
- Frontend invalidates/refetches affected RTK Query tags based on changed fields.
- Timezone changes invalidate analytics and transaction date-range data.
- Preferred currency changes invalidate analytics and report-related data.
- Name/profile picture changes refresh user/account UI state.
- The current tab that initiated the update remains correct through the existing API response path.
- Other active tabs converge to the same profile values without manual refresh.
- Socket payload does not include sensitive fields such as password hashes, refresh tokens, OAuth IDs, or internal auth metadata.
- If the socket event is missed, the app remains correct after normal API refetch, page reload, or auth refresh.

## Edge Cases

- User updates timezone from `Asia/Saigon` and backend stores `Asia/Ho_Chi_Minh`.
- User updates preferred currency and analytics cache already contains values for the previous currency.
- User updates only name or profile picture; analytics should not be refetched unnecessarily.
- User has two tabs open and updates Account Settings in one tab.
- User has two devices open and updates Account Settings on one device.
- Socket is disconnected during the update.
- Socket reconnects after the update.
- Backend update succeeds but socket emit fails.
- Frontend receives an event with unknown changed fields.

## Constraints

- Follow the existing socket pattern: socket event signals that data changed; RTK Query remains the source for HTTP data.
- Keep payload minimal.
- Do not introduce a new realtime state-management layer.
- Do not broadcast profile changes outside the user's room.
- Keep changes surgical and avoid unrelated socket refactors.
- Reuse existing RTK Query tags where practical: `user`, `analytics`, `transactions`, `report`.

## Success Criteria

- Updating timezone in Account Settings refreshes analytics/transaction/report data in other active tabs.
- Updating preferred currency refreshes analytics/report data in other active tabs.
- Updating name/profile picture refreshes user-facing account UI in other active tabs.
- Tests cover backend event emission and frontend event handling/invalidation behavior.
- Client lint/typecheck pass.
- Backend relevant tests pass.
