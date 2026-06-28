# Auth Token And Redis Secret Hardening - Design

## Status

Draft.

## Selected Approach

Use a conservative hardening pass around the existing auth implementation:

- add one centralized HMAC helper for auth digests
- replace SHA-256-only OTP and reset-token storage with purpose-specific HMACs
- store refresh-token digests in MongoDB instead of plaintext refresh JWTs
- hash access-token blacklist keys before writing to Redis
- move email-scoped auth Redis keys to canonical-email digest suffixes
- leave non-auth cache payloads alone unless they are separately classified as
  needing encryption

This is the smallest useful change. It fixes direct secret exposure without
rewriting the auth service or changing frontend contracts.

## Alternatives Considered

### A. Hash every Redis value

Rejected. Many Redis values are cache payloads that must be read back and
returned later. Hashing them would make the cache unusable. For readable
sensitive payloads, encryption is the correct control.

### B. Encrypt all Redis payloads

Rejected for this slice. It would touch analytics, receipt scan, exchange-rate,
BullMQ, and user-profile cache behavior. That is a broader privacy feature, not
required to remove bearer-token and OTP exposure.

### C. HMAC only token values, keep raw email keys

Rejected. It protects bearer secrets but still leaks account identifiers from
Redis key names. The existing project already has email hash key patterns, so
email-scoped auth keys should follow that pattern.

## Architecture

### Digest utility

Add a utility such as:

```text
backend/src/utils/secure-hash.util.ts
```

Responsibilities:

- read `Env.TOKEN_HASH_SECRET`
- fail closed when the secret is unavailable
- compute HMAC-SHA256 in hex
- provide narrow purpose-specific functions

Example API:

```ts
hashOtp(value: string): string
hashResetToken(value: string): string
hashRefreshToken(value: string): string
hashAccessTokenBlacklistKey(value: string): string
hashAuthEmailKey(email: string): string
```

Purpose-specific functions prevent accidental cross-use and make code search
straightforward during security review.

### Redis key builders

Update `REDIS_KEYS` email-scoped builders in `backend/src/config/redis.config.ts`
to use the canonical-email digest suffix.

Example:

```text
otp:register:{emailDigest}
pending:register:{emailDigest}
reset:forgot:token:{emailDigest}
```

The digest must be derived from canonical email, not raw request input. Existing
validators already normalize email for auth DTOs; service code must keep using
those validated values.

### Refresh-token persistence

The refresh token JWT remains the client credential.

Persistence changes from:

```text
RefreshToken.token = raw refresh JWT
```

to:

```text
RefreshToken.token = hashRefreshToken(raw refresh JWT)
```

All token-based operations hash the presented token before querying:

- create refresh token
- refresh access token
- normal logout
- repository create/find/revoke paths if they remain used

The model field may keep the name `token` for a surgical migration, but tests
must make clear the value is a digest. A later schema cleanup can rename it to
`tokenDigest`.

### Access-token blacklist

The current blacklist stores the access token in the Redis key:

```text
blacklist:{rawAccessToken}
```

Replace it with:

```text
blacklist:{hashAccessTokenBlacklistKey(rawAccessToken)}
```

TTL calculation still uses the decoded access token expiry. The blacklist value
can remain `revoked` because the key is the lookup target.

### OTP and reset-token storage

Replace all direct `crypto.createHash('sha256')` usages for auth OTP and reset
token comparison with the digest utility.

Affected flows:

- register OTP issue, resend, and verify
- forgot-password OTP issue, resend, and verify
- forgot-password reset token issue and verify
- change-password OTP issue, resend, and verify
- change-email old and new OTP issue, resend, and verify

The service should compare digest strings exactly as today. Constant-time
comparison may be added, but is not required for the first slice because Redis
lookup and request handling dominate timing and the digest is not user-visible.

## Data Flow

### Refresh token issuance

1. Auth service signs a refresh JWT.
2. Service computes `hashRefreshToken(refreshToken)`.
3. MongoDB stores the digest, user id, expiry, revocation state, and user agent.
4. Client receives the original refresh JWT in the existing response/cookie.

### Refresh token usage

1. Client presents the refresh JWT.
2. Service verifies JWT signature, issuer, audience, and expiry as today.
3. Service computes `hashRefreshToken(presentedToken)`.
4. MongoDB lookup uses the digest plus `isRevoked: false` and valid expiry.
5. Service loads user token version and returns a new access token as today.

### Logout blacklist

1. Service decodes the presented access JWT to calculate remaining TTL.
2. Service computes the blacklist digest.
3. Redis writes `blacklist:{digest}` until JWT expiry.
4. Middleware computes the same digest for incoming bearer tokens.
5. Middleware rejects the request if the key exists.

### OTP verification

1. Service generates an OTP.
2. Service stores `hashOtp(otp)` in the flow-specific Redis key.
3. User submits the OTP.
4. Service computes `hashOtp(submittedOtp)`.
5. Service compares the stored and submitted digests.

### Email-scoped Redis key lookup

1. Validator canonicalizes email.
2. Service passes the canonical email to `REDIS_KEYS`.
3. Key builder computes an email digest suffix.
4. Redis key stores auth state without raw email in the key name.

## Components

- `backend/src/utils/secure-hash.util.ts`
  - central HMAC helper
- `backend/src/config/env.config.ts`
  - already exposes `TOKEN_HASH_SECRET`; implementation must require it for
    digesting
- `backend/src/config/redis.config.ts`
  - auth Redis key builders
- `backend/src/services/auth.service.ts`
  - OTP, reset token, refresh token, logout, and blacklist call sites
- `backend/src/repositories/refresh-token.repository.ts`
  - repository token lookup and revoke behavior if used by tests or services
- `backend/src/models/refresh-token.model.ts`
  - index remains unique; documentation/tests clarify digest storage
- `backend/src/middlewares/blacklist.middleware.ts`
  - hashed blacklist key lookup
- `backend/src/__tests__/unit/*`
  - focused tests for digesting and auth behavior
- `backend/src/__tests__/integration/*`
  - refresh/logout regression where practical

## API Design

No public API changes.

Request and response shapes remain stable for:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- registration OTP endpoints
- forgot-password endpoints
- change-password endpoints
- change-email endpoints
- OAuth callback

## Rollout And Migration

### Environment

`TOKEN_HASH_SECRET` must be configured before deployment. The app should fail
closed when digesting is needed and the secret is missing.

Generate `TOKEN_HASH_SECRET` as 32 random bytes encoded as hex:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This produces a 64-character hex string. Use a dedicated value for
`TOKEN_HASH_SECRET`; do not reuse `JWT_SECRET`, `JWT_REFRESH_SECRET`, or
`ENCRYPTION_SECRET`.

### Refresh tokens

Use a simple security-first rollout:

1. Deploy code that stores and queries refresh-token digests.
2. Delete or revoke existing refresh-token documents created with plaintext
   tokens.
3. Users with old refresh cookies sign in again.

This avoids a compatibility branch that would keep plaintext token lookup alive.

### Redis auth state

Existing Redis OTP and pending auth keys may expire naturally. Because key names
change, in-flight OTP sessions created before deployment may fail and require
restart.

Accepted impact:

- pending registration users may request a new OTP
- forgot-password users may request a new OTP
- change-password/change-email users may restart the operation

All affected Redis TTLs are short.

## Cache Classification

### Must be one-way HMAC

- OTP values
- reset token values
- refresh token database value
- access-token blacklist key suffix
- email-scoped auth key suffix

### Must stay encrypted because the app reads it back

- pending registration password
- pending change-password password

### Acceptable plaintext for this slice

- exchange-rate cache
- analytics summary cache
- user profile cache that omits password and token version

### Privacy follow-up candidates

- receipt scan cache, because it may include title, amount, category, payment
  method, and receipt URL
- BullMQ receipt job metadata, because it may include receipt image URLs and
  file names
- import batch data, because it temporarily stores user transaction rows in
  MongoDB

Those follow-ups should use encryption or shorter retention, not hashing, if
the product requires stronger privacy for readable business data.

## Error Handling

| Scenario | Behavior |
| --- | --- |
| Missing `TOKEN_HASH_SECRET` | Fail closed during startup or first digest use |
| `TOKEN_HASH_SECRET` reused from another secret | Treat as configuration error during review or deployment |
| Old plaintext refresh token record | Not accepted after rollout |
| Old Redis OTP state | Treated as expired or invalid |
| Redis blacklist write failure | Preserve existing error behavior; do not log token |
| Redis blacklist read failure | Preserve existing fail-closed auth behavior if implemented, otherwise surface error |
| Malformed refresh token | Existing unauthorized response |
| MongoDB refresh-token lookup failure | Existing centralized error handling |

## Testing Strategy

### Unit tests

- secure hash helper produces stable HMAC for same purpose/input
- different purposes produce different digests for same input
- helper fails closed without `TOKEN_HASH_SECRET`
- refresh-token create stores digest, not raw token
- refresh-token lookup hashes presented token
- logout hashes refresh token lookup value
- logout writes hashed access-token blacklist key
- blacklist middleware checks hashed key
- each OTP flow stores HMAC digest
- each OTP verification flow compares HMAC digest
- reset-token issue and verification use HMAC digest
- email-scoped Redis key builders do not include raw email
- canonical email variants produce the same key suffix

### Integration tests

- login plus refresh works with digest-persisted refresh token
- normal logout revokes digest-persisted refresh token
- blacklisted access token is rejected through middleware
- forgot-password verify plus reset works with HMAC reset token
- register OTP verify works after key migration

### Manual verification

- inspect Redis keys after auth flows and confirm no raw emails or raw access
  tokens appear
- inspect Redis OTP values and confirm no raw OTPs appear
- inspect refresh-token collection and confirm raw refresh JWTs are absent
- verify users with pre-deploy refresh sessions are forced to sign in again if
  old token records are deleted

## Risks

- Existing sessions will be invalidated if plaintext refresh-token records are
  deleted.
- In-flight OTP sessions may need to restart because Redis key names and digest
  algorithms change.
- Missing `TOKEN_HASH_SECRET` can break auth flows if environment setup is not
  completed before deployment.
- Keeping the model field name `token` while storing a digest can confuse future
  maintainers; tests and comments must make this explicit.

## Tradeoffs

- The design favors security-first migration over transparent compatibility for
  old refresh tokens.
- The design keeps cache-payload encryption out of the first slice to avoid a
  broad cross-system rewrite.
- The design keeps API contracts unchanged, so clients do not need coordinated
  deployment.
