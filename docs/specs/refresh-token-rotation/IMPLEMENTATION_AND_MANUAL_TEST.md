# Refresh Token Rotation - Implementation And Manual Test

## What Changed

Implemented refresh-token rotation for the existing auth flow.

### Backend behavior

- `POST /api/v1/auth/refresh-token` now rotates refresh tokens.
- A successful refresh:
  - verifies the presented refresh JWT
  - hashes the presented refresh token before MongoDB lookup
  - revokes the presented refresh-token document
  - creates one replacement refresh-token document in the same token family
  - returns a new access token
  - returns a new refresh token in the response body
  - sets a replacement `refreshToken` httpOnly cookie
- Refresh JWTs now include a `jti` so two refresh tokens generated in the same
  second are still different raw tokens.

### Replay handling

- A rotated refresh token reused outside the grace window is treated as replay.
- Replay revokes all active refresh tokens in the same `tokenFamilyId`.
- Replay logs include only safe metadata:
  - `tokenFamilyId`
  - digest preview
- Raw refresh JWTs are not logged.

### Grace handling

- `REFRESH_TOKEN_ROTATION_GRACE_SECONDS` controls the duplicate-request grace
  window.
- Default is `10`.
- Allowed range is `0` to `60`.
- During grace, only the immediately previous rotated token is tolerated.
- Grace duplicate response returns an access token only.
- Grace duplicate response does not create another refresh token and does not
  set a new refresh cookie.

### Persistence changes

Added refresh-token lineage fields:

- `tokenFamilyId`
- `rotatedFromToken`
- `replacedByToken`
- `rotatedAt`
- `reuseGraceUntil`
- `replayDetectedAt`
- `revocationReason`

The `token` field remains a HMAC digest, not the raw refresh JWT.

## Files Changed

- `backend/src/models/refresh-token.model.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/dtos/auth.dto.ts`
- `backend/src/types/dto.type.ts`
- `backend/src/utils/jwt.util.ts`
- `backend/src/config/env.config.ts`
- `backend/.env.example`
- `backend/src/__tests__/integration/auth/auth-token-digest.test.ts`
- `backend/src/__tests__/unit/auth/auth.controller.test.ts`
- `backend/src/__tests__/unit/auth/auth.service.test.ts`
- `docs/specs/refresh-token-rotation/tasks.md`

## Automated Verification

Run from repo root:

```bash
npm.cmd --prefix backend test -- --runInBand auth-token-digest
npm.cmd --prefix backend test -- --runInBand auth.service
npm.cmd --prefix backend test -- --runInBand auth.controller
npm.cmd --prefix backend test -- --runInBand jwt.util jwt-signing-key-rotation
npm.cmd --prefix backend run type-check
npm.cmd --prefix backend run lint
npm.cmd --prefix backend run build
```

All commands passed during implementation.

## Manual Test Setup

1. Start MongoDB, Redis, and the backend as usual.
2. Ensure backend env contains:

```env
REFRESH_TOKEN_ROTATION_GRACE_SECONDS=10
JWT_REFRESH_EXPIRES_IN=7d
```

3. Use an existing test user or create one through the registration flow.
4. Use a client that preserves cookies, such as Postman, Insomnia, browser dev
   tools, or curl with a cookie jar.

## Manual Test 1 - Login Creates A Refresh Token Family

1. Log in:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password1!"
}
```

2. Confirm response has an access token.
3. Confirm response headers include `Set-Cookie: refreshToken=...`.
4. Inspect MongoDB `refreshtokens` collection.

Expected:

- one active refresh-token document exists for the user
- `isRevoked` is `false`
- `tokenFamilyId` exists
- `token` is a digest, not a JWT string
- raw token does not appear in MongoDB

## Manual Test 2 - Refresh Rotates Token

1. Keep the login cookie.
2. Call refresh:

```http
POST /api/v1/auth/refresh-token
Cookie: refreshToken=<refresh token from login>
```

Expected HTTP result:

- status `200`
- response data includes `accessToken`
- response data includes a new `refreshToken`
- response headers include replacement `Set-Cookie: refreshToken=...`

Expected MongoDB result:

- original token document has:
  - `isRevoked: true`
  - `revocationReason: "rotated"`
  - `rotatedAt`
  - `reuseGraceUntil`
  - `replacedByToken`
- replacement token document has:
  - `isRevoked: false`
  - same `tokenFamilyId`
  - `rotatedFromToken` pointing to the original token digest

## Manual Test 3 - Old Token Replay Outside Grace Revokes Family

1. Save the original refresh token from login before running Manual Test 2.
2. Wait longer than `REFRESH_TOKEN_ROTATION_GRACE_SECONDS`.
3. Send the original refresh token again:

```http
POST /api/v1/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "<original refresh token>"
}
```

Expected:

- status `401`
- response is generic unauthorized
- active replacement token in the same `tokenFamilyId` is now revoked
- active replacement token has `revocationReason: "replay"`
- server logs show refresh token replay detected without raw token content

## Manual Test 4 - Immediate Duplicate Inside Grace

1. Set `REFRESH_TOKEN_ROTATION_GRACE_SECONDS=10`.
2. Log in and save the refresh token.
3. Call refresh once with that token.
4. Immediately call refresh again with the same old token, within 10 seconds.

Expected:

- second request does not revoke the token family
- second request returns `200`
- second response includes a new access token
- second response does not include a replacement refresh token
- second response does not set a new refresh cookie
- MongoDB still has only one active token in the family

## Manual Test 5 - Logout-Revoked Token Is Not Grace Eligible

1. Log in.
2. Call logout using the current refresh token and access token.
3. Call refresh using the logged-out refresh token.

Expected:

- refresh returns `401`
- token remains revoked with `revocationReason: "logout"`
- token is not converted to `revocationReason: "replay"`
- no new refresh token is created

## Manual Test 6 - Unknown Refresh Token Does Not Revoke Other Sessions

1. Log in normally and keep the active session.
2. Generate or obtain a syntactically valid refresh JWT that is not stored in
   MongoDB.
3. Call refresh with the unknown token.

Expected:

- refresh returns `401`
- existing active session remains active
- unrelated refresh-token documents are not revoked

## Security Checklist

- [ ] Raw refresh JWTs are not stored in MongoDB.
- [ ] Raw refresh JWTs are not logged.
- [ ] Replay logs contain only safe metadata.
- [ ] Public replay response is generic unauthorized.
- [ ] Refresh cookie is httpOnly.
- [ ] Refresh cookie uses `secure` in production.
- [ ] Grace window is `0` to `60` seconds.
- [ ] Body-token clients update stored refresh token after each successful
  normal refresh.

## Known Follow-Up

- Concurrent refresh race is protected by transactional active-token update, but
  a dedicated concurrent integration test remains listed in `tasks.md`.
- Logout-all racing with refresh remains listed as a dedicated follow-up test in
  `tasks.md`.
