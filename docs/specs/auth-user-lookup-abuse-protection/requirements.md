# Auth User Lookup And Abuse Protection - Requirements

## Status

Implemented and verified.

## Goal

Define a complete auth API behavior spec after introducing Redis-backed user
lookup optimization and abuse protection.

The design must:

- reduce database load from repeated auth lookups
- prevent random-email spam from reaching MongoDB when safe
- keep MongoDB as the source of truth
- avoid account enumeration in sensitive flows
- preserve existing successful API contracts
- document the expected flow for every current auth endpoint

## Scope

This spec covers all current auth endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/register/verify-otp`
- `POST /api/v1/auth/register/resend`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/verify-otp`
- `POST /api/v1/auth/password/resend`
- `POST /api/v1/auth/password/reset`
- `POST /api/v1/auth/password/change-request`
- `POST /api/v1/auth/password/change-verify`
- `POST /api/v1/auth/password/change-resend`
- `POST /api/v1/auth/email/change-request`
- `POST /api/v1/auth/email/change-verify`
- `POST /api/v1/auth/email/change-resend`
- `GET /api/v1/auth/oauth/:provider`
- `GET /api/v1/auth/callback`

## Definitions

### Canonical email

Every email used for auth lookup must be normalized by the shared validator:

- trim leading and trailing whitespace
- lowercase the email string
- validate email format
- limit to 255 characters

The same canonical email must be used for Redis key construction and MongoDB
queries.

### User presence bitmap

The Redis bitmap is a probabilistic presence filter.

It is used to answer:

```text
Can this email be skipped because it is definitely absent from the bitmap?
```

It must not be used to answer:

```text
Does this email definitely exist?
```

If only one hash is used, the implementation must call it a Redis bitmap
presence filter, not a full Bloom filter. A full Bloom filter requires multiple
hash indexes.

The application may use bitmap bit `0` to skip MongoDB only when a readiness
flag exists:

```text
bitmap:users:email:v1:ready = 1
```

If the readiness flag is missing, the bitmap is treated as incomplete and
email-existence flows must fall back to MongoDB pre-checks where correctness or
user outcome depends on the result.

### Positive user cache

The positive cache stores lookup results for existing users:

```text
user:email:{sha256(canonicalEmail)}
```

The first implementation stores only:

```json
{
  "userId": "..."
}
```

Auth-sensitive fields such as password hash, token version, disabled state, and
OAuth linkage must still be loaded from MongoDB.

### Negative lookup cache

The negative cache stores recent database misses:

```text
nf:{sha256(canonicalEmail)} -> 1
TTL: 300 seconds
```

It reduces repeated MongoDB reads for non-existing emails when the bitmap has a
false positive.

## Functional Requirements

### R1. Keep MongoDB authoritative

MongoDB remains the final source of truth for user existence, credentials,
session state, and email uniqueness.

Redis may optimize lookup paths, but correctness must not depend on Redis
claiming that a user exists.

### R2. Use the bitmap only where it is safe

The bitmap may be used for:

- registration pre-check
- forgot password request
- forgot password resend
- password reset OTP verification lookup
- change email new-address pre-check
- OAuth callback after provider identity is resolved

The bitmap must not be used as the deciding authority for:

- password verification
- refresh-token validation
- logout or logout-all
- authenticated password change for the current user
- authenticated email change for the current user id

Login may consult the positive cache by email, but must not reject credentials
only because the bitmap bit is `0` unless the system has a documented and
monitored bitmap-completeness guarantee.

Bitmap completeness is represented by the readiness flag. A missing readiness
flag disables bit `0` database-skip behavior.

### R3. Preserve generic sensitive responses

Forgot-password request and resend flows must return the same public response
whether the email exists or not.

Required public response intent:

```text
If the email exists, reset instructions have been sent.
```

Implementation wording may match the existing DTO, but it must not reveal
whether the email exists.

### R4. Rate limit before expensive work

Each public auth endpoint must apply the existing auth rate limiter before
Redis or MongoDB work.

Additional abuse limits must be available for sensitive flows:

- IP-based auth rate limit
- email-hash based forgot-password rate limit
- email-hash based OTP resend cooldown
- user-id based authenticated change cooldown
- per-email daily reset email limit

The first implementation may keep existing global auth rate limiting and add
flow-specific Redis cooldown keys only where mail or OTP spam is possible.

### R5. Handle registration races with database uniqueness

Registration request and OTP verification may use Redis lookup to return early
conflicts.

The MongoDB unique email index remains mandatory. If two requests race, the
losing write must return the existing duplicate-email conflict response, not an
internal error.

### R6. Clear stale negative cache after successful creation or email change

After a user is created or an email is successfully changed, the service must:

- set the positive user cache for the canonical email
- set the bitmap bit or bits
- delete `nf:{sha256(canonicalEmail)}`

When email changes, the service must also update or invalidate the old email
positive cache.

### R7. Define Redis failure behavior

If Redis is unavailable:

- register and login fall back to MongoDB
- forgot-password request, resend, and OTP verification lookup fall back to
  MongoDB after rate limiting
- reset and change flows must not bypass OTP/token verification
- logout must not report success if the requested revocation cannot be
  persisted
- refresh-token validation continues to use MongoDB as the source of truth

Redis failures must not create false user-existence claims.

### R8. Maintain bitmap readiness explicitly

The system must not assume the bitmap is complete by default.

Before enabling bit `0` database-skip behavior:

- build the bitmap from all existing MongoDB users
- set `bitmap:users:email:v1:ready = 1` only after the backfill completes
- unset the readiness flag after Redis flush, bitmap key loss, hash-strategy
  change, bitmap-size change, or detected drift

When the readiness flag is missing, register and change-email pre-checks must
query MongoDB before treating an email as available.

Forgot-password must fall back to MongoDB after rate limiting when Redis lookup
is unavailable or the bitmap is not ready. It must still return a generic
response so the fallback does not reveal account existence.

### R9. Preserve token and session security

Refresh, logout, logout-all, password reset, password change, and email change
must continue to use the token-version and refresh-token revocation guarantees
defined by the existing access-token revocation design.

Normal logout remains session-scoped.

Logout-all, password reset, password change, and email change remain
account-wide security events.

### R10. OAuth callback must sync lookup state after user resolution

OAuth redirect does not use the bitmap.

OAuth callback resolves the provider profile and then:

- finds an existing user by Auth0 subject or canonical email
- links or creates the user according to current behavior
- sets positive cache and bitmap for the user's canonical email
- deletes negative cache for that canonical email

### R11. Avoid sensitive data in Redis keys and logs

Redis keys must not contain raw email for new lookup/cache keys. Use:

```text
sha256(canonicalEmail)
```

Existing OTP keys may remain raw-email based until a migration is explicitly
planned, but new lookup keys must use hashes.

Logs must not include raw reset tokens, OTPs, refresh tokens, access tokens,
passwords, password hashes, or ciphertext.

## Acceptance Criteria

- Random forgot-password requests for emails with bitmap bit `0` do not query
  MongoDB.
- Forgot-password response does not reveal whether the email exists.
- Bitmap bit `1` never directly proves existence; the flow checks cache and
  MongoDB.
- Register duplicate detection remains correct under concurrent requests.
- Register success deletes stale negative cache for the created email.
- Change-email success updates lookup state for the new email and invalidates
  stale lookup state for the old email.
- Login still rejects missing user and wrong password with the same public
  result.
- Refresh-token flow does not consult the email bitmap.
- Logout and logout-all behavior remains compatible with current session
  revocation semantics.
- OAuth-created or OAuth-linked users update lookup cache and bitmap state.
- Redis outage behavior is explicitly tested or manually verified for the
  documented fallback policy.
- Missing bitmap readiness flag disables bit `0` skip behavior for register and
  change-email pre-checks.
- Bitmap drift detection unsets the readiness flag and triggers rebuild or
  fallback.
- Mermaid diagrams exist for the main auth flows.

## Edge Cases

- Bitmap key is missing after Redis flush.
- Bitmap has false positives.
- Redis positive cache exists but MongoDB user was deleted or disabled.
- Negative cache exists when a user registers the same email.
- User changes email while old reset OTP state exists.
- Two users attempt to change to the same new email.
- Forgot-password resend is requested for an unknown email.
- Reset token is valid but user is deleted before reset.
- OAuth provider returns an email already owned by a password account.
- Redis is available for cache but unavailable for OTP operations.
- Mail queue accepts duplicate jobs unless cooldown keys are enforced.

## Out Of Scope

- Replacing the existing OTP architecture.
- Changing password policy.
- Adding CAPTCHA.
- Rewriting auth service boundaries.
- Migrating existing raw-email OTP Redis keys.
- Implementing a full multi-hash Bloom filter unless selected later.
- Changing OAuth provider integration.
- Changing successful response DTOs.

## Success Criteria

- Auth lookup load is reduced for random unknown emails.
- Forgot-password spam cannot force a database read for every random email.
- Mail and OTP spam are controlled by cooldown keys and rate limits.
- User-existence checks remain correct despite Redis false positives.
- Security-sensitive flows fail closed or fall back safely during Redis issues.
- The resulting auth behavior is documented clearly enough to implement and
  test endpoint by endpoint.
