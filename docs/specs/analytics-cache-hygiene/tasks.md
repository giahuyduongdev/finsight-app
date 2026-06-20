# Analytics Cache Hygiene - Tasks

## Implementation Tasks

- [x] Backend: import `invalidateUserAnalyticsCache` in `user.controller.ts`.
- [x] Backend: reuse `changedFields` in `updateUserController`.
- [x] Backend: add `shouldInvalidateAnalyticsCache` helper.
- [x] Backend: invalidate analytics cache when `timezone` or `preferredCurrency` is present in changed fields.
- [x] Backend: ensure one request calls invalidation at most once.
- [x] Backend: catch/log invalidation failure without failing the response.
- [x] Backend: preserve existing `user:profile-updated` behavior.
- [x] Test: updating `timezone` calls invalidation.
- [x] Test: updating `preferredCurrency` calls invalidation.
- [x] Test: updating both fields calls invalidation once.
- [x] Test: updating `name` does not call invalidation.
- [x] Test: invalidation failure still returns success.
- [x] Verification: run backend user controller tests.
- [x] Verification: run backend lint/build.
- [ ] Manual verification: create analytics cache, update timezone/currency, confirm old Redis keys are unlinked.

## Suggested Order

1. Update user controller helpers.
2. Add unit tests in `user.controller.test.ts`.
3. Run tests/lint/build.
4. Manually verify Redis if needed.

## Not In This Feature

- No new socket event.
- No frontend socket hook change.
- No analytics aggregation change.
- No analytics cache TTL change.
- No transaction cache invalidation change.
- No global Redis flush.

## Default Decisions

- Invalidate based on request body containing `timezone` or `preferredCurrency`; do not compare old/new values.
- Cache invalidation is best-effort.
- Keep invalidation in the controller because it is tied to the profile update workflow and changed fields.
