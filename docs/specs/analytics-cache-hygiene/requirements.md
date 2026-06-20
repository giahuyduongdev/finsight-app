# Analytics Cache Hygiene - Requirements

## Status

Draft for review.

## Goal

Ensure user analytics Redis cache is cleaned up when profile fields that affect analytics change:

- `timezone`
- `preferredCurrency`

This feature does not add a new socket event. The frontend already receives `user:profile-updated` and invalidates/refetches the relevant client-side queries. This feature only handles backend Redis cache hygiene so old analytics keys do not remain until TTL expiry.

## Current Context

Analytics cache keys currently use this shape:

```text
analytics:summary:<userId>:<range>:<timezone>:<preferredCurrency>:<from>:<to>
analytics:chart:<userId>:<range>:<timezone>:<preferredCurrency>:<from>:<to>
analytics:pie:<userId>:<range>:<timezone>:<preferredCurrency>:<from>:<to>
```

Current TTL:

```text
300 seconds
```

Existing helper:

```ts
invalidateUserAnalyticsCache(userId)
```

The helper scans this pattern:

```text
analytics:*:<userId>:*
```

and unlinks matching keys.

## Problem

When a user updates `timezone` or `preferredCurrency`:

- the frontend refetches new data via `user:profile-updated`
- new analytics cache keys differ from old keys
- old keys for the user can remain in Redis until TTL expires

The API usually still returns correct data because timezone/currency are part of the key. The issue is stale Redis clutter and harder cache debugging.

## Scope V1

V1 invalidates analytics cache only when profile update includes:

- `timezone`
- `preferredCurrency`

Do not invalidate analytics cache when the update only includes:

- `name`
- `profilePicture`

## Out Of Scope

- No new socket event.
- No analytics cache key format change.
- No analytics TTL change.
- No frontend cache behavior change.
- No Redis cache cleanup for reports.
- No global Redis flush.

## Functional Requirements

### R1. Invalidate analytics cache after successful profile update

When `PATCH /users/me` succeeds and the request body includes `timezone` or `preferredCurrency`, the backend must call:

```ts
invalidateUserAnalyticsCache(userId)
```

### R2. Only invalidate for analytics-affecting fields

If the request only includes `name` or `profilePicture`, analytics cache invalidation is not required.

### R3. Cache invalidation failure must not fail profile update

If Redis scan/unlink fails:

- the profile update API still returns success if the user update succeeded
- the backend logs a warning/error for debugging

Cache cleanup is best-effort and should not make profile updates fail.

### R4. Avoid duplicate invalidation

If one request includes both `timezone` and `preferredCurrency`, call `invalidateUserAnalyticsCache(userId)` only once.

### R5. Reuse existing helper

Do not duplicate Redis scan logic in the user controller/service if `invalidateUserAnalyticsCache` already covers the scope.

## Acceptance Criteria

- Updating `timezone` successfully unlinks the user's analytics keys.
- Updating `preferredCurrency` successfully unlinks the user's analytics keys.
- Updating both `timezone` and `preferredCurrency` calls invalidation once.
- Updating only `name` does not call analytics invalidation.
- Updating only `profilePicture` does not call analytics invalidation.
- Redis invalidation failure does not fail `PATCH /users/me`.
- Existing `user:profile-updated` socket behavior remains unchanged.

## Edge Cases

- Redis has no analytics keys: helper resolves normally, API succeeds.
- Redis scan error: log and continue response success.
- Request body has unrelated fields: do not invalidate.
- User updates timezone to the same previous value: V1 may invalidate if the request body includes `timezone`; no old/new comparison is required.

