# Auth Token And Redis Secret Hardening - Tasks

## Decision Gate

- [x] Confirm rollout policy: delete or revoke existing plaintext refresh-token
  records and require affected users to sign in again.
- [x] Confirm `TOKEN_HASH_SECRET` is required in every deployed environment and
  generated as 32 random bytes encoded as hex.
- [x] Confirm in-flight OTP/reset sessions may be treated as expired during
  deployment.
- [x] Confirm receipt scan cache encryption is out of scope for this slice.

Implementation must not start until these decisions are accepted.

## Digest Utility

- [x] Add any new environment keys to `backend/.env.example` with a short
  purpose note.
- [x] Add `backend/src/utils/secure-hash.util.ts`.
- [x] Implement HMAC-SHA256 using `Env.TOKEN_HASH_SECRET`.
- [x] Fail closed if `TOKEN_HASH_SECRET` is missing or empty.
- [x] Add purpose-specific helpers for OTP, reset token, refresh token,
  blacklist access token, and auth email key suffix.
- [x] Add unit tests for stability, purpose separation, and missing-secret
  behavior.

## Redis Key Builders

- [x] Update email-scoped `REDIS_KEYS` builders to use canonical-email digest
  suffixes.
- [x] Keep user-id scoped change-email keys unchanged.
- [x] Add tests proving raw email does not appear in auth Redis keys.
- [x] Add tests proving email casing and surrounding whitespace resolve to the
  same auth Redis key suffix.

## OTP And Reset Token Hardening

- [x] Replace register OTP SHA-256 creation and verification with `hashOtp`.
- [x] Replace register resend OTP SHA-256 creation with `hashOtp`.
- [x] Replace forgot-password OTP SHA-256 creation and verification with
  `hashOtp`.
- [x] Replace forgot-password resend OTP SHA-256 creation with `hashOtp`.
- [x] Replace reset-token SHA-256 creation and verification with
  `hashResetToken`.
- [x] Replace change-password OTP SHA-256 creation and verification with
  `hashOtp`.
- [x] Replace change-password resend OTP SHA-256 creation with `hashOtp`.
- [x] Replace change-email old/new OTP SHA-256 creation and verification with
  `hashOtp`.
- [x] Replace change-email resend old/new OTP SHA-256 creation with `hashOtp`.
- [x] Add or update unit tests for each touched flow.

## Refresh Token Persistence

- [x] Hash refresh tokens before persisting newly issued records.
- [x] Hash presented refresh tokens before refresh-token MongoDB lookup.
- [x] Hash presented refresh tokens before normal logout revoke lookup.
- [x] Update `RefreshTokenRepository` methods to store, find, and revoke by
  digest if those methods remain part of the supported repository contract.
- [x] Add comments or test names making clear `RefreshToken.token` stores a
  digest.
- [x] Add a cleanup script or documented operational step to delete or revoke
  existing plaintext refresh-token records.
- [x] Add unit tests proving raw refresh JWT is not stored.
- [x] Add integration coverage for refresh and logout using digest persistence.

## Access Token Blacklist

- [x] Change logout blacklist writes to use `blacklist:{accessTokenDigest}`.
- [x] Change logout-all blacklist writes to use `blacklist:{accessTokenDigest}`.
- [x] Change blacklist middleware to compute the digest before Redis lookup.
- [x] Ensure raw access token is not logged on blacklist read/write failure.
- [x] Add unit tests for blacklist write and middleware lookup.
- [x] Add integration test proving a blacklisted token is rejected.

## Logging And Redaction

- [x] Search touched auth paths for raw token, OTP, reset token, password, or
  raw email key logging.
- [x] Update logs to use existing redaction helpers or digest previews.
- [ ] Add regression tests where practical for serializer/redaction behavior.

## Cache Classification Documentation

- [x] Add implementation note or update this spec after implementation with the
  final classification of Redis keys and payloads.
- [x] Explicitly document receipt scan cache as a privacy follow-up if product
  requirements need encrypted readable cache data.
- [x] Explicitly document that exchange-rate and analytics caches remain
  plaintext for this slice.

## Validation

- [x] Run targeted auth unit tests.
- [x] Run auth integration tests.
- [x] Run middleware blacklist tests.
- [x] Run secure hash utility tests.
- [x] Run backend lint.
- [x] Run backend typecheck.
- [x] Run backend build.
- [ ] Inspect generated Redis keys manually in local auth flows.
- [ ] Inspect refresh-token documents manually in local MongoDB.
- [x] Complete security review.

## Rollout Checklist

- [ ] Set `TOKEN_HASH_SECRET` in local, test, staging, and production
  environments.
- [x] Generate `TOKEN_HASH_SECRET` with
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- [x] Confirm `TOKEN_HASH_SECRET` is not reused from `JWT_SECRET`,
  `JWT_REFRESH_SECRET`, or `ENCRYPTION_SECRET`.
- [ ] Deploy code that uses digest persistence and hashed Redis keys.
- [ ] Delete or revoke existing plaintext refresh-token records.
- [ ] Communicate that existing sessions may need to sign in again.
- [ ] Monitor auth error rates after deployment.
- [ ] Monitor Redis/MongoDB logs for unexpected raw token or raw email key
  exposure.
