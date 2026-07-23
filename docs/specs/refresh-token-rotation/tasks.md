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
- [ ] Review with user before implementation.

## Data Model

- [ ] Add `tokenFamilyId` to refresh-token documents.
- [ ] Add `rotatedFromToken` to refresh-token documents.
- [ ] Add `replacedByToken` to refresh-token documents.
- [ ] Add `rotatedAt` to refresh-token documents.
- [ ] Add `reuseGraceUntil` to refresh-token documents.
- [ ] Add `replayDetectedAt` to refresh-token documents.
- [ ] Add `revocationReason` to refresh-token documents.
- [ ] Add indexes for token lookup and token-family active lookup.
- [ ] Preserve digest-only storage for `token`.

## Environment Configuration

- [ ] Add `REFRESH_TOKEN_ROTATION_GRACE_SECONDS`.
- [ ] Validate grace seconds as an integer from `0` to `60`.
- [ ] Default grace seconds to `10`.
- [ ] Document the value in backend env examples.

## Refresh Token Issuance

- [ ] Update `createRefreshToken` to create a new `tokenFamilyId` for first
  issuance.
- [ ] Allow `createRefreshToken` or a focused helper to issue a token inside an
  existing family during rotation.
- [ ] Keep cleanup of expired/revoked records scoped so it does not delete
  records needed for grace/replay detection too early.
- [ ] Ensure new refresh tokens continue using the current refresh signing key
  from JWT key rotation.

## Refresh Flow

- [ ] Verify presented refresh JWT before DB lookup.
- [ ] Hash the presented refresh token before lookup.
- [ ] Rotate active refresh-token records in a MongoDB transaction.
- [ ] Revoke the old record with `revocationReason: 'rotated'`.
- [ ] Set `rotatedAt`, `reuseGraceUntil`, and `replacedByToken` on the old
  record.
- [ ] Create one replacement active record in the same `tokenFamilyId`.
- [ ] Return access token, access expiry, and replacement refresh token.
- [ ] Re-check user `tokenVersion` and active token state to preserve existing
  hard-revocation behavior.

## Grace And Replay Handling

- [ ] Detect revoked rotated tokens by digest.
- [ ] Treat only the immediately previous token as grace-eligible.
- [ ] Do not create a new refresh token for grace duplicate handling.
- [ ] During grace duplicate handling, return access token only and do not set a
  new refresh cookie.
- [ ] Revoke the token family when a revoked token is reused outside grace.
- [ ] Revoke the token family when an older revoked token is reused.
- [ ] Return generic unauthorized responses for replay cases.
- [ ] Log replay events without raw tokens, cookies, or secrets.

## Controller And DTO

- [ ] Update refresh controller to set the replacement refresh-token cookie.
- [ ] Match login/OAuth refresh-cookie options.
- [ ] Extend token refresh DTO response with `refreshToken`.
- [ ] Keep cookie input preferred over body input.

## Logout And All-Session Revocation

- [ ] Mark normal logout revocation with `revocationReason: 'logout'`.
- [ ] Ensure logout-all continues revoking all user refresh tokens.
- [ ] Ensure replay family revocation does not increment `tokenVersion` unless
  explicitly selected during implementation review.
- [ ] Preserve current access-token blacklist behavior.

## Tests

- [ ] Unit: first refresh-token issuance creates a family id.
- [ ] Unit: successful refresh revokes old token and creates replacement.
- [ ] Unit: replacement token remains digest-only in MongoDB.
- [ ] Unit: refresh response mapper includes replacement refresh token.
- [ ] Unit: previous token inside grace does not revoke family.
- [ ] Unit: previous token outside grace revokes family.
- [ ] Unit: older revoked token revokes family.
- [ ] Unit: unknown token does not revoke unrelated sessions.
- [ ] Unit: logout-revoked token is not grace-eligible.
- [ ] Integration: login then refresh sets a new refresh cookie.
- [ ] Integration: old refresh token fails after grace expires.
- [ ] Integration: replay revokes the current active token in the same family.
- [ ] Integration: concurrent refresh attempts do not leave two active tokens in
  one family.
- [ ] Integration: logout-all racing with refresh leaves no usable refresh token.

## Validation

- [ ] Run backend auth unit tests.
- [ ] Run backend JWT unit tests.
- [ ] Run backend auth integration tests.
- [ ] Run backend lint.
- [ ] Run backend typecheck.
- [ ] Run backend build.
- [ ] Complete security review before merge.

## Rollout Checklist

- [ ] Deploy schema-compatible code.
- [ ] Confirm new login sessions create `tokenFamilyId`.
- [ ] Confirm refresh responses set replacement cookies.
- [ ] Monitor replay logs and refresh unauthorized rate.
- [ ] Confirm no raw refresh JWTs appear in MongoDB.
- [ ] After old sessions expire, reject or clean up legacy records without
  `tokenFamilyId`.
