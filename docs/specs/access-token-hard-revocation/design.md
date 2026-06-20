# Access Token Hard Revocation - Design

## Selected Approach

Use an account-level, monotonically increasing `tokenVersion`.

- MongoDB stores the authoritative version on the user record.
- Access JWTs contain the version that was current when they were issued.
- Passport authentication compares the JWT version with the current user version.
- Account-wide security events atomically increment the version.
- Existing refresh-token revocation, access-token blacklist, and socket synchronization remain in place.

This is simpler than tracking every access token or JTI and matches the required account-wide revocation behavior.

## Data Model

Add to `UserDocument` and `userSchema`:

```ts
tokenVersion: number
```

Schema rules:

```ts
{
  type: Number,
  default: 0,
  min: 0,
  select: false
}
```

`select: false` is preferred to avoid exposing the field through normal user reads. Authentication-specific repository/service methods must explicitly select it.

Atomic revocation:

```ts
UserModel.findByIdAndUpdate(
  userId,
  { $inc: { tokenVersion: 1 } },
  { new: true, projection: { tokenVersion: 1 } }
)
```

Concurrent revocations are safe because each operation increments rather than overwrites.

## JWT Contract

Extend the internal access-token payload:

```ts
type AccessTokenPayload = {
  userId: string;
  tokenVersion: number;
};
```

All access-token issuance paths must obtain the current version and call:

```ts
signAccessToken({
  userId,
  tokenVersion
})
```

JWT signing and verification must keep the existing:

- HS256 algorithm
- issuer validation
- audience validation
- expiry validation

The version claim is an authorization-state claim, not a secret.

## Authentication Flow

Passport continues cryptographic JWT verification first.

After decoding:

1. Validate `userId`.
2. Validate `tokenVersion` according to the approved legacy-token policy.
3. Load the user and authoritative token version.
4. Compare versions.
5. Reject with `401` on mismatch.
6. Return the authenticated user only after the comparison succeeds.

The existing `user:<userId>` cache must not be used as the security source unless it is guaranteed to contain a current version. Prefer a dedicated auth lookup that explicitly selects `tokenVersion`.

## Version Lookup

### Safe baseline

The safest first implementation reads the current version from MongoDB on every authenticated request.

Advantages:

- immediate and deterministic revocation
- no stale authorization cache
- simplest behavior to test and reason about

Cost:

- one user lookup per authenticated request

### Redis optimization

If performance measurements require Redis, use a dedicated key:

```text
auth:token-version:<userId>
```

MongoDB remains authoritative. Redis must never silently authorize from a value that may be stale after revocation.

Before enabling this optimization, implementation must define:

- cache write/invalidation order
- behavior during Redis timeouts
- behavior when Redis recovers with an old key
- cross-process consistency
- maximum tolerated revocation delay

If the requirement remains strict immediate revocation, any bounded stale period is unacceptable.

## Revocation Service

Create one internal operation for account-wide revocation:

```ts
revokeAllUserSessions(userId, reason)
```

Responsibilities:

1. Atomically increment `tokenVersion`.
2. Revoke/delete all refresh tokens.
3. Invalidate/update token-version cache when enabled.
4. Return the new version internally if needed.

The service must not emit socket events itself if existing controller-level emit patterns are retained. Controllers continue emitting `auth:session-revoked` only after the security operation succeeds.

The operation should be reused by:

- logout-all
- password change verification
- password reset
- email change verification

## Normal Logout

Normal logout remains unchanged:

1. Revoke the current refresh token.
2. Add the presented access token to Redis blacklist until its expiry.
3. Clear the refresh-token cookie.
4. Broadcast local logout to sibling tabs.

It must not call the account-wide revocation service.

## Refresh Flow

Refresh-token exchange must:

1. Verify the refresh token.
2. Confirm its persisted record is active.
3. Load the user's current `tokenVersion`.
4. Issue the new access token with that version.

If an all-session event already revoked the refresh-token record, refresh fails before issuing an access token.

## Login And OAuth Flow

Password and OAuth login must issue access tokens with the current user version.

New users receive version `0`.

Existing users missing the field are normalized according to the approved migration policy.

## Error Handling

Confirmed version mismatch:

- return `401 Unauthorized`
- use a generic message such as `Token has been revoked`
- do not reveal versions

User missing:

- return the existing unauthenticated outcome

Redis failure:

- fall back to MongoDB

MongoDB/infrastructure failure:

- fail closed
- recommended public response: `503 Service Unavailable`
- do not misreport an infrastructure outage as confirmed invalid credentials

Revocation partially fails:

- do not report success until version increment and refresh-token revocation complete
- socket failure remains non-fatal after security state is committed

## Migration And Rollout

Recommended strict rollout:

1. Deploy schema support with default `0`.
2. Backfill existing users to `tokenVersion: 0`.
3. Update all token issuance paths.
4. Update Passport validation.
5. Reject access tokens missing the claim.
6. Existing users sign in again after deployment.

Compatibility rollout is possible by treating missing claims as `0` for one access-token lifetime, but it weakens the immediate guarantee during that window.

## Security Properties

- Old access tokens cannot become valid again because versions only increase.
- The frontend cannot choose or update its version.
- Socket loss does not affect backend enforcement.
- Refresh-token revocation prevents minting new access tokens from old sessions.
- Normal logout remains session-scoped.
- Raw JWTs are never logged.
- Version values are internal implementation details.

## Test Strategy

### Unit tests

- access token includes `tokenVersion`
- access token verification preserves the claim
- Passport accepts matching versions
- Passport rejects mismatched versions
- Passport handles missing claims according to policy
- normal logout does not increment version
- each all-session flow increments version
- concurrent increments do not lose updates
- Redis failure falls back to MongoDB
- confirmed mismatch does not invoke controllers

### Integration tests

- issue two access tokens at version `0`
- logout-all with token A
- verify token A and token B both receive `401`
- login again and verify version `1` token succeeds
- repeat for password change, password reset, and email change
- verify normal logout leaves token from another device valid

### Performance verification

- measure protected-request latency before and after version validation
- record MongoDB query rate
- add Redis optimization only if measurements justify the complexity

## Alternatives Considered

### MongoDB check on every request

Safest and simplest. Recommended baseline despite additional database reads.

### Redis-cached token version

Lower latency, but strict revocation requires a proven cache-coherence strategy. Accepted only as an optimization, not as an unexamined security source.

### Per-token JTI registry

Supports selected-session revocation but requires storing and managing every access token. Rejected for current account-wide scope.

### Rotate JWT signing secret

Invalidates every user's token, not one account. Rejected.

