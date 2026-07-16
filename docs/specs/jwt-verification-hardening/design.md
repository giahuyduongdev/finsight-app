# JWT Verification Hardening - Design

## Status

Draft.

## Selected Approach

Use a surgical hardening pass:

- tighten the centralized JWT helper functions
- keep the existing Passport strategy
- keep the existing `tokenVersion` and blacklist model
- preserve global blacklist fail-closed behavior for refresh requests
- keep logout cleanup best-effort when access-token blacklist TTL cannot be
  safely computed

This fixes the remaining JWT verification gaps without redesigning auth.

## Already Satisfied

### HTTP protected routes

`backend/src/config/passport.config.ts` already enforces:

```ts
algorithms: ['HS256']
audience: ['user']
issuer: Env.JWT_ISSUER
secretOrKey: Env.JWT_SECRET
```

No redesign is needed for HTTP Passport route verification.

### Hard access-token revocation

`authenticateAccessToken` already compares the JWT `tokenVersion` with the
current persisted user `tokenVersion`.

No redesign is needed for account-wide access-token revocation.

### Refresh-token storage

Refresh tokens are already persisted as HMAC digests.

No redesign is needed for refresh-token database storage.

## JWT Helper Changes

### Access token

Update `verifyAccessToken` so socket and any direct helper consumers enforce
the same algorithm policy as Passport.

Target behavior:

```ts
jwt.verify(token, Env.JWT_SECRET, {
  audience: 'user',
  issuer: Env.JWT_ISSUER,
  algorithms: ['HS256']
})
```

The helper still returns the decoded payload typed as `AccessTokenPayload`.
Callers still run `authenticateAccessToken` after cryptographic verification.

### Refresh token

Update `verifyRefreshToken` so it enforces the refresh-token contract that the
signer already creates.

Target behavior:

```ts
jwt.verify(token, Env.JWT_REFRESH_SECRET, {
  issuer: Env.JWT_ISSUER,
  audience: 'refresh',
  algorithms: ['HS256']
})
```

This prevents an access token from being accepted by the refresh-token path even
if it is otherwise signed by the server.

## Refresh Route Behavior

### Current behavior

The API client currently attaches `Authorization: Bearer <accessToken>` whenever
Redux has an access token. That can include the refresh request.

Because `checkBlacklist` runs globally before routes, a blacklisted access token
attached to `/auth/refresh-token` can reject the request before the refresh
token is evaluated.

### Decision

Keep this behavior.

`checkBlacklist` is a global revocation gate. If the client sends a revoked
access token on any request, including `POST /auth/refresh-token`, the backend
must reject the request before reaching the route controller.

This favors fail-closed security over refresh UX. A client that still carries a
blacklisted access token should clear local auth state and require sign-in
again.

### Implementation Shape

Keep the global blacklist middleware unchanged.

Do not add a refresh-route bypass for blacklisted access tokens. Do not special
case `/auth/refresh-token` in `checkBlacklist`.

Add regression coverage so this behavior is intentional and does not get
changed accidentally.

## Logout Behavior

### Current behavior

Normal logout revokes the refresh token, then uses `jwt.decode(accessToken)` to
read `exp` and compute blacklist TTL.

`decode` does not prove signature, issuer, audience, or algorithm.

### Target behavior

Logout remains reliable cleanup:

1. Revoke the presented refresh token.
2. Attempt to verify the presented access token with `verifyAccessToken`.
3. If verification succeeds and `exp` is present, blacklist the access-token
   digest until expiry.
4. If verification fails or `exp` is missing, skip access-token blacklist write
   and still complete logout cleanup.

This avoids trusting unverified claims while preserving logout UX.

### Expired token note

An expired access token does not need blacklist protection because it is already
invalid. Logout should not fail solely because an access token is expired.

## Error Handling

JWT verification errors should continue mapping to existing unauthorized
responses.

Logout should only fail when the refresh-token revocation requirement fails
according to current service behavior. Failure to compute access-token blacklist
TTL should not expose token details and should not log raw JWTs.

## Tests

### Unit tests

- `verifyAccessToken` rejects `alg=none`.
- `verifyAccessToken` rejects a token signed with a non-HS256 algorithm.
- `verifyAccessToken` accepts a valid HS256 access token with audience `user`.
- `verifyRefreshToken` rejects `alg=none`.
- `verifyRefreshToken` rejects a token signed with a non-HS256 algorithm.
- `verifyRefreshToken` rejects missing or wrong audience.
- `verifyRefreshToken` rejects an access token.
- Logout skips blacklist write when access-token verification fails but still
  completes refresh-token cleanup.

### Integration or focused API tests

- Refresh exchange is rejected when the request carries a blacklisted access
  token, even if a refresh token is also present.
- Socket authentication rejects a token that fails the hardened
  `verifyAccessToken` contract.

## Encoding And Edit Constraints

Some touched auth files contain existing mojibake in comments. The
implementation must not rewrite those files wholesale.

Use minimal patches. Before editing any file with Vietnamese text, create a
backup copy and avoid any encoding conversion.

## Risks

- Strict blacklist behavior can force sign-in again even when a refresh token
  might otherwise be valid.
- Tightening refresh-token audience may invalidate any legacy refresh token
  minted without `audience: 'refresh'`. Current signer already sets this
  audience, so the expected impact is low.
- Verifying access tokens during logout changes blacklist behavior for malformed
  tokens. This is acceptable because malformed tokens were not valid
  authorization credentials.

## Rollout

No database migration is required.

Backend helper hardening is backward-compatible for tokens minted by the current
signer. No coordinated client rollout is required for refresh header behavior.
