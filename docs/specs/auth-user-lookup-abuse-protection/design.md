# Auth User Lookup And Abuse Protection - Design

## Status

Implemented and verified.

## Selected Approach

Use a conservative lookup optimization layer around the existing auth service.

- Redis bitmap presence filter reduces database reads for definitely absent
  emails.
- Positive user cache reduces repeated reads for known users.
- Negative cache reduces repeated reads caused by bitmap false positives.
- Existing auth rate limiter remains the first line of defense.
- Flow-specific cooldown keys protect OTP and mail sending.
- MongoDB remains authoritative for user existence, credentials, unique email,
  refresh tokens, and token version.

This keeps the change surgical. It improves lookup and abuse behavior without
rewriting the full authentication architecture.

## Lookup Components

### Email normalization

All email-based flows must use the canonical email produced by the existing
validator before lookup keys are built.

### Presence filter

Baseline key:

```text
bitmap:users:email:v1
```

Readiness key:

```text
bitmap:users:email:v1:ready
```

Baseline index:

```text
crc32(canonicalEmail) % USER_EMAIL_BITMAP_SIZE
```

This is a single-hash Redis bitmap presence filter. It has false positives and
no false negatives only when it is complete and maintained for every user.

The service must check the readiness key before using `BIT = 0` as a reason to
skip a MongoDB pre-check. If the readiness key is missing, the bitmap is
incomplete and the flow falls back to MongoDB where correctness depends on the
lookup.

If the implementation needs Bloom-filter terminology, upgrade to multiple hash
indexes first:

```text
indexN = hashN(canonicalEmail) % USER_EMAIL_BITMAP_SIZE
```

### Positive cache

Key:

```text
user:email:{sha256(canonicalEmail)}
```

Recommended first value:

```json
{
  "userId": "..."
}
```

Caching only `userId` is safer for the first slice because password hashes,
token versions, disabled flags, and OAuth linkage remain loaded from MongoDB
when needed.

If a later optimization caches an auth snapshot, the snapshot must include a
short TTL and explicit invalidation on password reset, password change, email
change, account disable, and user deletion.

### Negative cache

Key:

```text
nf:email:{sha256(canonicalEmail)}
```

Value and TTL:

```text
1
TTL 300 seconds
```

Negative cache is only a recent MongoDB miss. It must be deleted after register,
OAuth create/link, and email change success.

## Abuse Protection Keys

Add small, flow-specific keys where the existing auth rate limiter is too broad.

```text
cooldown:forgot:{sha256(email)}          TTL 60 seconds
daily:forgot:{sha256(email)}             TTL until next UTC day
cooldown:forgot-resend:{sha256(email)}   TTL 60 seconds
cooldown:register-resend:{sha256(email)} TTL 60 seconds
cooldown:change-password:{userId}        TTL 60 seconds
cooldown:change-email:{userId}           TTL 60 seconds
```

The service should set cooldowns before enqueueing mail or issuing OTP state.
If a cooldown is active, return the existing rate-limit or resend-lock response.

## Endpoint Flow Design

### Register

Register is allowed to use bitmap and positive cache for early conflict checks,
but MongoDB unique email remains final.

Flow:

1. Auth rate limit.
2. Validate and canonicalize email.
3. Check pending registration state.
4. Check `bitmap:users:email:v1:ready`.
5. If not ready, query MongoDB before treating the email as available.
6. If ready, check bitmap.
7. If ready and bit is `0`, skip positive cache and MongoDB existence pre-check.
8. If ready and bit is `1`, check positive cache, then MongoDB.
9. If user exists, return duplicate-email conflict.
10. Store pending registration and OTP as today.
11. On verify success, create user under MongoDB unique constraint.
12. After commit, set positive cache, set bitmap, delete negative cache.

If Redis lookup fails before pending OTP write, fall back to MongoDB pre-check.
If Redis OTP write fails, do not report registration success.

### Register verify OTP

OTP verification remains Redis-backed. Bitmap does not decide the result.

After OTP succeeds:

1. Load pending registration.
2. Create user and related default records transactionally.
3. Translate Mongo duplicate key `11000` into duplicate-email conflict.
4. Clean registration Redis state.
5. Sync lookup state for the canonical email.

### Register resend

Resend uses existing pending registration state and resend cooldown. It may use
positive cache or MongoDB to reject already-registered emails, but must not rely
on bitmap bit `1` as proof of existence.

### Login

Login does not use the bitmap as a rejection shortcut.

Recommended baseline:

1. Auth rate limit.
2. Validate canonical email and exact password.
3. Check positive cache for `userId`.
4. If cache hit, load auth-sensitive user fields from MongoDB by id.
5. If cache miss, load user by canonical email from MongoDB.
6. If MongoDB finds a user, set positive cache and bitmap.
7. Compare submitted password with real hash.
8. If user is missing, run dummy bcrypt comparison.
9. Return one invalid-credentials response for missing user or wrong password.
10. On success, issue access and refresh tokens using current token version.

This preserves account-enumeration hardening and avoids authorizing from stale
cache data.

### Forgot password request

Forgot password is the highest-value bitmap use case.

Flow:

1. Auth rate limit.
2. Validate canonical email.
3. Apply email-hash cooldown and daily cap.
4. Check `bitmap:users:email:v1:ready`.
5. If not ready or Redis lookup is unavailable, query MongoDB after rate
   limiting and still return the generic response.
6. If ready, check bitmap.
7. If ready and bit is `0`, return generic accepted response without MongoDB or
   mail.
8. If ready and bit is `1`, check positive cache.
9. If positive cache misses, check negative cache.
10. If negative cache misses, query MongoDB.
11. If MongoDB misses, set negative cache and return generic response.
12. If user exists, set positive cache and bitmap, create OTP state, enqueue mail,
    and return generic response.

Timing should be monitored because the bit `0` path is shorter. If timing
enumeration is a concern, add small bounded response jitter or asynchronous
accepted handling.

### Forgot password verify OTP

This endpoint verifies an OTP for a canonical email and returns a short-lived
reset token.

The bitmap may help avoid MongoDB lookup when the email is definitely absent,
but OTP validation still controls the result. If the bitmap is not ready or
Redis lookup is unavailable, verify OTP first and then fall back to MongoDB
lookup. A missing OTP or user returns the existing invalid/expired OTP style
response without revealing account state.

### Forgot password resend

Resend follows the forgot-password request lookup pattern, but must also require
or validate existing forgot-password OTP state according to current behavior.

Unknown emails return the same generic response and do not send mail.

If the bitmap is not ready or Redis lookup is unavailable, resend falls back to
MongoDB after rate limiting and resend cooldown checks, while preserving the
same generic public response.

### Reset password

Reset password must not use bitmap to authorize the reset.

Flow:

1. Auth rate limit.
2. Validate canonical email, reset token, and new password.
3. Verify reset token from Redis.
4. Load user from MongoDB.
5. If user exists and token is valid, update password.
6. Revoke all sessions by incrementing token version and revoking refresh tokens.
7. Delete reset and forgot-password OTP state.
8. Invalidate or refresh positive user cache.

If user is missing after token verification, fail closed and clean stale reset
state.

### Change password request

Authenticated change password is keyed by current user id, not email lookup.

Flow:

1. Passport authenticates access token and token version.
2. Auth rate limit and user-id cooldown.
3. Validate old and new password.
4. Load user by authenticated id from MongoDB.
5. Verify old password.
6. Store pending encrypted or hashed new-password state if current behavior does
   not already store it safely.
7. Send OTP to current email.

Bitmap is not used.

### Change password verify

Flow:

1. Passport authenticates current user.
2. Auth rate limit.
3. Verify change-password OTP and pending state.
4. Update password.
5. Revoke all sessions using token-version design.
6. Delete change-password Redis state.
7. Invalidate user auth cache if auth snapshots are ever cached.

Bitmap is not used.

### Change password resend

Resend is authenticated and user-id based.

Flow:

1. Passport authenticates current user.
2. Auth rate limit and resend cooldown.
3. Confirm pending change-password state.
4. Send OTP to current email.

Bitmap is not used.

### Change email request

The new email may use lookup optimization.

Flow:

1. Passport authenticates current user.
2. Auth rate limit and user-id cooldown.
3. Validate canonical new email.
4. If new email equals current email, return validation/conflict response.
5. Check `bitmap:users:email:v1:ready`.
6. If not ready, query MongoDB before treating the new email as available.
7. If ready, check bitmap.
8. If bit is `1`, check positive cache and then MongoDB.
9. If MongoDB finds a user, return duplicate-email conflict.
10. Create old-email and new-email OTP state.
11. Send OTPs to old and new email addresses.

If bit is `0`, the service may skip the MongoDB pre-check, but the final
verify step still relies on the unique email index.

### Change email verify

Flow:

1. Passport authenticates current user.
2. Auth rate limit.
3. Verify old-email and new-email OTPs.
4. Update user email under MongoDB unique constraint.
5. On duplicate key, return duplicate-email conflict.
6. Revoke all sessions using token-version design.
7. Delete change-email Redis state.
8. Sync lookup state:
   - delete old positive cache
   - set new positive cache
   - set new bitmap bit
   - delete new negative cache

Bitmap cannot remove the old email bit. The old bit may remain a false positive,
which is acceptable because bit `1` always requires cache or MongoDB validation.

### Change email resend

Resend is authenticated and user-id based. It does not use bitmap directly.
It resends the existing old/new email OTPs when pending state exists and
cooldown allows.

### Refresh token

Refresh-token flow is token based, not email based.

Flow:

1. Read refresh token from cookie or body.
2. Verify JWT refresh token.
3. Confirm persisted refresh-token record is active in MongoDB.
4. Load current user token version.
5. Issue new access token with current version.

Bitmap and email lookup cache are not used.

### Logout

Normal logout is session-scoped.

Flow:

1. Read refresh token and access token.
2. Revoke current refresh-token record.
3. Blacklist the presented access token until expiry.
4. Clear refresh-token cookie.

Bitmap and email lookup cache are not used.

### Logout all

Logout-all is account-wide and authenticated.

Flow:

1. Passport authenticates current access token.
2. Revoke all refresh tokens for the user.
3. Increment user token version atomically.
4. Blacklist current access token if current behavior keeps doing so.
5. Emit session-revoked socket event after persistence succeeds.
6. Clear refresh-token cookie.

Bitmap and email lookup cache are not used.

### OAuth redirect

OAuth redirect builds provider authorization URL and CSRF state. It does not use
bitmap or user lookup cache.

### OAuth callback

Flow:

1. Validate OAuth callback code and CSRF state.
2. Exchange code with provider.
3. Resolve provider profile.
4. Find user by provider subject.
5. If not found, find by canonical provider email.
6. Link provider identity or create user according to current behavior.
7. Issue access and refresh tokens.
8. Sync positive cache, bitmap, and negative-cache deletion for canonical email.

OAuth callback must still treat MongoDB as authoritative for identity linking.

## Redis Consistency

### Startup and rebuild

The bitmap must be considered incomplete after Redis flush, key loss, or first
deployment until it is built from MongoDB.

Required operational behavior:

1. Build `bitmap:users:email:v1` from all existing MongoDB users.
2. Set `bitmap:users:email:v1:ready = 1` only after the backfill completes.
3. Read the readiness key before any flow uses bit `0` to skip MongoDB.
4. Delete the readiness key after Redis flush, bitmap key loss, hash-strategy
   change, bitmap-size change, or detected drift.
5. Rebuild the bitmap before setting readiness again.

If the readiness key is missing, register and change-email pre-checks fall back
to MongoDB. Forgot-password request, resend, and OTP verification lookup also
fall back to MongoDB after rate limiting while preserving generic public
responses.

### Drift monitoring

Add counters or logs for:

- readiness key missing
- bitmap bit `0` path taken
- bitmap bit `1` and MongoDB miss
- positive cache hit and MongoDB missing user
- negative cache hit
- Redis lookup failure fallback
- drift detection failure that unsets readiness

These events show false positives, stale cache, and Redis drift.

## Error Handling

| Scenario | Public outcome |
| --- | --- |
| Forgot password unknown email | Generic accepted response |
| Forgot password Redis bitmap bit `0` | Generic accepted response |
| Register duplicate email | Existing `409` duplicate email |
| Change email duplicate new email | Existing duplicate email response |
| Login missing email | `401 Invalid email or password` |
| Login wrong password | `401 Invalid email or password` |
| Reset token invalid or expired | Existing reset-token failure |
| OTP invalid or expired | Existing OTP failure |
| Redis lookup failure during login/register | Fall back to MongoDB |
| Bitmap readiness missing during register/change-email | Fall back to MongoDB pre-check |
| Redis OTP failure | Fail closed; do not claim OTP/mail success |
| MongoDB failure | Centralized error handling or fail closed |

## Test Strategy

### Unit tests

- canonical email is used for lookup keys
- bitmap bit `0` skips MongoDB in forgot-password request
- missing readiness flag disables register/change-email DB-skip behavior
- bitmap bit `1` still checks cache and MongoDB
- negative cache prevents repeated MongoDB lookup after bitmap false positive
- register success deletes negative cache and sets positive cache
- change email success syncs old and new lookup state
- login ignores bitmap for credential authorization
- Redis lookup failure falls back to MongoDB where required
- cooldown keys prevent duplicate mail enqueue

### Integration tests

- random forgot-password spam does not produce MongoDB reads when bitmap misses
- existing user forgot-password still sends OTP/mail
- concurrent register verify produces one success and one duplicate conflict
- concurrent change-email verify to the same new email produces one success and
  one duplicate conflict
- logout-all revokes old access tokens after token version increment
- OAuth-created user updates lookup state

### Manual verification

- inspect Redis keys for hashed lookup keys
- verify no raw OTP, token, or password appears in logs
- simulate Redis outage for lookup-only paths
- simulate Redis outage for OTP paths

## Rollout

1. Add key builders and lookup helpers.
2. Add bitmap rebuild/backfill command or job.
3. Add readiness flag checks and fallback behavior.
4. Deploy lookup helpers in observe-only mode if practical.
5. Backfill bitmap and set readiness.
6. Enable forgot-password bit `0` database skip.
7. Add register and change-email lookup optimization.
8. Add positive/negative cache instrumentation.
9. Consider login positive-cache optimization only after invalidation is proven.

## Alternatives Considered

### Use bitmap everywhere

Rejected. Token, session, authenticated password change, and OTP verification
flows are not email-existence lookup problems. Applying bitmap there would add
risk without meaningful benefit.

### Cache complete auth user snapshots

Deferred. It reduces MongoDB reads during login but requires precise
invalidation for password, token version, disable state, email change, and
OAuth linkage.

### Full multi-hash Bloom filter immediately

Deferred. A single bitmap is simpler and sufficient for reducing random
forgot-password spam if the false-positive rate is acceptable. A full Bloom
filter can be introduced later with sizing math and multiple indexes.

### Generic register response

Out of scope. It would reduce registration enumeration but changes product
behavior. This spec preserves existing duplicate-email conflict behavior.
