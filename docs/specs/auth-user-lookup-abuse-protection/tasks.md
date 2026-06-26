# Auth User Lookup And Abuse Protection - Tasks

## Status

Implemented and verified.

## Implementation Order

### 1. Add lookup key builders

- Add canonical-email lookup key helpers.
- Add `sha256(canonicalEmail)` helper if no suitable helper exists.
- Add positive cache key: `user:email:{hash}`.
- Add negative cache key: `nf:email:{hash}`.
- Add bitmap key: `bitmap:users:email:v1`.
- Add readiness key: `bitmap:users:email:v1:ready`.
- Add cooldown key builders for forgot password, resend, change password, and
  change email.

Validation:

- Unit tests prove raw email is not used in new lookup/cache keys.
- Unit tests prove mixed-case email maps to the same keys.

### 2. Add presence-filter helper

- Implement `getUserEmailPresence(canonicalEmail)`.
- Implement `markUserEmailPresent(canonicalEmail)`.
- Implement `isUserEmailBitmapReady()`.
- Implement `markUserEmailBitmapReady()` for completed backfill.
- Implement `clearUserEmailBitmapReady(reason)` for Redis flush, drift, or
  strategy changes.
- Keep the first implementation single-hash unless a full Bloom filter is
  explicitly selected.
- Document that bit `1` means maybe exists.

Validation:

- Bit `0` returns definitely absent.
- Bit `1` returns maybe present.
- Missing readiness flag disables bit `0` database-skip behavior.
- Redis failure returns a fallback signal without claiming existence.

### 3. Add positive and negative cache helpers

- Implement get/set/delete positive cache by canonical email.
- Store only `{ userId }` in the first implementation.
- Implement get/set/delete negative cache with 300-second TTL.
- Do not cache password hashes or token versions.

Validation:

- Positive cache hit still requires MongoDB for auth-sensitive fields.
- Negative cache expires and can be deleted after user creation.

### 4. Add register lookup sync

- Use bitmap and positive cache for early duplicate checks.
- Check bitmap readiness before using bit `0` to skip MongoDB.
- Fall back to MongoDB duplicate pre-check when readiness is missing.
- Keep MongoDB unique email index as final authority.
- Translate duplicate key `11000` to the existing duplicate-email conflict.
- After successful verify, set bitmap, set positive cache, and delete negative
  cache.

Validation:

- Unknown email with bit `0` skips duplicate MongoDB pre-check.
- Bit `1` checks cache and MongoDB.
- Concurrent verify creates at most one user.
- Register success clears stale negative cache.

### 5. Add forgot-password abuse protection

- Apply email-hash cooldown before OTP/mail work.
- Use bitmap bit `0` to return generic response without MongoDB.
- Use positive cache, negative cache, and MongoDB when bit is `1`.
- Set negative cache on MongoDB miss.
- Set positive cache and bitmap on MongoDB hit.
- Keep generic public response for all outcomes.

Validation:

- Random unknown emails with bit `0` do not query MongoDB.
- Existing user receives OTP/mail.
- Unknown user with bitmap false positive sets negative cache.
- Cooldown prevents repeated mail enqueue.

### 6. Keep login conservative

- Do not reject login from bitmap bit `0`.
- Optionally use positive cache to find `userId`.
- Always load password hash and security state from MongoDB.
- Preserve dummy bcrypt comparison for missing users.
- Preserve one invalid-credentials public response.

Validation:

- Missing user and wrong password return the same public result.
- Positive cache hit still loads MongoDB auth fields.
- Stale positive cache cannot authorize login.

### 7. Update forgot-password verify, resend, and reset

- Ensure verify and resend do not reveal user existence.
- Ensure reset token, not bitmap, authorizes reset.
- After reset success, revoke all sessions and invalidate auth cache state.
- Clean stale reset/forgot-password Redis state when safe.

Validation:

- Invalid OTP and unknown email do not leak existence.
- Reset token failure does not update password.
- Reset success revokes existing access tokens.

### 8. Update change-password flows

- Keep flows user-id based after JWT authentication.
- Add user-id cooldown for request/resend.
- Do not use bitmap for current-user password changes.
- Invalidate auth cache after password change.
- Revoke all sessions after password change.

Validation:

- Request requires valid access token.
- Wrong old password does not create pending OTP state.
- Verify success revokes old sessions.

### 9. Update change-email flows

- Use bitmap/cache/MongoDB for the new email pre-check.
- Check bitmap readiness before using bit `0` to skip MongoDB.
- Fall back to MongoDB duplicate pre-check when readiness is missing.
- Keep MongoDB unique email index as final authority at verify.
- On success:
  - delete old email positive cache
  - set new email positive cache
  - set new email bitmap bit
  - delete new email negative cache
  - revoke all sessions

Validation:

- New email duplicate returns existing conflict response.
- Concurrent verify to the same new email produces one success and one conflict.
- Old email cache cannot keep resolving to the user after change.

### 10. Update OAuth callback lookup sync

- Do not use bitmap in OAuth redirect.
- After callback find/link/create, sync lookup state for canonical email.
- Delete stale negative cache after OAuth-created or linked account.

Validation:

- OAuth-created user sets bitmap and positive cache.
- OAuth link to existing email does not create duplicate users.

### 11. Verify token and session flows stay isolated

- Confirm refresh-token flow does not use bitmap or email lookup cache.
- Confirm logout remains session-scoped.
- Confirm logout-all remains account-wide through token-version revocation.

Validation:

- Refresh issues access token with current token version.
- Normal logout does not revoke sibling sessions.
- Logout-all revokes sibling access tokens.

### 12. Add observability and fallback tests

- Add counters or structured logs for bitmap misses, false positives, cache hits,
  negative-cache hits, missing readiness, drift detection, and Redis fallback.
- Simulate Redis lookup failure for register/login/forgot-password.
- Simulate Redis OTP failure for OTP-dependent flows.

Validation:

- Lookup-only Redis failure falls back to MongoDB where required.
- OTP Redis failure fails closed.
- No logs contain OTPs, tokens, passwords, or raw reset tokens.

## Completion Checklist

- Requirements, design, and diagrams are updated.
- Focused unit tests pass.
- Auth integration tests pass.
- Lint passes.
- Typecheck passes.
- Build passes.
- Security review covers enumeration, spam, Redis outage, token revocation, and
  sensitive logging.
