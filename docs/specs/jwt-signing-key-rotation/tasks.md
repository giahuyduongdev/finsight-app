# JWT Signing Key Rotation - Tasks

## Decision Gate

- [x] Keep `HS256`.
- [x] Use current/previous env keys instead of env JSON key ring.
- [x] Do not add JWKS.
- [x] Do not use Redis or database storage for signing keys.
- [x] Do not implement refresh-token rotation in this slice.
- [x] Do not implement per-device session management in this slice.
- [x] Support temporary legacy fallback for no-`kid` tokens.
- [x] Use separate access and refresh legacy fallback flags.

## Requirements And Design

- [x] Create `requirements.md`.
- [x] Create `design.md`.
- [x] Create `sequence.mmd`.
- [x] Create implementation task checklist.
- [x] Review spec for contradiction, incomplete text, and unclear rollout.
- [x] Confirm legacy fallback uses separate access/refresh flags before
  implementation.

## Environment Configuration

- [x] Add new env keys to `backend/src/config/env.config.ts`.
- [x] Add examples to `backend/.env.example`.
- [x] Add examples to root `.env.example` if backend JWT keys are documented
  there.
- [x] Validate current access key config fails closed.
- [x] Validate current refresh key config fails closed.
- [x] Validate previous key pairs are either both present or both absent.
- [x] Validate current and previous kids are not equal within the same token
  family.

## JWT Key Resolver

- [x] Add a focused JWT key resolver utility.
- [x] Resolve current access signing key.
- [x] Resolve current refresh signing key.
- [x] Resolve access verify key by `kid`.
- [x] Resolve refresh verify key by `kid`.
- [x] Implement legacy access fallback when
  `JWT_ACCESS_LEGACY_FALLBACK_ENABLED=true`.
- [x] Implement legacy refresh fallback when
  `JWT_REFRESH_LEGACY_FALLBACK_ENABLED=true`.
- [x] Reject unknown `kid`.
- [x] Reject wrong-family `kid`.
- [x] Keep raw token and secrets out of logs.

## JWT Utility

- [x] Update `signAccessToken` to set current access `kid`.
- [x] Update `signRefreshToken` to set current refresh `kid`.
- [x] Update `verifyAccessToken` to verify with resolved access key.
- [x] Update `verifyRefreshToken` to verify with resolved refresh key.
- [x] Keep `HS256`, issuer, audience, and expiry checks unchanged.

## Passport Integration

- [x] Replace static `secretOrKey` with `secretOrKeyProvider`.
- [x] Reuse the access-token key resolver in the provider.
- [x] Preserve Passport strategy algorithm, issuer, and audience checks.
- [x] Confirm socket auth continues using `verifyAccessToken`.

## Tests

- [x] Add unit test: access signer sets current access `kid`.
- [x] Add unit test: refresh signer sets current refresh `kid`.
- [x] Add unit test: access verifier accepts current access key.
- [x] Add unit test: access verifier accepts previous access key.
- [x] Add unit test: refresh verifier accepts current refresh key.
- [x] Add unit test: refresh verifier accepts previous refresh key.
- [x] Add unit test: unknown access `kid` is rejected.
- [x] Add unit test: unknown refresh `kid` is rejected.
- [x] Add unit test: access verifier rejects refresh-family `kid`.
- [x] Add unit test: refresh verifier rejects access-family `kid`.
- [x] Add unit test: no-`kid` access token behavior follows access fallback
  flag.
- [x] Add unit test: no-`kid` refresh token behavior follows refresh fallback
  flag.
- [x] Add unit test: invalid key config fails closed.
- [x] Add integration test: service-created refresh token uses current refresh
  `kid`.
- [x] Add integration test: refresh flow supports previous refresh key.
- [x] Add route/auth regression for previous access key through Passport.

## Validation

- [x] Run backend JWT unit tests.
- [x] Run backend auth service tests.
- [x] Run backend auth integration tests.
- [x] Run backend lint.
- [x] Run backend typecheck.
- [x] Run backend build.
- [x] Complete security review.

## Rollout Checklist

- [ ] Generate new access and refresh secrets.
- [ ] Configure current keys and keep access/refresh legacy fallback enabled.
- [ ] Deploy.
- [ ] Confirm new tokens include `kid`.
- [ ] Wait for old no-`kid` access tokens to expire.
- [ ] Wait for old no-`kid` refresh tokens to expire.
- [ ] Disable access legacy fallback after old no-`kid` access tokens expire.
- [ ] Disable refresh legacy fallback after old no-`kid` refresh tokens expire.
- [ ] For next rotation, move current key to previous and introduce a new
  current key.
