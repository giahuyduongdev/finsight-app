# Auth Session Sync - Tasks

## Implementation Tasks

- [x] Backend: create auth socket helper for `auth:session-revoked`.
- [x] Backend: define payload type and reason/message mapping.
- [x] Backend: emit after logout-all succeeds.
- [x] Backend: emit after password change OTP verification succeeds.
- [x] Backend: emit after email change OTP verification succeeds.
- [x] Backend: emit after password reset succeeds, if the affected user can be identified.
- [x] Backend: catch/log socket emit failures without failing auth flow.
- [x] Backend: ensure failed validation/business errors do not emit.
- [x] Backend: add unit tests for logout-all emit success.
- [x] Backend: add unit tests for password change emit success.
- [x] Backend: add unit tests for email change emit success.
- [x] Backend: add unit tests for password reset emit success if included.
- [x] Backend: add unit test for socket emit failure not failing response.
- [x] Frontend: add `auth:session-revoked` listener in `use-app-sockets.ts`.
- [x] Frontend: dispatch `logout()` when event is received.
- [x] Frontend: reset RTK Query API cache on auth revocation.
- [x] Frontend: show toast based on event message/reason.
- [x] Frontend: redirect to `/`.
- [x] Frontend: remove listener on cleanup.
- [x] Frontend: add Vitest coverage for listener behavior.
- [x] Frontend: add local logout broadcast helper.
- [x] Frontend: publish local logout from navbar logout.
- [x] Frontend: subscribe to local logout in app socket/auth lifecycle.
- [x] Frontend: reset auth state/cache and redirect sibling tabs on local logout.
- [x] Verification: run backend auth/session tests.
- [ ] Verification: run frontend hook tests.
- [x] Verification: run backend lint/build.
- [x] Verification: run frontend lint/type-check.
- [ ] Manual test: two tabs, logout-all.
- [ ] Manual test: two tabs, password change.
- [ ] Manual test: two tabs, email change.
- [ ] Manual test: password reset while logged-in tab is open, if included.
- [ ] Manual test: navbar logout syncs tabs in the same browser profile only.

## Suggested Order

1. Implement backend helper and tests around helper behavior.
2. Add logout-all emit and controller/service test.
3. Add password/email/password-reset emit points and tests.
4. Add frontend socket listener and Vitest coverage.
5. Run verification commands.
6. Manual test with two browser tabs.

## Explicitly Not Doing In This Feature

- Session/device management UI.
- Per-device revoke.
- Token/session versioning.
- JWT middleware rewrite.
- Login/refresh endpoint contract changes.
- New auth notification inbox/history.
- Cross-browser same-device logout sync.

## Decisions To Confirm

- [x] V1 is realtime UX sync only; hard access-token invalidation becomes a separate feature.
- [x] Password reset should emit `auth:session-revoked` when userId is known.
- [x] Email change keeps current behavior: revoke all sessions and force login again.
- [x] Frontend can use `window.location.assign('/')` from socket hook.
- [x] Normal navbar logout syncs same-browser tabs locally and does not call logout-all.
