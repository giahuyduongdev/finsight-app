# Auth Session Sync - Requirements

## Status

Draft for review.

## Goal

Synchronize session-ending auth events across all active app tabs/devices for the same user through authenticated socket events.

The user-visible outcome is:

- When one tab logs out all sessions, other tabs are logged out without waiting for the next API call.
- When a sensitive account change revokes sessions, all open tabs react immediately.
- Server-side token/session revocation remains the source of truth; socket events are only the realtime delivery mechanism.

## Current Context

Backend already has flows that revoke sessions:

- `POST /api/v1/auth/logout-all`
- password change OTP verification
- email change OTP verification
- password reset from forgot-password flow

The frontend already has:

- authenticated app socket connection
- `useAppSockets` as the central listener for app-level socket events
- Redux auth state with `logout()`
- RTK Query API cache
- refresh-token fallback on HTTP 401

## Scope v1

V1 covers realtime user logout for existing session-ending flows:

- normal logout across tabs in the same browser profile
- logout all sessions
- password changed successfully
- email changed successfully
- password reset successfully, if the backend can identify the affected user

V1 does not add a session/device management screen.

## Local Logout Sync

Normal logout should remain scoped to the current browser/device session. It must not call `/auth/logout-all`.

However, when a user has multiple tabs open in the same browser profile, logging out in one tab should clear the other tabs too. This is a frontend-only sync using `BroadcastChannel` with a `localStorage` event fallback.

Event:

```ts
auth:local-logout
```

Behavior:

- Tab A calls `POST /auth/logout`.
- Tab A clears local auth state and broadcasts `auth:local-logout`.
- Tab B in the same browser profile receives the local event.
- Tab B clears auth state, resets API cache, and redirects to `/`.
- Other devices and other browser profiles are not affected.

## Recommended Event

Use one shared event:

```ts
auth:session-revoked
```

Reasoning:

- All affected client behavior is the same: clear auth state and send user back to login.
- `reason` in the payload is enough to customize toast/message.
- Fewer socket listeners are easier to maintain than separate auth events.

## Payload

```ts
type AuthSessionRevokedPayload = {
  userId: string;
  reason:
    | 'logout-all'
    | 'password-changed'
    | 'email-changed'
    | 'password-reset';
  scope: 'all-sessions';
  redirectTo: '/';
  message: string;
  source: 'api';
  revokedAt: string;
};
```

Do not include tokens, refresh-token ids, OTP data, old email, new email, password metadata, or user profile data.

## Functional Requirements

### R1. Emit after logout-all succeeds

After `logoutAllService` completes successfully, backend emits `auth:session-revoked` to the user's socket room.

Payload:

- `reason: 'logout-all'`
- `scope: 'all-sessions'`
- `source: 'api'`

The current tab may receive the same event as other tabs. Client handling must be idempotent.

### R2. Emit after password change revokes sessions

After password change OTP verification succeeds and refresh tokens are revoked, backend emits `auth:session-revoked`.

Payload:

- `reason: 'password-changed'`
- `scope: 'all-sessions'`
- `source: 'api'`

### R3. Emit after email change revokes sessions

After email change OTP verification succeeds and refresh tokens are revoked, backend emits `auth:session-revoked`.

Payload:

- `reason: 'email-changed'`
- `scope: 'all-sessions'`
- `source: 'api'`

This matches current backend behavior, where email change revokes existing sessions.

### R4. Emit after password reset revokes sessions

After forgot-password reset succeeds and refresh tokens are revoked, backend emits `auth:session-revoked` if it has the affected `userId`.

Payload:

- `reason: 'password-reset'`
- `scope: 'all-sessions'`
- `source: 'api'`

This lets already-open logged-in tabs react immediately when the account password is reset elsewhere.

### R5. Socket emit failure must not undo revocation

If socket emit fails:

- auth API still returns the correct business response
- refresh-token/session revocation stays committed
- backend logs a warning/error with `userId` and `reason`
- client still falls back to 401 refresh failure behavior later

### R6. Frontend clears auth state on event

When client receives `auth:session-revoked`:

- dispatch `logout()`
- reset or invalidate authenticated RTK Query cache
- show a short toast based on `reason`
- redirect to `/`

The handler must tolerate duplicate events.

### R7. Listener cleanup

`useAppSockets` must unsubscribe from `auth:session-revoked` on cleanup/unmount.

### R8. Socket is not a security boundary

The backend must not rely on the client receiving this socket event for authorization.

Existing token validation, refresh-token revocation, access-token blacklist, and 401 handling remain required.

### R9. Normal logout syncs only same-browser tabs

When the navbar logout flow succeeds or falls back to client cleanup, the frontend broadcasts a local logout event.

Other open tabs on the same browser profile must logout and redirect to `/`.

This must not revoke sessions on other devices.

## Acceptance Criteria

- Tab A calls logout-all; Tab B logs out and redirects to login without manual reload.
- Tab A completes password change; all open tabs for that user clear auth state.
- Tab A completes email change; all open tabs for that user clear auth state.
- Password reset invalidates active logged-in tabs when possible.
- Normal navbar logout in Tab A logs out Tab B in the same browser profile.
- Normal navbar logout does not use `/auth/logout-all`.
- Another user does not receive the event.
- Event payload contains no token, OTP, password, or email-change sensitive data.
- Socket emit failure does not break the API success path after revocation succeeds.
- Frontend listener cleans up correctly.
- Backend unit tests cover emit success and emit failure paths.
- Frontend tests cover listener behavior and cleanup.

## Out Of Scope

- Device/session list UI.
- Revoke one selected device/session.
- Changing refresh-token schema.
- Changing login, refresh, or registration contracts.
- Adding user-facing security notification history.
- Reworking all JWT/session validation unless the open decision below is accepted.
- Cross-browser same-device logout detection.

## Important Open Decision

Current backend revokes refresh tokens and blacklists the current access token for some flows. It does not necessarily invalidate every already-issued access token immediately, because other tabs/devices may still hold access tokens that are not known to the server blacklist.

That means there are two possible security levels:

1. **Realtime UX sync only, recommended for this slice**
   - Emit socket event so open tabs log out immediately.
   - Keep existing refresh-token revocation and 401 fallback.
   - Existing access tokens may remain server-valid until they expire if the client does not receive the socket event.

2. **Hard server-side all-session access-token invalidation**
   - Add a `tokenVersion` or `sessionVersion` to user/session records.
   - Include that version in JWT access tokens.
   - Check it on every authenticated request.
   - Increment it on logout-all/password/email/password-reset revocation.
   - Bigger auth refactor, higher security, more tests.

Option 1 was implemented first as `auth-session-sync`. Option 2 is now
implemented in `docs/specs/access-token-hard-revocation/`.
