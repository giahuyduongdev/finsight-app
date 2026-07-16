# JWT Verification Hardening - Requirements

## Status

Draft.

## Goal

Make every JWT verification path enforce the same server-owned JWT contract:
expected algorithm, issuer, audience, expiry, and token revocation state.

This is a focused hardening pass. It does not replace the existing
`tokenVersion`, refresh-token digest storage, Redis blacklist, or Passport JWT
strategy.

## Current Context

The backend already has these protections:

- HTTP protected routes use Passport JWT with `algorithms: ['HS256']`,
  `audience: ['user']`, and `issuer: Env.JWT_ISSUER`.
- Access tokens include `userId` and `tokenVersion`.
- Access-token authentication checks the current persisted user
  `tokenVersion`.
- Refresh tokens are stored as HMAC digests in MongoDB.
- Access-token blacklist Redis keys use HMAC digests instead of raw tokens.
- Normal logout blacklists the presented access token until its JWT expiry.

The remaining gaps are around consistency between JWT verification paths and
clear behavior for refresh/logout edge cases.

## Scope

In scope:

- Hardening `verifyAccessToken`.
- Hardening `verifyRefreshToken`.
- Aligning socket JWT verification with HTTP Passport JWT policy.
- Defining and testing refresh-route behavior when a stale or blacklisted access
  token is attached to a refresh request.
- Clarifying normal logout behavior when the presented access token cannot be
  cryptographically verified.
- Adding regression tests for JWT algorithm and audience enforcement.

Out of scope:

- Replacing JWT with opaque sessions.
- Changing access-token lifetime.
- Rotating JWT secrets.
- Reworking `tokenVersion`.
- Reworking refresh-token persistence.
- Device/session management UI.
- Broad auth refactors unrelated to JWT verification policy.

## Functional Requirements

### R1. Access-token helper must whitelist the signing algorithm

`verifyAccessToken` must explicitly pass:

```ts
algorithms: ['HS256']
```

It must continue validating:

- `JWT_SECRET`
- `audience: 'user'`
- `issuer: Env.JWT_ISSUER`
- expiry

Tokens using `alg=none` or any algorithm other than `HS256` must be rejected.

### R2. Refresh-token helper must whitelist algorithm and audience

`verifyRefreshToken` must explicitly pass:

```ts
algorithms: ['HS256']
audience: 'refresh'
```

It must continue validating:

- `JWT_REFRESH_SECRET`
- `issuer: Env.JWT_ISSUER`
- expiry

An access token must not be accepted by the refresh-token verifier.

### R3. HTTP and socket access-token verification must stay aligned

HTTP protected routes already use Passport JWT with `HS256`, `issuer`, and
`audience` checks.

Socket authentication uses `verifyAccessToken` directly, so the helper must be
at least as strict as the Passport strategy.

### R4. Refresh route must keep global blacklist fail-closed behavior

`POST /auth/refresh-token` authenticates using the refresh token from the
HttpOnly cookie or request body.

The global blacklist middleware must continue applying to refresh requests. If a
refresh request carries `Authorization: Bearer <accessToken>` and that access
token is blacklisted, the request must be rejected before refresh-token
validation.

This is intentional fail-closed behavior. The client should treat this as a
session-ending authentication failure and require sign-in again.

### R5. Normal logout must keep best-effort cleanup semantics

Normal logout must always try to revoke the refresh token and clear the refresh
cookie.

Access-token blacklisting may remain best-effort:

- If the access token verifies successfully, use its expiry to set blacklist
  TTL.
- If verification fails because the token is malformed, signed with the wrong
  algorithm, has the wrong audience/issuer, or is expired, do not trust the
  token claims for authorization.
- The API should still complete logout cleanup when refresh-token revocation is
  valid, instead of failing only because blacklist TTL cannot be computed.

### R6. Public errors must stay generic

JWT verification failures must not reveal:

- accepted algorithms
- current token version
- token audience mismatch details
- whether a token was blacklisted
- raw token content

Internal logs must not include raw JWTs.

### R7. Encoding must not be changed

Some auth files contain existing Vietnamese comments with mojibake. This
feature must not repair, convert, or rewrite file encodings as a side effect.

When editing files that contain Vietnamese text, create a backup first and use
the smallest possible patch.

## Acceptance Criteria

- `verifyAccessToken` rejects `alg=none` access tokens.
- `verifyAccessToken` rejects non-`HS256` access tokens.
- `verifyAccessToken` still accepts valid existing HS256 access tokens with
  `audience: 'user'` and correct issuer.
- `verifyRefreshToken` rejects `alg=none` refresh tokens.
- `verifyRefreshToken` rejects non-`HS256` refresh tokens.
- `verifyRefreshToken` rejects tokens without `audience: 'refresh'`.
- `verifyRefreshToken` rejects access tokens used as refresh tokens.
- Socket authentication uses the hardened access-token helper.
- A refresh request carrying a blacklisted access token is rejected before
  refresh-token validation.
- Logout still revokes the refresh token and clears the cookie when access-token
  blacklist TTL cannot be computed safely.
- No new logs expose raw access tokens, refresh tokens, or JWT payloads.

## Edge Cases

- Access token with `alg=none`.
- Refresh token with `alg=none`.
- Access token presented to the refresh verifier.
- Refresh token missing `aud`.
- Refresh token with `audience: 'user'`.
- Expired access token during logout.
- Malformed access token during logout.
- Blacklisted access token attached to `/auth/refresh-token`.
- Socket connection with a token that HTTP Passport would reject.

## Success Criteria

- All JWT verification helpers enforce explicit algorithm and audience policy.
- Socket and HTTP access-token verification are consistent.
- Refresh-token exchange preserves fail-closed blacklist behavior when a revoked
  access token is attached to the request.
- Logout remains reliable cleanup while avoiding trust in unverified token
  claims.
- Regression tests prevent future weakening of JWT verification.
