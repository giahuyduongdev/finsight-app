# User Privacy Hardening Tasks

## 1. Logging Email Masking

- [x] Add an email masking helper in the existing backend utility layer.
- [x] Update `redactSensitiveFields()` to mask fields named `email`.
- [x] Keep current full redaction behavior for passwords, tokens, authorization values, API keys, and secrets.
- [x] Add unit tests for email masking and existing sensitive field redaction.

## 2. Context-Specific User DTOs

- [x] Add `toCurrentUserDTO()`, `toAuthUserDTO()`, and `toPublicUserDTO()` in the user DTO module.
- [x] Decide during implementation whether `sanitizeUser()` remains as a temporary alias or is replaced at all call sites.
- [x] Update `/users/me` controller to use `toCurrentUserDTO()`.
- [x] Update auth controllers to use `toAuthUserDTO()`.
- [x] Add DTO unit tests for email presence and absence by context.

## 3. Verification

- [x] Run backend unit tests related to auth, user, logging, and redaction.
- [x] Run backend lint/typecheck if available.
- [x] Manually inspect response shapes for login and `/users/me`.
- [x] Confirm no public DTO includes `email`.

## 4. Documentation

- [x] Update any API docs if response DTO names or examples are maintained manually.
- [x] Note that database email encryption remains out of scope.
