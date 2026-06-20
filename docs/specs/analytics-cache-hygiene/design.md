# Analytics Cache Hygiene - Design

## Recommended Approach

Reuse the existing helper:

```ts
invalidateUserAnalyticsCache(userId)
```

Call it after a successful user profile update, only when the request includes analytics-affecting fields:

- `timezone`
- `preferredCurrency`

Do not add a new socket event. The existing `user:profile-updated` event already handles frontend refetch behavior.

## Implementation Location

Recommended location:

```text
backend/src/controllers/user.controller.ts
```

Reasoning:

- The controller already derives `changedFields`.
- The controller already emits `user:profile-updated`.
- The same `changedFields` list can decide whether analytics cache should be invalidated.
- The user repository should stay focused on user document cache (`user:<id>`) rather than analytics cache concerns.

Flow:

1. Derive `changedFields` from request body/file.
2. Call `userService.update`.
3. If `changedFields` contains `timezone` or `preferredCurrency`, invalidate analytics cache.
4. Emit `user:profile-updated`.
5. Return success response.

## Controller Helpers

Add a small predicate:

```ts
const shouldInvalidateAnalyticsCache = (
  changedFields: ProfileUpdatedField[]
) =>
  changedFields.includes('timezone') ||
  changedFields.includes('preferredCurrency');
```

Add a safe wrapper:

```ts
const invalidateAnalyticsCacheForProfileChange = async (
  userId: string,
  changedFields: ProfileUpdatedField[]
) => {
  if (!shouldInvalidateAnalyticsCache(changedFields)) return;

  try {
    await invalidateUserAnalyticsCache(userId);
  } catch (error) {
    logger.warn('[APP:User] Failed to invalidate analytics cache after profile update', {
      userId,
      changedFields,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
```

`invalidateUserAnalyticsCache` already catches internal errors today, but the wrapper protects the profile update flow if the helper changes later.

## Ordering

Recommended order:

1. User DB/cache update succeeds.
2. Analytics cache invalidation runs best-effort.
3. `user:profile-updated` is emitted.
4. HTTP response returns success.

This may add a small amount of latency to profile updates. V1 accepts this because the helper scans only the user's analytics keys. If this becomes noticeable, the invalidation can become fire-and-forget later.

## Not In V1

### No Cache Key Format Change

The current key already includes `timezone` and `preferredCurrency`, so new data should not read old keys. This feature only removes stale old keys earlier.

### No Frontend Change

The frontend already handles:

- `user:profile-updated`
- analytics invalidation when `timezone` changes
- analytics invalidation when `preferredCurrency` changes

No new frontend event or query is required.

## Test Strategy

### Backend Unit Tests

Update `user.controller.test.ts`:

- Updating `timezone` calls `invalidateUserAnalyticsCache('user-123')`.
- Updating `preferredCurrency` calls `invalidateUserAnalyticsCache('user-123')`.
- Updating both fields calls invalidation once.
- Updating `name` does not call invalidation.
- Invalidation failure still returns success and logs warning.
- Existing socket emit behavior remains covered.

### Cache Util Tests

Optional extra coverage:

- scan pattern is `analytics:*:<escapedUserId>:*`
- matching keys call `redis.unlink(...keys)`
- empty scan resolves without error
- scan error resolves and logs

V1 should prioritize controller tests because the helper already exists and is already used by transaction flows.

### Manual Verification

1. Create analytics cache by calling dashboard/analytics endpoints.
2. Confirm Redis has keys matching `analytics:*:<userId>:*`.
3. Update timezone or preferred currency.
4. Confirm old keys were removed.
5. Refresh dashboard and confirm analytics are recalculated and new cache keys are created.

