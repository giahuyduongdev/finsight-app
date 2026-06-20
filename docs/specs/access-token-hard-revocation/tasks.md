# Access Token Hard Revocation - Tasks

## Decision Gate

- [ ] Decide legacy access-token behavior: reject missing version or temporary version `0` compatibility.
- [ ] Decide v1 lookup: MongoDB on every request or Redis cache with documented fail-closed coherence.
- [ ] Decide infrastructure failure response: recommended `503`, never fail open.
- [x] Keep `tokenVersion` internal and out of public DTOs.
- [x] Keep normal logout session-scoped.
- [x] Keep refresh-token revocation, blacklist, and socket sync.

Implementation must not start until the first three decisions are approved.

## Backend Model

- [ ] Add `tokenVersion` to `UserDocument`.
- [ ] Add schema field with default `0` and minimum `0`.
- [ ] Prevent normal public user serialization from exposing the field.
- [ ] Add a migration/backfill strategy for existing users.

## JWT Issuance

- [ ] Extend `AccessTokenPayload` with `tokenVersion`.
- [ ] Update password-login access-token issuance.
- [ ] Update OAuth access-token issuance.
- [ ] Update refresh-token access-token issuance.
- [ ] Search for and update every other `signAccessToken` call.
- [ ] Add tests proving all issuance paths include the claim.

## Authentication Validation

- [ ] Add an auth-specific user/version lookup.
- [ ] Compare JWT version with current user version in Passport.
- [ ] Reject confirmed mismatch before route controllers.
- [ ] Implement approved legacy-claim behavior.
- [ ] Implement Redis fallback behavior if Redis caching is selected.
- [ ] Ensure infrastructure failure fails closed.
- [ ] Add safe structured logs without raw tokens or version values.

## Account-Wide Revocation

- [ ] Create a reusable account-wide revocation operation.
- [ ] Atomically increment the user's version.
- [ ] Revoke/delete all refresh tokens.
- [ ] Invalidate/update auth-version cache if enabled.
- [ ] Apply to logout-all.
- [ ] Apply to password change verification.
- [ ] Apply to password reset.
- [ ] Apply to email change verification.
- [ ] Emit existing socket event only after revocation succeeds.

## Normal Logout

- [ ] Verify normal logout does not increment `tokenVersion`.
- [ ] Preserve current refresh-token revoke.
- [ ] Preserve current access-token blacklist TTL.
- [ ] Preserve same-browser local logout sync.

## Automated Tests

- [ ] Unit: JWT signing includes version.
- [ ] Unit: matching version authenticates.
- [ ] Unit: mismatched version returns unauthorized.
- [ ] Unit: missing version follows approved migration policy.
- [ ] Unit: deleted user is rejected.
- [ ] Unit: Redis failure falls back to MongoDB if cache is enabled.
- [ ] Unit: both Redis and MongoDB failure do not fail open.
- [ ] Unit: normal logout does not increment.
- [ ] Unit: logout-all increments.
- [ ] Unit: password change increments.
- [ ] Unit: password reset increments.
- [ ] Unit: email change increments.
- [ ] Unit: concurrent increments are not lost.
- [ ] Integration: two old tokens are rejected after logout-all.
- [ ] Integration: newly issued token after revocation succeeds.
- [ ] Integration: normal logout does not revoke another device.

## Verification

- [ ] Run targeted auth unit tests.
- [ ] Run auth integration tests.
- [ ] Run backend lint.
- [ ] Run backend type-check.
- [ ] Run backend build.
- [ ] Measure protected-route latency.
- [ ] Complete security review.
- [ ] Verify OpenAPI behavior remains compatible.
- [ ] Update auth-session-sync docs to reference the completed hard-revocation feature.

## Manual Verification

- [ ] Login on Browser A and Browser B.
- [ ] Capture both access tokens for controlled local testing.
- [ ] Trigger logout-all from Browser A.
- [ ] Confirm both old tokens receive `401`.
- [ ] Login again and confirm the new token succeeds.
- [ ] Repeat with Browser B disconnected from Socket.IO.
- [ ] Confirm backend still rejects Browser B's old token.
- [ ] Confirm normal logout on Browser A does not revoke Browser B.

