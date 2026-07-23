# Refresh Token Rotation - Tasks

## Decision Gate

- [x] Rotate refresh tokens after every successful refresh exchange.
- [x] Revoke the presented refresh token during rotation.
- [x] Use strong replay handling by revoking the affected token family.
- [x] Allow only the immediately previous token during a short grace window.
- [x] Do not create a branching token chain during grace handling.
- [x] Keep raw refresh tokens out of MongoDB.
- [x] Keep per-device session management out of this slice.

## Requirements And Design

- [x] Create requirements.
- [x] Create design.
- [x] Create sequence diagram.
- [x] Create implementation task checklist.
- [x] Review with user before implementation.

## Data Model

- [x] Add `tokenFamilyId` to refresh-token documents.
- [x] Add `rotatedFromToken` to refresh-token documents.
- [x] Add `replacedByToken` to refresh-token documents.
- [x] Add `rotatedAt` to refresh-token documents.
- [x] Add `reuseGraceUntil` to refresh-token documents.
- [x] Add `replayDetectedAt` to refresh-token documents.
- [x] Add `revocationReason` to refresh-token documents.
- [x] Add indexes for token lookup and token-family active lookup.
- [x] Preserve digest-only storage for `token`.

## Environment Configuration

- [x] Add `REFRESH_TOKEN_ROTATION_GRACE_SECONDS`.
- [x] Validate grace seconds as an integer from `0` to `60`.
- [x] Default grace seconds to `10`.
- [x] Document the value in backend env examples.

## Refresh Token Issuance

- [x] Update `createRefreshToken` to create a new `tokenFamilyId` for first
  issuance.
- [x] Allow `createRefreshToken` or a focused helper to issue a token inside an
  existing family during rotation.
- [x] Keep cleanup of expired/revoked records scoped so it does not delete
  records needed for grace/replay detection too early.
- [x] Ensure new refresh tokens continue using the current refresh signing key
  from JWT key rotation.

## Refresh Flow

- [x] Verify presented refresh JWT before DB lookup.
- [x] Hash the presented refresh token before lookup.
- [x] Rotate active refresh-token records in a MongoDB transaction.
- [x] Revoke the old record with `revocationReason: 'rotated'`.
- [x] Set `rotatedAt`, `reuseGraceUntil`, and `replacedByToken` on the old
  record.
- [x] Create one replacement active record in the same `tokenFamilyId`.
- [x] Return access token, access expiry, and replacement refresh token.
- [x] Re-check user `tokenVersion` and active token state to preserve existing
  hard-revocation behavior.

## Grace And Replay Handling

- [x] Detect revoked rotated tokens by digest.
- [x] Treat only the immediately previous token as grace-eligible.
- [x] Do not create a new refresh token for grace duplicate handling.
- [x] During grace duplicate handling, return access token only and do not set a
  new refresh cookie.
- [x] Revoke the token family when a revoked token is reused outside grace.
- [x] Revoke the token family when an older revoked token is reused.
- [x] Return generic unauthorized responses for replay cases.
- [x] Log replay events without raw tokens, cookies, or secrets.

## Controller And DTO

- [x] Update refresh controller to set the replacement refresh-token cookie.
- [x] Match login/OAuth refresh-cookie options.
- [x] Extend token refresh DTO response with `refreshToken`.
- [x] Keep cookie input preferred over body input.

## Logout And All-Session Revocation

- [x] Mark normal logout revocation with `revocationReason: 'logout'`.
- [x] Ensure logout-all continues revoking all user refresh tokens.
- [x] Ensure replay family revocation does not increment `tokenVersion` unless
  explicitly selected during implementation review.
- [x] Preserve current access-token blacklist behavior.

## Tests

- [x] Unit: first refresh-token issuance creates a family id.
- [x] Unit: successful refresh revokes old token and creates replacement.
- [x] Unit: replacement token remains digest-only in MongoDB.
- [x] Unit: refresh response mapper includes replacement refresh token.
- [x] Unit: previous token inside grace does not revoke family.
- [x] Unit: previous token outside grace revokes family.
- [x] Integration: older revoked token revokes family.
- [x] Integration: unknown token does not revoke unrelated sessions.
- [x] Integration: logout-revoked token is not grace-eligible.
- [x] Unit: refresh controller sets a new refresh cookie.
- [x] Integration: old refresh token fails after grace expires.
- [x] Integration: replay revokes the current active token in the same family.
- [ ] Integration: concurrent refresh attempts do not leave two active tokens in
  one family.
- [ ] Integration: logout-all racing with refresh leaves no usable refresh token.

## Validation

- [x] Run backend auth unit tests.
- [x] Run backend JWT unit tests.
- [x] Run backend auth integration tests.
- [x] Run backend lint.
- [x] Run backend typecheck.
- [x] Run backend build.
- [x] Complete security review before merge.

## Rollout Checklist

- [ ] Deploy schema-compatible code.
- [ ] Confirm new login sessions create `tokenFamilyId`.
- [ ] Confirm refresh responses set replacement cookies.
- [ ] Monitor replay logs and refresh unauthorized rate.
- [ ] Confirm no raw refresh JWTs appear in MongoDB.
- [ ] After old sessions expire, reject or clean up legacy records without
  `tokenFamilyId`.
