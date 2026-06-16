# Socket Profile Sync Tasks

Status: Implemented pending manual multi-tab verification.

## Implementation Checklist

- [x] Confirm final synced field list.
- [x] Confirm event name: `user:profile-updated`.
- [x] Define shared payload type where frontend socket handlers can use it.
- [x] Emit `user:profile-updated` after successful profile update.
- [x] Include `changedFields` based on validated update input and profile picture changes.
- [x] Ensure socket emit targets only the authenticated user's room.
- [x] Add frontend listener in `useAppSockets`.
- [x] Map `timezone` to invalidation of `user`, `analytics`, `transactions`, and `report`.
- [x] Map `preferredCurrency` to invalidation of `user`, `analytics`, and `report`.
- [x] Map `name` and `profilePicture` to invalidation of `user`.
- [x] Handle malformed or unknown socket payloads without crashing.
- [x] Add backend tests for event emission and payload shape.
- [ ] Add frontend tests for invalidation behavior if the current test setup supports hooks/store behavior.
- [x] Update related specs if timezone-normalization behavior changes.

## Validation Checklist

- [ ] Updating timezone in one tab refreshes affected data in another tab.
- [ ] Updating `Asia/Saigon` still stores/syncs as `Asia/Ho_Chi_Minh`.
- [ ] Updating preferred currency refreshes analytics/report data in another tab.
- [ ] Updating name refreshes account UI or current-user cache in another tab.
- [ ] Updating profile picture refreshes account UI or current-user cache in another tab.
- [ ] Transaction socket events continue to invalidate `transactions` and `analytics`.
- [ ] Bulk import and recurring transaction socket events continue to work.
- [x] Missed socket events do not permanently corrupt local state.
- [x] Client lint passes.
- [x] Client typecheck passes.
- [x] Backend relevant tests pass.
- [x] Backend build/typecheck passes.
- [x] Security review confirms no sensitive user fields are emitted.

## Suggested Execution Order

1. Finalize spec decisions.
2. Create feature branch `feature/socket-profile-sync`.
3. Add backend event emission tests.
4. Implement backend event emission.
5. Add frontend listener tests.
6. Implement frontend listener and invalidation mapping.
7. Manually verify with two tabs.
8. Run lint, typecheck, build, and relevant tests.
9. Update tasks checklist with actual verification results.

## Open Tasks To Decide

- [x] Decide whether to add or use a current-user query endpoint for `user` tag refetch.
- [x] Decide whether report settings should be part of `user:profile-updated`.
- [x] Decide whether to include a `sourceRequestId` to let the initiating tab skip duplicate invalidation.

## Verification Notes

- Backend targeted test passed: `npm.cmd test -- --runTestsByPath src/__tests__/unit/user.controller.test.ts --runInBand`.
- Backend build passed: `npm.cmd run build`.
- Client typecheck passed: `npm.cmd run type-check`.
- Client lint passed: `npm.cmd run lint`.
- Client build did not complete in the current sandbox because Vite/esbuild could not read an ancestor directory while loading `client/vite.config.ts`.
