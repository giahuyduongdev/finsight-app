# Auth Token And Redis Secret Hardening - Requirements

## Status

Draft.

## Goal

Harden sensitive authentication data stored in Redis and MongoDB so leaked
Redis or database contents do not directly expose usable tokens, low-entropy
OTP digests, or raw account identifiers in authentication cache keys.

The change must keep the public auth API contract stable and avoid broad cache
rewrites that do not improve secret exposure.

## Scope

This feature applies to:

- refresh token persistence in MongoDB
- access token blacklist keys in Redis
- OTP and reset-token digests stored in Redis
- Redis keys for email-scoped auth state
- auth-related logging and tests around those flows
- documentation of which Redis payloads are intentionally plaintext, encrypted,
  or hashed

This feature does not change:

- JWT signing algorithms or token lifetime policy
- password bcrypt hashing
- current registration, login, password reset, password change, email change,
  OAuth, or logout response shapes
- analytics, exchange-rate, or receipt scan behavior except for explicit
  security documentation and optional follow-up tasks

## Requirements

### R1. Centralize secret-backed digesting

Create a single helper for one-way digests of secrets and auth identifiers.

The helper must:

- use HMAC-SHA256
- derive the HMAC key from `Env.TOKEN_HASH_SECRET`
- fail closed if `TOKEN_HASH_SECRET` is missing or empty
- require `TOKEN_HASH_SECRET` to be a high-entropy random secret generated
  separately from JWT and encryption secrets
- expose purpose-specific functions instead of generic call sites passing raw
  labels everywhere

Required digest purposes:

- OTP
- reset token
- refresh token
- access-token blacklist key
- email-scoped auth Redis key suffix

Any new environment variable introduced by this feature must be added to
`backend/.env.example` with a short note explaining its purpose.

`TOKEN_HASH_SECRET` should be generated as 32 random bytes encoded as hex:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The generated value is 64 hex characters. It must not reuse `JWT_SECRET`,
`JWT_REFRESH_SECRET`, or `ENCRYPTION_SECRET`.

### R2. Store refresh tokens as digests

MongoDB must not store newly issued refresh tokens in plaintext.

When a refresh token is issued:

- the client still receives the original refresh JWT
- the database stores only the refresh-token digest
- lookup, refresh, and logout hash the presented token before querying MongoDB
- unique constraints apply to the digest value

The implementation must define a migration policy for existing plaintext
refresh-token records.

Accepted rollout policy for this spec:

- existing plaintext refresh-token records may be revoked or deleted at deploy
  time
- clients with old refresh cookies may need to sign in again
- no compatibility fallback should query both plaintext and digest because that
  extends the plaintext risk window

### R3. Hash access-token blacklist keys

Redis blacklist keys must not contain the raw access JWT.

When logging out or revoking the presented access token:

- compute the access-token blacklist digest
- write `blacklist:{digest}` with the same TTL as the current implementation
- blacklist middleware computes the same digest before lookup
- values may stay simple, for example `revoked`

The public behavior remains unchanged: blacklisted tokens receive the same
unauthorized response as before.

### R4. Use HMAC for OTP and reset-token storage

Redis must not store SHA-256-only OTP or reset-token digests.

All auth flows that create or verify OTPs or reset tokens must use the
centralized HMAC helper:

- register OTP
- forgot-password OTP
- forgot-password reset token
- change-password OTP
- change-email old-email OTP
- change-email new-email OTP

The user still receives and submits the original OTP or reset token. Only the
stored comparison value changes.

Existing OTP/reset-token Redis state created before deployment may be treated
as expired.

### R5. Remove raw email from auth Redis keys

Email-scoped Redis keys for auth state must use a digest of canonical email
instead of the raw email address.

The affected key families include:

- pending registration
- register OTP, resend, and attempts
- forgot-password OTP, resend, attempts, and reset token
- change-password OTP, pending password, resend, and attempts

Key builders must receive canonical emails from the existing validators and
must not rebuild key suffixes with unnormalized input.

User-id scoped keys, such as change-email OTPs keyed by authenticated user id,
may stay user-id based.

### R6. Keep reversible data encrypted, not hashed

Data that must be read back later must not be hashed as a substitute for
protection.

Required behavior:

- pending registration password remains encrypted with authenticated encryption
- pending change-password password remains encrypted with authenticated
  encryption
- OTPs, reset tokens, access tokens, refresh tokens, and key identifiers use
  one-way HMAC digests
- cache payloads that need to be returned later stay plaintext unless a follow-up
  encryption requirement is explicitly accepted

### R7. Classify non-auth Redis cache exposure

Document the current exposure level for non-auth Redis data:

- analytics summaries
- exchange-rate cache
- receipt scan cache
- BullMQ receipt job metadata

The spec must identify which payloads are acceptable plaintext cache entries
and which should become separate follow-up work if product privacy expectations
require encryption.

### R8. Preserve existing public API behavior

The hardening must not require frontend changes.

The following response contracts remain stable:

- login
- refresh token
- logout
- logout all
- register OTP request and verification
- forgot-password request, verify, resend, and reset
- change-password request, verify, and resend
- change-email request, verify, and resend
- OAuth callback

### R9. Logging must not expose raw secrets

Logs must not include:

- raw access tokens
- raw refresh tokens
- raw OTPs
- raw reset tokens
- plaintext passwords
- raw auth Redis keys containing email addresses

Logs may include digest previews only when useful for debugging and only if
they cannot be used directly as bearer credentials.

## Acceptance Criteria

- `backend/.env.example` documents every environment key required by this
  feature.
- New refresh-token records store digest values, not raw JWT strings.
- Refresh-token refresh and logout succeed using a valid presented token after
  hashing it for lookup.
- Old plaintext refresh-token records are revoked or deleted by the rollout
  script/task.
- Access-token blacklist Redis keys do not include the raw JWT.
- Blacklist middleware rejects a token whose digest key is present.
- OTP Redis values use HMAC digests for every auth OTP flow.
- Reset-token Redis values use HMAC digests.
- Email-scoped auth Redis keys use canonical-email digest suffixes.
- User-id scoped Redis keys remain unchanged where raw email is not present.
- Pending registration and change-password payloads still decrypt correctly.
- Existing public API response shapes do not change.
- Targeted auth unit and integration tests pass.
- Backend lint, typecheck, and build pass.
- Security review confirms no raw auth tokens, OTPs, reset tokens, or plaintext
  passwords are stored in Redis or MongoDB by the touched flows.

## Edge Cases

- `TOKEN_HASH_SECRET` is missing in production configuration.
- `TOKEN_HASH_SECRET` is present but reused from another secret.
- Existing refresh-token collection contains plaintext records.
- A user submits an OTP created before the deployment.
- A user submits a reset token created before the deployment.
- Email input uses different casing or leading/trailing whitespace.
- Redis contains stale raw-email keys from before deployment.
- Logout receives an access token without an `exp` claim.
- Refresh-token lookup receives a malformed token.
- Redis blacklist read fails.
- MongoDB refresh-token lookup fails.

## Constraints

- Use the existing Express, Redis, Mongoose, and JWT structure.
- Keep changes surgical inside existing auth utilities, config, service, model,
  repository, middleware, and tests.
- Do not refactor unrelated cache systems.
- Do not introduce reversible encryption for one-time verification tokens.
- Do not store raw bearer tokens in any new key, value, or log.
- Do not change file encoding.

## Success Criteria

- A Redis dump no longer reveals raw email addresses in auth Redis keys.
- A Redis dump no longer allows offline brute force of 6-digit OTPs without
  `TOKEN_HASH_SECRET`.
- A MongoDB dump no longer contains usable refresh tokens for newly issued
  sessions.
- A Redis dump no longer contains raw access tokens in blacklist keys.
- Deployment has a clear session invalidation or migration story.
- The implementation remains compatible with existing frontend flows.
