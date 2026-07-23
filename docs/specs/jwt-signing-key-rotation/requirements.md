# JWT Signing Key Rotation - Requirements

## Status

Draft.

## Goal

Allow the backend to rotate JWT signing secrets without immediately invalidating
every currently issued token.

This feature keeps the current `HS256` JWT model and adds a simple
current/previous key policy. It does not introduce JWKS, Redis-backed keys,
asymmetric signing, refresh-token rotation, or per-device session management.

## Current Context

The backend currently:

- signs access tokens with `JWT_SECRET`
- signs refresh tokens with `JWT_REFRESH_SECRET`
- verifies access tokens with `JWT_SECRET`
- verifies refresh tokens with `JWT_REFRESH_SECRET`
- enforces `HS256`, issuer, audience, expiry, blacklist, and `tokenVersion`
  checks

Changing `JWT_SECRET` or `JWT_REFRESH_SECRET` today immediately invalidates
tokens signed with the old value. That may be acceptable for emergency
revocation, but it is not graceful key rotation.

## Scope

In scope:

- Add `kid` to newly signed access-token JWT headers.
- Add `kid` to newly signed refresh-token JWT headers.
- Add current/previous access-token signing secrets through environment
  variables.
- Add current/previous refresh-token signing secrets through environment
  variables.
- Verify tokens by selecting the secret from the JWT header `kid`.
- Support temporary legacy fallback for tokens minted before `kid` existed.
- Add tests for current, previous, unknown, and legacy token verification.
- Document rollout and rollback steps.

Out of scope:

- JWKS endpoint.
- Redis or database storage for signing keys.
- `RS256`, `ES256`, or any asymmetric key migration.
- Automatic scheduled rotation.
- Refresh-token rotation.
- Per-device session management.
- Changing JWT lifetimes.
- Reworking `tokenVersion`, Redis blacklist, or refresh-token digest storage.

## Functional Requirements

### R1. Sign access tokens with the current access key

New access tokens must be signed with:

- `JWT_ACCESS_CURRENT_SECRET`
- `JWT_ACCESS_CURRENT_KID`

The resulting JWT header must include:

```json
{
  "alg": "HS256",
  "kid": "access-current-id"
}
```

The access-token payload and expiry behavior remain unchanged.

### R2. Sign refresh tokens with the current refresh key

New refresh tokens must be signed with:

- `JWT_REFRESH_CURRENT_SECRET`
- `JWT_REFRESH_CURRENT_KID`

The resulting JWT header must include:

```json
{
  "alg": "HS256",
  "kid": "refresh-current-id"
}
```

The refresh-token payload, audience, issuer, and expiry behavior remain
unchanged.

### R3. Verify current and previous access tokens

Access-token verification must:

1. Decode the JWT header without trusting the payload.
2. Read `kid`.
3. Use the matching access secret:
   - `JWT_ACCESS_CURRENT_KID` -> `JWT_ACCESS_CURRENT_SECRET`
   - `JWT_ACCESS_PREVIOUS_KID` -> `JWT_ACCESS_PREVIOUS_SECRET`
4. Verify with existing strict checks:
   - `algorithms: ['HS256']`
   - `audience: 'user'`
   - `issuer: Env.JWT_ISSUER`
   - expiry

Tokens with an unknown `kid` must be rejected.

### R4. Verify current and previous refresh tokens

Refresh-token verification must:

1. Decode the JWT header without trusting the payload.
2. Read `kid`.
3. Use the matching refresh secret:
   - `JWT_REFRESH_CURRENT_KID` -> `JWT_REFRESH_CURRENT_SECRET`
   - `JWT_REFRESH_PREVIOUS_KID` -> `JWT_REFRESH_PREVIOUS_SECRET`
4. Verify with existing strict checks:
   - `algorithms: ['HS256']`
   - `audience: 'refresh'`
   - `issuer: Env.JWT_ISSUER`
   - expiry

Tokens with an unknown `kid` must be rejected.

### R5. Support temporary legacy fallback per token family

Tokens minted before this feature do not contain `kid`.

When `JWT_ACCESS_LEGACY_FALLBACK_ENABLED=true`:

- access tokens without `kid` may be verified with existing `JWT_SECRET`

When `JWT_REFRESH_LEGACY_FALLBACK_ENABLED=true`:

- refresh tokens without `kid` may be verified with existing
  `JWT_REFRESH_SECRET`

When the relevant fallback flag is `false`:

- no-`kid` access tokens must be rejected when access fallback is disabled
- no-`kid` refresh tokens must be rejected when refresh fallback is disabled

Fallback is only for migration. It must not be required for new tokens.

Access and refresh fallback flags are separate because access tokens and refresh
tokens have different lifetimes. Access fallback can usually be disabled much
earlier than refresh fallback.

### R6. Keep emergency revocation possible

Operators must still be able to invalidate tokens immediately by removing the
old key from the previous slot and disabling legacy fallback.

Graceful rotation is the default operational flow. Emergency removal remains an
available security response.

### R7. Configuration must fail closed

Invalid signing-key configuration must fail closed during startup or first auth
use.

Examples:

- current access kid is missing
- current access secret is missing
- previous kid is set but previous secret is missing
- previous secret is set but previous kid is missing
- current and previous kids are equal
- refresh key configuration has the same inconsistencies

The app must not silently sign or verify with an empty secret.

### R8. Public errors must stay generic

Verification failures must not reveal:

- which `kid` values exist
- whether a key is current or previous
- whether legacy fallback is enabled
- raw token content

Internal logs must not include raw JWTs.

## Acceptance Criteria

- Newly signed access tokens include the configured current access `kid`.
- Newly signed refresh tokens include the configured current refresh `kid`.
- Access tokens signed by the current access key verify successfully.
- Access tokens signed by the previous access key verify successfully.
- Refresh tokens signed by the current refresh key verify successfully.
- Refresh tokens signed by the previous refresh key verify successfully.
- Tokens with unknown `kid` are rejected.
- Tokens with `kid` for the wrong token family are rejected.
- Legacy access tokens without `kid` verify only when fallback is enabled.
- Legacy refresh tokens without `kid` verify only when fallback is enabled.
- Existing blacklist, audience, issuer, expiry, and `tokenVersion` behavior
  remain intact.

## Edge Cases

- Missing `kid`.
- Unknown `kid`.
- Access token signed with refresh `kid`.
- Refresh token signed with access `kid`.
- Previous key configured without a matching secret.
- Current and previous key ids accidentally equal.
- Previous key removed before all refresh tokens signed by it expire.
- Legacy fallback disabled while old no-`kid` refresh tokens still exist.
- Emergency secret compromise requiring immediate previous-key removal.

## Success Criteria

- Operators can rotate JWT secrets without forced logout for tokens that are
  still within the accepted transition window.
- New tokens are signed only by the current key.
- Previous keys are verify-only.
- Legacy fallback can be disabled after migration.
- Tests prevent accidental acceptance of unknown, missing, or wrong-family
  `kid` values.
