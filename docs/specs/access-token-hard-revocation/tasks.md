# Access Token Hard Revocation - Tasks

## Decision Gate

- [x] Decide legacy access-token behavior: reject missing version.
- [x] Decide v1 lookup: MongoDB on every request.
- [x] Decide infrastructure failure response: `503`, never fail open.
- [x] Keep `tokenVersion` internal and out of public DTOs.
- [x] Keep normal logout session-scoped.
- [x] Keep refresh-token revocation, blacklist, and socket sync.

Implementation must not start until the first three decisions are approved.

## Backend Model

- [x] Add `tokenVersion` to `UserDocument`.
- [x] Add schema field with default `0` and minimum `0`.
- [x] Prevent normal public user serialization from exposing the field.
- [x] Add a migration/backfill strategy for existing users.

## JWT Issuance

- [x] Extend `AccessTokenPayload` with `tokenVersion`.
- [x] Update password-login access-token issuance.
- [x] Update OAuth access-token issuance.
- [x] Update refresh-token access-token issuance.
- [x] Search for and update every other `signAccessToken` call.
- [ ] Add tests proving all issuance paths include the claim.

## Authentication Validation

- [x] Add an auth-specific user/version lookup.
- [x] Compare JWT version with current user version in Passport and Socket.IO.
- [x] Reject confirmed mismatch before route controllers.
- [x] Implement approved legacy-claim behavior.
- [x] Keep Redis out of the v1 authorization decision.
- [x] Ensure infrastructure failure fails closed.
- [x] Avoid logging raw tokens or version values.

## Account-Wide Revocation

- [x] Create a reusable account-wide revocation operation.
- [x] Atomically increment the user's version.
- [x] Revoke/delete all refresh tokens.
- [x] Run refresh-token deletion and version increment in one MongoDB transaction.
- [x] Require a transaction-capable MongoDB replica set, Atlas cluster, or compatible sharded cluster.
- [x] Keep auth-version caching disabled in v1.
- [x] Apply to logout-all.
- [x] Apply to password change verification and direct password change.
- [x] Apply to password reset.
- [x] Apply to email change verification.
- [x] Emit existing socket event only after revocation succeeds.

## Normal Logout

- [x] Verify normal logout does not call account-wide revocation.
- [x] Preserve current refresh-token revoke.
- [x] Preserve current access-token blacklist TTL.
- [x] Preserve same-browser local logout sync.

## Automated Tests

- [x] Unit: JWT signing includes version.
- [x] Unit: matching version authenticates.
- [x] Unit: mismatched version returns unauthorized.
- [x] Unit: missing version follows approved migration policy.
- [x] Unit: deleted user is rejected.
- [ ] Unit: Redis failure falls back to MongoDB if cache is enabled.
- [x] Unit: MongoDB failure does not fail open.
- [ ] Unit: normal logout does not increment.
- [x] Unit: account-wide revocation uses atomic increment.
- [x] Unit: both revocation writes receive the same MongoDB session.
- [x] Integration: version-increment failure rolls back refresh-token deletion.
- [ ] Unit: password change increments.
- [ ] Unit: password reset increments.
- [ ] Unit: email change increments.
- [x] Unit: concurrent increments use `$inc` and are not overwritten.
- [x] Integration: two old tokens are rejected after account-wide revocation.
- [x] Integration: newly issued token after revocation succeeds.
- [ ] Integration: normal logout does not revoke another device.

## Verification

- [x] Run targeted auth unit tests.
- [x] Run auth integration tests.
- [x] Run backend lint.
- [x] Run backend type-check.
- [x] Run backend build.
- [ ] Measure protected-route latency.
- [x] Complete security review.
- [x] Verify OpenAPI behavior remains compatible.
- [x] Update auth-session-sync docs to reference the completed hard-revocation feature.

## Manual Verification

- [ ] Login on Browser A and Browser B.
- [ ] Capture both access tokens for controlled local testing.
- [ ] Trigger logout-all from Browser A.
- [ ] Confirm both old tokens receive `401`.
- [ ] Login again and confirm the new token succeeds.
- [ ] Repeat with Browser B disconnected from Socket.IO.
- [ ] Confirm backend still rejects Browser B's old token.
- [ ] Confirm normal logout on Browser A does not revoke Browser B.
