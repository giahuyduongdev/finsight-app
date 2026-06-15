# Socket Profile Sync Design

Status: Draft.

## Summary

Add a general `user:profile-updated` socket event emitted after successful account profile updates. The frontend listens through `useAppSockets` and maps changed profile fields to targeted RTK Query invalidations and auth-state refresh behavior.

This keeps the app aligned with the existing realtime pattern: sockets announce that server data changed, while HTTP/RTK Query remains the authoritative data-fetching path.

## What General Sync Includes

Profile sync covers account-owned fields that can affect visible UI or derived app data.

Recommended first-version fields:

- `name`: affects navbar/account display.
- `profilePicture`: affects navbar/account display.
- `timezone`: affects analytics date boundaries, report periods, and transaction date-range filtering.
- `preferredCurrency`: affects analytics conversion and report display.

Optional later fields:

- report setting summary fields if account settings and report settings become one combined save flow.
- locale or number-format preferences if added later.
- notification preferences if they affect visible realtime behavior.

Excluded fields:

- `password`
- auth tokens
- refresh token metadata
- OAuth provider IDs
- email change verification state
- internal roles or security-sensitive flags

## Current State

- Backend socket rooms are keyed by authenticated `userId`.
- Transaction create/update/delete events are emitted to the user room.
- Frontend `useAppSockets` listens for transaction/import/recurring events and invalidates RTK Query tags.
- User update currently returns the updated user through the HTTP response, so the initiating tab updates through the API path.
- Other active tabs do not currently receive a profile-specific socket event.

## Recommended Approach

Use a minimal event payload:

```ts
type ProfileUpdatedSocketPayload = {
  userId: string
  changedFields: Array<
    'name' | 'profilePicture' | 'timezone' | 'preferredCurrency'
  >
  updatedAt: string
}
```

The event name should be:

```txt
user:profile-updated
```

Why this shape:

- It avoids broadcasting full user records.
- It lets the frontend choose precise invalidations.
- It is extensible without creating many field-specific socket events.
- It matches the current "event -> invalidate/refetch" architecture.

## Alternative Approaches

### Alternative A: Full User Payload

Emit the changed user fields directly:

```ts
{
  user: {
    name,
    profilePicture,
    timezone,
    preferredCurrency
  }
}
```

Pros:

- Other tabs can update auth state immediately.
- Less need for a user refetch.

Cons:

- Socket payload becomes a second user DTO.
- Higher risk of accidentally adding sensitive fields later.
- More frontend merge logic.

### Alternative B: Field-Specific Events

Emit events such as `timezone:updated`, `currency:updated`, and `profile-picture:updated`.

Pros:

- Very explicit.
- Small handlers per event.

Cons:

- Event surface grows quickly.
- More duplication in backend emit points and frontend listeners.
- Harder to maintain as Account Settings expands.

## Data Flow

1. User updates Account Settings in Tab A.
2. Backend validates and normalizes incoming profile data.
3. Backend persists the update.
4. Backend emits `user:profile-updated` to the user's socket room.
5. Tab A updates from the existing HTTP response.
6. Tab B receives the socket event.
7. Tab B invalidates relevant RTK Query tags.
8. Active queries refetch and UI converges to updated profile-derived data.

## Backend Design

Emit from the profile update boundary after persistence succeeds.

Recommended location:

- `backend/src/controllers/user.controller.ts` after `userService.update(...)` returns successfully, or
- `backend/src/services/user.service.ts` if service-layer emission is already accepted elsewhere.

The existing transaction socket pattern emits in controllers, so the surgical option is controller-level emission.

Changed fields can be derived from request body keys after validation:

- if `timezone` is present, include `timezone`
- if `preferredCurrency` is present, include `preferredCurrency`
- if `name` is present, include `name`
- if profile picture upload changes the stored value, include `profilePicture`

Event room:

```ts
io.to(userId).emit('user:profile-updated', payload)
```

Socket emit failure should not fail the HTTP request. Log the failure and return the successful update response.

## Frontend Design

Add a listener in `client/src/hooks/use-app-sockets.ts`.

Field-to-tag mapping:

- `timezone`: invalidate `user`, `analytics`, `transactions`, `report`
- `preferredCurrency`: invalidate `user`, `analytics`, `report`
- `name`: invalidate `user`
- `profilePicture`: invalidate `user`

If the app does not currently have an active `getCurrentUser` RTK Query cache, the listener should still invalidate `user` for future compatibility and optionally trigger an auth refresh endpoint if available.

The initiating tab already handles the API response path. Receiving the same socket event in the initiating tab should be harmless because invalidation refetches authoritative data.

## Cache And State Strategy

RTK Query tags remain the primary sync mechanism.

Do not store socket payloads as authoritative profile state. The payload only describes what changed.

Auth slice updates should continue to happen from:

- login/register/OAuth/refresh responses
- account update HTTP response
- optional future current-user refetch response

## Error Handling

- Missing or malformed socket payload: ignore and optionally log in development.
- Unknown field in `changedFields`: invalidate `user` only.
- Socket disconnected during update: no retry is required for v1 because HTTP remains authoritative.
- Emit failure: log backend error; do not roll back the persisted user update.

## Testing

Backend tests:

- profile update emits `user:profile-updated` to the authenticated user's room.
- payload includes only changed fields.
- timezone alias update emits `timezone` and stores canonical timezone.
- emit is not sent before persistence succeeds.

Frontend tests:

- receiving `timezone` invalidates `user`, `analytics`, `transactions`, and `report`.
- receiving `preferredCurrency` invalidates `user`, `analytics`, and `report`.
- receiving `name` or `profilePicture` invalidates only `user`.
- malformed payload does not crash the app.

Manual verification:

- Open two tabs as the same user.
- Change timezone in Tab A.
- Confirm dashboard/transaction/report data in Tab B refreshes without manual reload.
- Change preferred currency in Tab A.
- Confirm dashboard/report data in Tab B refreshes.
- Change name/profile picture in Tab A.
- Confirm account UI in Tab B refreshes or updates after user refetch.

## Security Review Notes

- Socket authentication already identifies the user room.
- Never trust `userId` from the client for room targeting.
- Emit only to the server-derived authenticated user ID.
- Keep payload minimal and non-sensitive.
- Do not expose full user model documents over sockets.

## Resolved Decisions

- First implementation includes a current-user refetch path through `GET /users/me`.
- Report settings are not included in `user:profile-updated` v1. They can get a separate report-settings event later if needed.
- The initiating tab does not ignore its own event in v1. Duplicate invalidation/refetch is acceptable for the simpler event contract.
