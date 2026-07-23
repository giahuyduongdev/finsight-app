# Refresh Token Rotation - Design

## Status

Draft.

## Selected Approach

Use MongoDB-backed refresh-token lineage with single-use rotation, short
previous-token grace, and strong replay response.

Each refresh-token document remains a digest-only record. The model gains
minimal lineage metadata so the service can distinguish:

- the currently active token in a lineage
- the immediately previous token that may be tolerated briefly
- older or suspicious tokens that should trigger lineage revocation

On every successful refresh exchange, the backend revokes the presented active
record and creates a new active record in the same lineage. The controller sets
the new httpOnly refresh cookie.

## Alternatives Considered

### A. Strict single-use with no grace

Rejected. This is simplest and safest against replay, but it can punish normal
multi-tab or retry races by revoking sessions too aggressively.

### B. Single-use with short previous-token grace

Selected. This matches common OAuth provider behavior while keeping the local
implementation understandable. Only the immediately previous token in a lineage
is tolerated, and only for a short window.

### C. Reissue a new refresh token during grace reuse

Rejected for this slice. It creates branching token chains under concurrent
requests and makes replay reasoning harder. Grace reuse should return the
minimum response needed to keep the duplicate request from becoming a replay
event, without extending the chain again.

### D. Per-device session table first

Rejected for this slice. Per-device session management is a separate spec. This
work should not require a device UI or client-managed device identity.

## Data Model

Extend `backend/src/models/refresh-token.model.ts` with lineage metadata:

```ts
tokenFamilyId: string
rotatedFromToken?: string
replacedByToken?: string
rotatedAt?: Date
reuseGraceUntil?: Date
replayDetectedAt?: Date
revocationReason?: 'logout' | 'logout-all' | 'rotated' | 'replay' | 'expired'
```

Field notes:

- `token` remains the HMAC digest of the raw refresh JWT.
- `tokenFamilyId` groups tokens created from the same login/OAuth session.
- `rotatedFromToken` stores the previous token digest on the new active record.
- `replacedByToken` stores the new token digest on the revoked previous record.
- `reuseGraceUntil` exists only on the revoked previous record.
- `replayDetectedAt` and `revocationReason` support safe operational diagnosis.

Recommended indexes:

```ts
{ token: 1 } unique
{ userId: 1, tokenFamilyId: 1, isRevoked: 1 }
{ tokenFamilyId: 1, isRevoked: 1 }
{ expiresAt: 1 }
```

No raw token is stored in any field.

## Environment

Add one backend environment value:

```env
REFRESH_TOKEN_ROTATION_GRACE_SECONDS=10
```

Validation:

- minimum: `0`
- maximum: `60`
- default: `10`

Setting `0` disables grace and makes rotation strict single-use.

## API Design

### POST `/api/v1/auth/refresh-token`

Input remains unchanged:

- prefer `req.cookies.refreshToken`
- fall back to `req.body.refreshToken`

Normal successful rotation response body should include the existing
access-token fields and the replacement refresh token for non-cookie clients:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "expiresAt": 1784800000000
  },
  "message": "Token refreshed successfully"
}
```

The controller must also set:

```text
Set-Cookie: refreshToken=<new token>; HttpOnly; Secure in production; SameSite
```

The cookie options should match login/OAuth callback behavior.

Failure responses keep existing generic unauthorized semantics.

Grace-window duplicate handling may return a success response with a fresh
access token but without a replacement refresh token and without setting a new
cookie. This avoids storing raw refresh tokens just to replay the previous
successful response. Cookie clients are expected to converge on the first
successful refresh response that already set the replacement cookie.

## Components

### Refresh token model

Adds lineage fields and indexes. Existing records without `tokenFamilyId` are
legacy records and should be migrated lazily when first used or invalidated by
rollout decision.

### Auth service

Updates:

- `createRefreshToken` creates the first active record in a new family when no
  family id is provided.
- `refreshTokenService` rotates active records atomically and handles
  grace-window reuse.
- `logoutService` marks the current token revoked with reason `logout`.
- `logoutAllService` and existing all-session revocation keep revoking all user
  refresh tokens.

### Auth controller

Sets the replacement refresh-token cookie after `refreshTokenService` succeeds.
The controller does not inspect replay state.

### DTO mapper

Extends `toTokenRefreshResponse` to include `refreshToken`.

### Logging

Logs replay events with user id, token family id, token document id or digest
preview only. Logs must never contain raw refresh JWTs, cookies, or secrets.

## Data Flow

### Login or OAuth callback

1. Backend signs a refresh JWT.
2. Backend hashes the raw refresh JWT with `hashRefreshToken`.
3. Backend creates a refresh-token document with a new `tokenFamilyId`.
4. Backend returns access token and sets refresh cookie as today.

### Normal refresh rotation

1. Client sends current refresh token through cookie or body.
2. Service verifies JWT signature, issuer, audience, and expiry.
3. Service hashes the presented token.
4. Service finds an active, unexpired matching refresh-token record.
5. In one MongoDB transaction:
   - mark old record `isRevoked: true`
   - set `revocationReason: 'rotated'`
   - set `rotatedAt`, `reuseGraceUntil`, and `replacedByToken`
   - create the replacement active refresh-token record in the same family
6. Service signs a new access token.
7. Controller sets the new refresh cookie and returns the new access token.

### Grace-window duplicate

1. Client sends a refresh token that was just rotated.
2. Service finds the revoked record by digest.
3. Service confirms:
   - `revocationReason === 'rotated'`
   - `reuseGraceUntil >= now`
   - `replacedByToken` points to the current active record
   - no newer rotation has superseded that active record
4. Service does not create another refresh token.
5. Service returns a fresh access token only and does not set a refresh cookie.

This is intentionally narrower than Auth0-style replay of the full successful
response. Finsight does not store raw refresh tokens, so the backend cannot
return the current raw refresh token without adding reversible token storage.
The important security rule is that grace never creates a branching token chain
and never revokes the token family for a near-simultaneous duplicate.

### Replay detection

1. Client sends a revoked refresh token outside grace, or an older revoked token.
2. Service verifies enough JWT payload to identify the claimed user.
3. Service finds the revoked token record by digest.
4. Service revokes all active records in the same `tokenFamilyId`.
5. Service marks `replayDetectedAt` and `revocationReason: 'replay'`.
6. Service returns a generic unauthorized response.

If the token digest is unknown, the service returns generic unauthorized without
revoking unrelated sessions.

### Logout races

Logout and logout-all revocations take priority over rotation. If the token is
revoked by logout before refresh commits, refresh fails. If refresh commits
first, logout should revoke the presented token if still relevant and blacklist
the supplied access token as today.

## Technical Decisions

- Use token family lineage rather than per-device sessions for this slice.
- Treat refresh token reuse as a family-level compromise signal.
- Keep grace bounded to the immediately previous token only.
- Do not create a new refresh token when handling duplicate use of the previous
  token during grace.
- Use MongoDB transactions for rotation to avoid old-token revoked/new-token
  missing partial states.
- Keep body-token support because the OpenAPI contract already documents it,
  but cookie clients remain the primary path.

## Error Handling

| Scenario | Behavior |
| --- | --- |
| Missing refresh token | Existing validation/unauthorized behavior |
| Malformed refresh JWT | Unauthorized |
| Invalid signature, issuer, audience, or expiry | Unauthorized |
| Active token found | Rotate and return new access + refresh token |
| Revoked immediately previous token within grace | Return access token only; no replay revocation; no new chain branch |
| Revoked token outside grace | Revoke token family; unauthorized |
| Older revoked token | Revoke token family; unauthorized |
| Unknown digest | Unauthorized without family revocation |
| MongoDB transaction fails | Unauthorized or centralized 500; do not issue tokens |

## Testing Strategy

### Unit tests

- `createRefreshToken` stores digest and creates `tokenFamilyId`.
- successful refresh revokes old token and creates replacement in same family.
- response mapper includes replacement refresh token.
- grace-window duplicate does not revoke the token family.
- older-token reuse triggers family revocation.
- outside-grace reuse triggers family revocation.
- unknown refresh token does not revoke unrelated tokens.
- logout-revoked token cannot refresh.
- raw refresh token is never persisted.

### Integration tests

- login then refresh returns new access token, sets new refresh cookie, and
  stores only digest values.
- old refresh token cannot be used after grace expires.
- replay of an old token revokes the active token in the same family.
- two near-simultaneous refresh requests do not create multiple active tokens in
  one family.
- logout-all racing with refresh does not leave an active refresh token usable
  after all-session revocation.

## Security Review Notes

- No hardcoded secrets are introduced.
- Raw tokens, cookies, and secrets must stay out of logs.
- Public errors remain generic to avoid token-state probing.
- Refresh-token lookup uses HMAC digest equality, not plaintext persistence.
- Replay logs should be safe for Sentry and server logs.
- The grace window suppresses false replay revocation; it is not a guarantee
  that a lost first refresh response can always recover without sign-in.

## Risks

- A lost first refresh response can still force sign-in later because the
  backend will not store or replay raw replacement refresh tokens.
- MongoDB transaction requirements can complicate local tests. Tests should
  cover transaction behavior where the project already uses Mongo memory server
  replica sets or equivalent support.
- Multiple active records in one family would weaken replay detection. Enforce
  with transactional updates and tests.
- Body-token clients must update their stored refresh token after every
  successful refresh or they will be logged out after grace expires.

## Rollout Plan

1. Deploy schema-compatible code that can read legacy records.
2. New login/OAuth sessions create `tokenFamilyId`.
3. First refresh of a legacy record assigns a new family id during rotation.
4. Monitor replay logs and unauthorized-rate changes.
5. After old legacy sessions expire, treat missing `tokenFamilyId` as invalid.
