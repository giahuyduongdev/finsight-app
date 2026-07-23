# Refresh Token Rotation - Requirements

## Introduction

Finsight currently verifies refresh JWTs and checks a persisted refresh-token
digest before issuing a new access token. The same refresh token can be reused
until it expires or is explicitly revoked. This spec changes refresh tokens to a
rotating, single-use credential: every successful refresh exchange revokes the
presented refresh token and issues a replacement refresh token.

The feature reduces the impact of a leaked refresh token. If a used token is
seen again outside a short concurrency grace window, the backend treats it as a
replay signal and revokes the affected refresh-token lineage.

## Goals

- Make refresh tokens single-use after successful exchange.
- Return a new refresh token on every successful refresh exchange.
- Detect reuse of already-rotated refresh tokens.
- Allow a short grace window for legitimate near-simultaneous refresh requests.
- Keep raw refresh tokens out of MongoDB and logs.
- Preserve the current `/api/v1/auth/refresh-token` endpoint and cookie-based
  client contract.

## Non-Goals

- Do not implement per-device session management UI.
- Do not introduce JWKS, RS256, or signing-key infrastructure changes.
- Do not move refresh-token persistence from MongoDB.
- Do not store raw refresh JWTs.
- Do not change access-token signing or verification semantics.

## User Stories

### Story 1 - Normal Session Continuity

As an authenticated user, I want my session to continue when my access token is
refreshed so that I do not need to sign in again during normal use.

### Story 2 - Leaked Refresh Token Containment

As a user whose refresh token may have leaked, I want the backend to detect
reuse of an old refresh token so that the attacker cannot keep minting new
access tokens.

### Story 3 - Concurrency Tolerance

As a user with multiple tabs or a retrying client, I want a near-simultaneous
refresh retry to avoid logging me out unnecessarily.

### Story 4 - Operator Confidence

As an operator, I want replay detection to emit safe, useful logs so that
security events can be investigated without exposing tokens.

## Acceptance Criteria

- [ ] A successful refresh exchange revokes the presented active refresh-token
  record.
- [ ] A successful refresh exchange creates a new active refresh-token record
  for the same user and same refresh-token lineage.
- [ ] The refresh endpoint sets the `refreshToken` httpOnly cookie to the new
  refresh token after every successful exchange.
- [ ] The refresh response remains successful for clients using cookie-based
  auth and includes the new access token and expiration as today.
- [ ] If the refresh token is supplied in the request body, the service still
  supports it and returns enough data for non-cookie clients to update their
  stored refresh token.
- [ ] A reused token that is the immediately previous token in the same lineage
  and is within the configured grace window does not trigger replay revocation;
  it may receive a short-lived success response without another refresh-token
  rotation.
- [ ] A reused token outside the grace window triggers lineage revocation and
  returns a generic unauthorized response.
- [ ] A reused token older than the immediately previous token triggers lineage
  revocation even if it appears within the grace window.
- [ ] Expired, malformed, unknown, or wrong-user refresh tokens continue to fail
  with generic unauthorized behavior.
- [ ] Raw refresh tokens are never stored in MongoDB or written to logs.

## Edge Cases

- Two browser tabs call refresh with the same active token at nearly the same
  time.
- The client retries refresh because the first response was lost after the
  server committed rotation.
- A stolen refresh token is replayed after the legitimate client has already
  rotated it.
- A much older refresh token is replayed after several successful rotations.
- Logout or logout-all races with refresh-token rotation.
- The process crashes after revoking the old token but before persisting the
  new token.
- MongoDB transaction support is unavailable in a local test environment.
- The refresh cookie is present while the request body also contains a refresh
  token.

## Constraints

- Use the existing `RefreshTokenModel` collection and HMAC digest persistence.
- Continue using `verifyRefreshToken` for JWT signature, issuer, audience, and
  expiry checks.
- Use a MongoDB transaction where available so old-token revocation and
  new-token creation commit atomically.
- Keep public errors generic; do not reveal whether replay detection fired.
- Keep the grace window small and configurable, with a conservative default of
  10 seconds.
- Do not rely on client-provided device identifiers in this slice.

## Success Criteria

- A refresh token cannot be used repeatedly to mint unlimited access tokens.
- Legitimate duplicate refresh requests within the grace window do not revoke
  the session family.
- Reuse outside the grace window revokes the affected lineage and prevents the
  newest refresh token in that lineage from being used.
- Existing login, OAuth callback, logout, logout-all, and access-token
  authentication behavior remains intact.
- Unit and integration tests cover normal rotation, grace-window reuse, replay
  revocation, and logout/revocation races.
