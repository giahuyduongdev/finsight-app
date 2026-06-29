# User Privacy Hardening Design

## Summary

This change reduces accidental email exposure without changing how users log in or how email is stored. It adds email-aware masking to the existing redaction utility and replaces the single generic user response mapper with context-specific DTO mappers.

## Current Behavior

`backend/src/dtos/user.dto.ts` exposes `email` through `sanitizeUser()`. That mapper is used for current-user and auth responses, which is valid, but the generic name makes it easy to reuse in future public contexts.

`backend/src/utils/redact.util.ts` redacts passwords, tokens, authorization values, API keys, and secrets. It does not treat `email` specially. Sentry has its own broader sanitization pattern that already includes email.

## Proposed Design

### Email Masking

Add a small utility function for masking email strings:

```txt
first-character + "***" + domain
```

Examples:

```txt
a@example.com -> a***@example.com
gia@example.com -> g***@example.com
invalid-value -> invalid-value
```

The shared redaction utility should apply this function when a field key is exactly `email` case-insensitively. It should continue to redact secrets fully.

This keeps the logging output useful while preventing full PII exposure.

### DTO Mappers

Replace the implicit "one sanitized user fits all responses" pattern with explicit mappers:

- `toCurrentUserDTO(user)`: includes `id`, `name`, `email`, `profilePicture`, `timezone`, `preferredCurrency`, and `role`.
- `toAuthUserDTO(user)`: same shape as current user for now, because the frontend session state uses email.
- `toPublicUserDTO(user)`: includes only fields safe for other users or embedded views, such as `id`, `name`, and `profilePicture`.

`sanitizeUser()` can remain temporarily as an alias for `toCurrentUserDTO()` to reduce churn, but new code should use the context-specific names. If the implementation touches all current call sites cleanly, `sanitizeUser()` can be removed.

### API Mapping Rules

Use `toCurrentUserDTO()` for:

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`

Use `toAuthUserDTO()` for:

- login success
- register OTP verification success
- OAuth callback/session initialization response

Use `toPublicUserDTO()` for:

- future user references inside shared resources
- future member/user lists visible to other users
- any endpoint where the requester is not viewing their own account record

### Data Flow

```txt
Mongo UserDocument
  -> service returns user without password/tokenVersion
  -> controller selects DTO mapper by endpoint context
  -> ResponseFormatter sends explicit response shape
```

For logs:

```txt
logger metadata/body
  -> redactSensitiveFields()
  -> full secrets become [REDACTED]
  -> email fields become masked email
  -> winston transport writes sanitized log
```

## Error Handling

Invalid email-like strings in log metadata should be left unchanged rather than throwing. Redaction must never break logging or request error handling.

DTO mappers should tolerate either Mongoose documents or plain objects, matching the existing `sanitizeUser()` behavior.

## Security Considerations

This does not protect email if the MongoDB database itself is leaked, because `users.email` remains plaintext. It reduces exposure through API responses and logs.

The implementation should avoid broad regex replacement over arbitrary log strings. Structured field-based masking is safer and less likely to corrupt unrelated messages.

## Testing Strategy

Add focused unit tests:

- `maskEmail()` handles normal, short-local-part, uppercase, and invalid inputs.
- `redactSensitiveFields()` masks `email` but still fully redacts `password`, `token`, and `refreshToken`.
- DTO mapper tests verify email presence or absence per mapper.
- Existing controller/service tests should be updated only where names or DTO imports change.

## Rollout

No database migration is required.

The implementation can ship in one backend change. Frontend changes should not be needed if `CurrentUserDTO` and `AuthUserDTO` preserve the current shape.
