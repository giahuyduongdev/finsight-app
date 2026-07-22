# JWT Signing Key Rotation - Design

## Status

Draft.

## Selected Approach

Use a simple current/previous key model with `HS256`:

- current key signs new tokens
- current key verifies current tokens
- previous key verifies old tokens during a controlled transition window
- legacy fallback verifies no-`kid` tokens only while migration is enabled

This keeps the project close to its current JWT design and avoids introducing a
JWKS endpoint, Redis key storage, or asymmetric signing before the system needs
them.

## Alternatives Considered

### A. Current/previous env keys

Selected.

This is the smallest rotation model that supports graceful secret changes.
Operators can rotate manually by moving the current key into previous and
introducing a new current key.

### B. Env JSON key ring

Rejected for this slice. It supports more than one previous key, but increases
configuration complexity. The current project only needs one controlled
transition window.

### C. JWKS and asymmetric signing

Rejected for this slice. JWKS is useful when external services need to verify
tokens. Finsight currently verifies JWTs inside the backend, so JWKS would add
operational surface without immediate value.

### D. Change secret and force logout

Rejected as the default. It remains available for emergency revocation, but it
is not graceful rotation.

## Environment Design

Add these backend environment variables:

```env
JWT_ACCESS_CURRENT_KID=access-2026-07
JWT_ACCESS_CURRENT_SECRET=
JWT_ACCESS_PREVIOUS_KID=
JWT_ACCESS_PREVIOUS_SECRET=

JWT_REFRESH_CURRENT_KID=refresh-2026-07
JWT_REFRESH_CURRENT_SECRET=
JWT_REFRESH_PREVIOUS_KID=
JWT_REFRESH_PREVIOUS_SECRET=

JWT_ACCESS_LEGACY_FALLBACK_ENABLED=true
JWT_REFRESH_LEGACY_FALLBACK_ENABLED=true
```

Existing variables remain during migration:

```env
JWT_SECRET=
JWT_REFRESH_SECRET=
```

The current secrets are required once this feature is enabled. Previous secrets
are optional, but `kid` and secret must be configured together.

## Component Design

### JWT key resolver

Add a focused helper module, for example:

```text
backend/src/utils/jwt-key-ring.util.ts
```

Responsibilities:

- validate current/previous access key config
- validate current/previous refresh key config
- resolve the signing key and `kid` for access tokens
- resolve the signing key and `kid` for refresh tokens
- resolve verification keys by token family and `kid`
- apply access legacy fallback only when access fallback is enabled
- apply refresh legacy fallback only when refresh fallback is enabled

The helper should not parse or trust JWT payload claims.

### JWT utility

Update `backend/src/utils/jwt.util.ts`:

- `signAccessToken` signs with the current access secret and sets access current
  `kid` in JWT header
- `signRefreshToken` signs with the current refresh secret and sets refresh
  current `kid` in JWT header
- `verifyAccessToken` resolves the access verify secret by JWT header `kid`
- `verifyRefreshToken` resolves the refresh verify secret by JWT header `kid`

Existing strict verification options remain:

```ts
algorithms: ['HS256']
issuer: Env.JWT_ISSUER
audience: 'user' // access
audience: 'refresh' // refresh
```

### Passport strategy

Passport currently receives a single `secretOrKey`. To support dynamic key
selection, update it to use `secretOrKeyProvider` from `passport-jwt`.

The provider should:

1. receive the raw token
2. resolve the access verification secret through the same key resolver
3. pass the secret to Passport

The strategy's existing algorithm, issuer, and audience options remain.

Socket authentication already calls `verifyAccessToken`, so it benefits from
the same resolver without separate socket changes.

## Data Flow

### Signing access token

1. Auth service calls `signAccessToken`.
2. JWT utility asks resolver for current access key.
3. JWT utility signs using current access secret.
4. JWT header includes current access `kid`.
5. Client receives token through the existing response shape.

### Verifying access token

1. Request sends `Authorization: Bearer <accessToken>`.
2. Blacklist middleware behaves as today.
3. Passport or socket verifier reads JWT header `kid`.
4. Resolver chooses current, previous, or legacy access secret.
5. JWT verification enforces signature, `HS256`, issuer, audience, and expiry.
6. Existing `authenticateAccessToken` checks `tokenVersion`.

### Signing refresh token

1. Auth service calls `signRefreshToken`.
2. JWT utility asks resolver for current refresh key.
3. JWT utility signs using current refresh secret.
4. JWT header includes current refresh `kid`.
5. Existing refresh-token digest persistence stores the HMAC digest of the raw
   refresh JWT.

### Verifying refresh token

1. Refresh endpoint receives refresh token from cookie or body.
2. JWT utility reads JWT header `kid`.
3. Resolver chooses current, previous, or legacy refresh secret.
4. JWT verification enforces signature, `HS256`, issuer, `audience: 'refresh'`,
   and expiry.
5. Existing MongoDB digest lookup checks revocation and expiry.

## Rollout Plan

### Phase 1. Deploy with legacy fallback

Configure:

```env
JWT_ACCESS_CURRENT_KID=access-2026-07
JWT_ACCESS_CURRENT_SECRET=<new access secret>
JWT_REFRESH_CURRENT_KID=refresh-2026-07
JWT_REFRESH_CURRENT_SECRET=<new refresh secret>
JWT_ACCESS_LEGACY_FALLBACK_ENABLED=true
JWT_REFRESH_LEGACY_FALLBACK_ENABLED=true

JWT_SECRET=<old access secret>
JWT_REFRESH_SECRET=<old refresh secret>
```

New tokens receive `kid` and use the current secrets. Old no-`kid` tokens still
verify through legacy fallback.

### Phase 2. Disable access-token legacy fallback

After the maximum access-token lifetime has passed, no old no-`kid` access
tokens should remain valid.

Disable:

```env
JWT_ACCESS_LEGACY_FALLBACK_ENABLED=false
```

Refresh fallback remains enabled because refresh tokens live longer.

### Phase 3. Disable refresh-token legacy fallback

After the maximum refresh-token lifetime has passed, disable:

```env
JWT_REFRESH_LEGACY_FALLBACK_ENABLED=false
```

No-`kid` access and refresh tokens are now both rejected.

### Future rotation

For the next planned rotation:

```text
old current -> previous
new secret -> current
deploy
wait until previous-token window expires
remove previous
```

## Error Handling

| Scenario | Behavior |
| --- | --- |
| Current key missing | Fail closed |
| Previous kid without secret | Fail closed |
| Unknown kid | Reject token |
| Missing access kid with access fallback enabled | Try legacy access secret |
| Missing access kid with access fallback disabled | Reject access token |
| Missing refresh kid with refresh fallback enabled | Try legacy refresh secret |
| Missing refresh kid with refresh fallback disabled | Reject refresh token |
| Access token with refresh kid | Reject token |
| Refresh token with access kid | Reject token |
| Malformed JWT header | Reject token |

Public responses use existing generic unauthorized behavior.

## Testing Strategy

### Unit tests

- access signer sets current access `kid`
- refresh signer sets current refresh `kid`
- access verifier accepts current access key
- access verifier accepts previous access key
- refresh verifier accepts current refresh key
- refresh verifier accepts previous refresh key
- access verifier rejects unknown `kid`
- refresh verifier rejects unknown `kid`
- access verifier rejects refresh-family `kid`
- refresh verifier rejects access-family `kid`
- no-`kid` access token verifies only with access legacy fallback enabled
- no-`kid` refresh token verifies only with refresh legacy fallback enabled
- invalid key configuration fails closed

### Integration tests

- login issues an access token with access current `kid`
- refresh-token exchange issues a refresh token with refresh current `kid`
- protected HTTP route accepts token signed by previous access key
- socket auth accepts token signed by previous access key if socket tests are
  available

## Security Notes

- Do not log raw JWTs or signing secrets.
- Treat all current and previous secrets as production secrets.
- Previous keys are verify-only and must never sign new tokens.
- Emergency compromise response should remove the compromised key immediately,
  even if that forces sign-in.

## Risks

- Misconfigured env values can break auth. Config validation must fail closed.
- Keeping a previous key too long extends the window in which tokens signed by
  that key remain acceptable.
- Manual rotation requires clear operational discipline.
