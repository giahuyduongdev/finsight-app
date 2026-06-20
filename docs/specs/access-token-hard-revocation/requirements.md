# Access Token Hard Revocation - Requirements

## Status

Draft for review.

## Goal

Immediately reject access tokens issued before an all-session security event, even when the client is offline, misses the socket event, or intentionally keeps an old token.

MongoDB remains the source of truth for the user's token version. Redis may be used as a read-through performance cache, but it must not weaken revocation correctness.

## Current Context

The backend currently:

- signs access tokens with `userId`
- validates JWT signature, issuer, audience, algorithm, and expiry
- blacklists the access token presented by normal logout or logout-all
- revokes refresh tokens for all-session security events
- emits `auth:session-revoked` so connected clients logout in realtime
- caches user data in Redis under `user:<userId>`

Current logout-all does not know the access tokens held by other devices. Those tokens may remain server-valid until their 15-minute expiry if the clients miss the socket event.

## Scope

This feature adds account-wide access-token invalidation using a monotonically increasing `tokenVersion`.

It applies to:

- logout all devices
- successful password change
- successful password reset
- successful email change

It does not apply to normal logout, which remains scoped to the current session and continues using the existing access-token blacklist.

## Functional Requirements

### R1. Persist token version on each user

Add an integer `tokenVersion` field to the user model.

- default value: `0`
- minimum value: `0`
- server-managed only
- never writable through profile/account update input
- not required in public user API responses

Existing users without the field must be handled safely.

### R2. Include token version in access JWTs

Every newly issued access token must contain:

```ts
{
  userId: string;
  tokenVersion: number;
}
```

This includes access tokens issued by:

- email/password login
- OAuth login
- refresh-token exchange
- any other existing access-token issuance path

Refresh tokens do not need a version claim because their persisted records are already revoked by all-session flows.

### R3. Validate token version on every authenticated request

After JWT cryptographic validation, authentication must compare:

- `payload.tokenVersion`
- current persisted `user.tokenVersion`

If they differ, authentication returns `401 Unauthorized`.

The rejected token must not reach route controllers.

### R4. Increment version on all-session revocation

The backend must atomically increment `tokenVersion` when any of these operations succeeds:

- logout all devices
- password change OTP verification
- password reset
- email change OTP verification

The increment must happen as part of the security outcome, before the API reports success.

### R5. Keep normal logout session-scoped

Normal logout must not increment `tokenVersion`.

It continues to:

- revoke the current refresh token
- blacklist the presented access token until its JWT expiry
- synchronize sibling tabs in the same browser profile through the existing local logout channel

Other devices remain logged in after normal logout.

### R6. Keep refresh-token revocation

All-session flows must continue revoking/deleting all refresh tokens in addition to incrementing `tokenVersion`.

Token versioning does not replace refresh-token revocation.

### R7. Keep realtime socket sync

The existing `auth:session-revoked` event remains in place for immediate user experience.

Token-version validation is the security boundary. Socket delivery is only a realtime notification and client cleanup mechanism.

### R8. Redis cache must not allow stale authorization

If Redis caches token versions:

- use a dedicated key, separate from `user:<userId>`
- MongoDB remains authoritative
- revocation must invalidate or replace the cached version
- Redis failure must fall back to MongoDB
- the application must not accept an old token merely because a stale cache value exists

The exact cache-coherence policy must be approved before implementation.

### R9. Return a generic authentication error

A token-version mismatch returns the same public authentication outcome as another invalid/revoked token.

Do not expose:

- current token version
- token version from the JWT
- revocation reason
- internal cache state

Structured internal logs may include `userId` and a generic mismatch reason, but never the raw JWT.

### R10. Preserve current blacklist behavior

The existing Redis blacklist remains responsible for immediate single-token revocation during normal logout.

Token versioning handles account-wide revocation.

## Acceptance Criteria

- Access token A and access token B are issued for the same user at version `0`.
- Logout-all using token A increments the user to version `1`.
- Token A and token B both receive `401` on their next protected request.
- All refresh tokens for the user are revoked.
- A new login issues an access token with version `1`, and it is accepted.
- Normal logout blacklists only the presented access token and does not increment the user's version.
- Password change, password reset, and email change invalidate all previously issued access tokens.
- A connected client still receives `auth:session-revoked`.
- Redis unavailability falls back to MongoDB without accepting a stale token.
- Public errors and logs do not expose raw tokens or version values.

## Edge Cases

- Existing user documents without `tokenVersion`.
- Existing access tokens without a `tokenVersion` claim during deployment.
- Concurrent logout-all requests.
- Login or refresh racing with token-version increment.
- Redis unavailable during request validation.
- Redis unavailable or stale during revocation.
- User deleted after JWT issuance.
- OAuth users and password users sharing the same validation path.
- Access token expires normally before version validation matters.

## Out Of Scope

- Device/session management UI.
- Revoke one selected device.
- Per-device token version.
- Replacing JWTs with opaque sessions.
- Changing access-token lifetime.
- Removing the current blacklist.
- Rotating JWT signing secrets.

## Success Criteria

- All account-wide security events immediately invalidate old access tokens at the backend.
- The result does not depend on socket delivery or frontend cooperation.
- Normal logout retains current-session semantics.
- Added authentication checks have measured and acceptable latency.
- Automated tests cover issuance, validation, revocation, fallback, and concurrency-sensitive behavior.

## Decisions Required Before Implementation

1. **Legacy access tokens**
   - Recommended: treat a missing `tokenVersion` claim as invalid and require login after deployment.
   - Alternative: temporarily interpret a missing claim as version `0`, which avoids mass logout but leaves old tokens valid until expiry.

2. **Redis cache consistency**
   - Strict hard revocation cannot trust a stale positive cache entry.
   - Recommended initial implementation: check MongoDB on each authenticated request, then add Redis only after a fail-closed coherence strategy is proven.
   - If Redis is required in v1, define how revocation prevents stale keys from authorizing old tokens across processes and temporary Redis failures.

3. **Failure behavior**
   - Recommended: if both Redis and MongoDB cannot provide the current version, reject the request rather than fail open.
   - Decide whether the public status is `401` or `503`; recommendation is `503` for infrastructure failure and `401` only for a confirmed mismatch.

4. **Version field exposure**
   - Recommended: keep `tokenVersion` internal and omit it from API DTOs, Redux state, socket payloads, and logs.

