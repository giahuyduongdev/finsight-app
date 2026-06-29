# User Privacy Hardening Requirements

## Context

The application currently stores normalized plaintext user email addresses and returns email in the shared user response mapper. Passwords and tokens are already protected more strictly, but email is personally identifiable information and should not be exposed outside contexts that genuinely need it.

This spec covers two improvements:

- Mask email values in application logs.
- Split user response DTOs by exposure context.

Database email encryption and MongoDB deployment changes are intentionally out of scope.

## Goals

- Prevent accidental full-email exposure in application logs.
- Make API response intent explicit by using different user DTOs for current-user, auth, and public user data.
- Preserve existing user-facing behavior where email is required, especially account settings and auth session state.
- Keep the change surgical and compatible with the existing Express/Mongoose DTO pattern.

## Non-Goals

- Do not hash or encrypt the stored `users.email` field.
- Do not change authentication identifiers or login behavior.
- Do not remove email from `/api/v1/users/me`.
- Do not redesign authorization, RBAC, or MongoDB access control.
- Do not introduce a new serialization framework.

## Requirements

### R1. Email Masking in Logs

Application logging must avoid writing full email addresses when structured metadata or request bodies include an email field.

Masking format:

```txt
giahuyduong2909@gmail.com -> g***@gmail.com
```

The implementation should preserve enough information for debugging while hiding most of the local part.

### R2. Logging Redaction Compatibility

Existing redaction for passwords, tokens, authorization headers, API keys, and secrets must continue to work.

Email masking must not replace token/password redaction behavior.

### R3. User DTO Separation

User response mapping must be split by context:

- `CurrentUserDTO`: for the authenticated user's own profile; includes email.
- `AuthUserDTO`: for auth responses that initialize session/client state; includes email if the frontend needs it.
- `PublicUserDTO`: for user data embedded in resources or visible to other users; excludes email.

The old all-purpose `sanitizeUser` behavior should either be renamed to a context-specific mapper or kept only as a compatibility wrapper during migration.

### R4. Preserve Current Required Email Responses

The following flows must continue returning email unless a later requirement says otherwise:

- `GET /api/v1/users/me`
- login response
- register OTP verification response
- OAuth callback/session initialization response, if currently returned to the frontend

### R5. Avoid Future Accidental Exposure

New or existing endpoints that expose user objects outside "current user" or "auth session" contexts should use `PublicUserDTO` by default.

### R6. Tests

Add or update focused tests for:

- Email masking utility behavior.
- Logger redaction/masking behavior for objects containing `email`.
- User DTO mappers and the absence/presence of email by context.
- Existing `/users/me` and login response behavior where practical.

## Acceptance Criteria

- Full email addresses are not emitted by the shared application redaction/masking path.
- Password/token redaction still passes existing tests.
- Public user DTOs do not contain `email`.
- Current-user and auth DTOs contain `email`.
- Existing auth and user unit tests pass.
