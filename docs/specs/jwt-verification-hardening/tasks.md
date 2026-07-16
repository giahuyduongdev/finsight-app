# JWT Verification Hardening - Tasks

## Decision Gate

- [x] Keep this as a focused JWT verification hardening slice.
- [x] Do not redo Passport HTTP JWT strategy because it already whitelists
  `HS256`.
- [x] Do not redo `tokenVersion` hard revocation.
- [x] Do not redo refresh-token digest persistence.
- [x] Preserve global blacklist fail-closed behavior for refresh requests.
- [x] Keep logout cleanup best-effort when access-token blacklist TTL cannot be
  safely computed.

## Backend JWT Helpers

- [x] Back up auth files that contain Vietnamese comments before editing.
- [x] Add `algorithms: ['HS256']` to `verifyAccessToken`.
- [x] Add `algorithms: ['HS256']` to `verifyRefreshToken`.
- [x] Add `audience: 'refresh'` to `verifyRefreshToken`.
- [x] Confirm socket auth still calls `verifyAccessToken` and
  `authenticateAccessToken`.

## Refresh Request Behavior

- [x] Keep `checkBlacklist` global; do not bypass `/auth/refresh-token`.
- [x] Add regression coverage proving a refresh request with a blacklisted
  access token is rejected before refresh-token validation.
- [x] Confirm client 401 handling logs out when refresh is rejected because the
  attached access token is blacklisted.
- [x] Keep normal authenticated request header behavior unchanged.

## Logout Cleanup

- [x] Replace logout blacklist TTL calculation based on unverified `jwt.decode`
  with a verify-first flow.
- [x] If access-token verification succeeds, blacklist the access-token digest
  until expiry.
- [x] If access-token verification fails or the token is expired, skip blacklist
  write and continue logout cleanup.
- [x] Do not log raw access tokens or refresh tokens on logout failures.

## Tests

- [x] Add unit test: `verifyAccessToken` rejects `alg=none`.
- [x] Add unit test: `verifyAccessToken` rejects non-HS256 algorithms.
- [x] Add unit test: `verifyAccessToken` accepts valid HS256 access tokens.
- [x] Add unit test: `verifyRefreshToken` rejects `alg=none`.
- [x] Add unit test: `verifyRefreshToken` rejects non-HS256 algorithms.
- [x] Add unit test: `verifyRefreshToken` rejects missing/wrong audience.
- [x] Add unit test: `verifyRefreshToken` rejects an access token.
- [x] Add unit or integration test for refresh request with blacklisted
  Authorization being rejected.
- [x] Add unit test for logout continuing when access-token blacklist TTL cannot
  be safely computed.
- [x] Add socket auth regression coverage if an existing test harness is
  available.

## Validation

- [x] Run backend auth unit tests.
- [x] Run backend blacklist middleware tests.
- [x] Run backend auth integration tests relevant to refresh/logout.
- [x] Run client auth/API tests relevant to refresh failure handling if client
  code is touched.
- [x] Run backend lint.
- [x] Run backend typecheck.
- [x] Run backend build.
- [x] Run client lint/typecheck/build if client auth code is touched.
- [x] Complete security review for auth changes.

## Out Of Scope Follow-Ups

- [ ] Consider a separate spec if product wants refresh-token rotation.
- [ ] Consider a separate spec if product wants per-device session management.
- [ ] Consider a separate spec if product wants JWT signing-key rotation.
