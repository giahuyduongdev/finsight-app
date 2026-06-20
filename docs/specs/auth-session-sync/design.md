# Auth Session Sync - Design

## Approach

Use a single authenticated socket event, `auth:session-revoked`, emitted after backend session revocation succeeds.

The event is consumed by `useAppSockets`, which clears local auth state, clears authenticated API cache, shows a message, and redirects to login.

Normal logout uses a separate frontend-only local broadcast so all tabs in the same browser profile clear auth together without revoking other devices.

This keeps the implementation consistent with existing realtime sync features:

- backend business flow remains source of truth
- socket emit happens after persistence/revocation
- emit failure is logged but does not fail the main flow
- frontend refetch/state cleanup is centralized in the app socket hook

## Backend Design

### Event helper

Create a small backend helper for emitting auth session events.

Proposed shape:

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

Behavior:

```ts
getIO().to(userId).emit('auth:session-revoked', payload);
```

The helper catches/logs socket errors and does not throw.

### Emit points

Emit only after the revocation step succeeds.

Recommended emit points:

- `logoutAllController` after `logoutAllService(userId, accessToken)`
- `verifyChangePasswordOTPController` after `verifyChangePasswordOTPService(userId, body)`
- `verifyChangeEmailOTPController` after `verifyChangeEmailOTPService(userId, body)`
- password reset controller/service after reset succeeds and refresh tokens are deleted

If a service throws before revocation, do not emit.

### Message mapping

Keep messages generic and non-sensitive.

Suggested messages:

```ts
{
  'logout-all': 'Your sessions were ended. Please sign in again',
  'password-changed': 'Your password changed. Please sign in again',
  'email-changed': 'Your email changed. Please sign in again',
  'password-reset': 'Your password was reset. Please sign in again'
}
```

### Security rules

- Emit only to the authenticated user room.
- Payload must not contain tokens, OTPs, old/new email, or password data.
- Socket emit must not be treated as authorization enforcement.
- Keep existing blacklist/refresh-token revocation behavior.

## Frontend Design

### Local logout channel

Add a small frontend helper for same-browser logout sync.

Responsibilities:

- publish `auth:local-logout` after navbar logout performs local cleanup
- subscribe once near app/socket auth lifecycle
- clear auth state and redirect in sibling tabs
- use `BroadcastChannel` when available
- use a `localStorage` event fallback for older browsers

This helper is frontend-only. It does not replace backend `/auth/logout-all`.

### Listener

Add one listener in `client/src/hooks/use-app-sockets.ts`:

```ts
socket.on('auth:session-revoked', handleAuthSessionRevoked);
```

Handler behavior:

1. Ignore invalid payloads gracefully.
2. Show toast from `payload.message` or fallback text.
3. Dispatch `logout()`.
4. Reset authenticated API cache with `apiClient.util.resetApiState()` if available.
5. Redirect to `payload.redirectTo` or `/`.

The handler must be idempotent because:

- current tab may also receive the event it caused
- BroadcastChannel/401 fallback may also trigger logout
- socket reconnection can produce edge-case duplicates

### Redirect strategy

Preferred v1 strategy:

- central socket hook uses `window.location.assign('/')` after clearing state

Reason:

- `useAppSockets` is not a route component
- the behavior must work from any page
- it avoids coupling the socket hook to React Router navigation context

If an existing app-level navigation helper exists, use that instead.

### Cache cleanup

Dispatch:

```ts
apiClient.util.resetApiState()
```

This is stronger than invalidating selected tags because auth revocation makes every authenticated query stale.

### Cleanup

On hook cleanup:

```ts
socket.off('auth:session-revoked', handleAuthSessionRevoked);
```

## Data Flow

### Logout current browser profile

1. User clicks navbar logout in Tab A.
2. Tab A calls `POST /auth/logout`.
3. Tab A clears Redux auth state and API cache.
4. Tab A publishes `auth:local-logout`.
5. Tab B receives local logout event.
6. Tab B clears Redux auth state and API cache.
7. Tab B redirects to `/`.

### Logout all devices

1. User triggers a sensitive auth action in Tab A.
2. Backend validates the request.
3. Backend revokes refresh tokens / relevant session state.
4. Backend emits `auth:session-revoked` to the user's socket room.
5. Tab A and Tab B receive the event.
6. Each tab clears Redux auth state and API cache.
7. Each tab redirects to login.

## Error Handling

Backend:

- API/service errors before revocation return existing error responses.
- Socket emit errors are logged and swallowed.
- Revocation success must not be rolled back due to socket delivery failure.

Frontend:

- Missing `message` uses fallback toast.
- Missing `redirectTo` uses `/`.
- Duplicate events should not produce broken state.
- If socket is disconnected, later API calls still fall back to refresh/401 handling.
- Duplicate local logout events should be ignored after the first cleanup.

## Test Strategy

### Backend unit tests

Cover:

- logout-all success emits `auth:session-revoked`
- password change success emits `password-changed`
- email change success emits `email-changed`
- password reset success emits `password-reset`, if included in v1
- emit failure is logged and does not fail the response
- failed business validation does not emit

### Frontend tests

Use Vitest for `useAppSockets`.

Cover:

- receiving `auth:session-revoked` dispatches `logout()`
- API cache reset action is dispatched
- toast is shown
- redirect happens
- listener is removed on cleanup
- duplicate event is safe
- local logout broadcast clears sibling tabs without calling logout-all

### Manual verification

Open two tabs as the same user.

Scenarios:

- Tab A navbar logout, Tab B in the same browser profile goes to login.
- Tab A navbar logout does not logout a different browser/device.
- Tab A logout-all, Tab B goes to login automatically.
- Tab A changes password, both tabs go to login.
- Tab A changes email, both tabs go to login.
- Reset password from forgot-password flow while a logged-in tab is open; logged-in tab goes to login if backend emits the event.
- Repeat with socket disconnected; next API call should still log out through 401/refresh failure.

## Hard Revocation Extension

Strict immediate server-side access-token invalidation is implemented in
`docs/specs/access-token-hard-revocation/`:

- store `tokenVersion` or `sessionVersion` on user
- include version in access JWT
- validate version in JWT middleware
- increment version on all-session revocation flows
- test that old access tokens are rejected immediately
