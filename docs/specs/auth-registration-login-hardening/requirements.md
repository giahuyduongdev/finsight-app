# Auth Registration And Login Hardening - Requirements

## Status

Approved for implementation.

## Goal

Harden email/password registration and login so that:

- pending registration passwords are not stored as plaintext in Redis
- login does not disclose whether an email exists
- email identity is consistent across validation, Redis, and MongoDB
- concurrent registration verification returns a stable conflict response
- login validation remains compatible with existing accounts
- automated tests cover the security and concurrency-sensitive behavior

## Scope

This feature applies to:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/register/verify-otp`
- `POST /api/v1/auth/register/resend`
- `POST /api/v1/auth/login`
- shared email and login-password validation used by those routes

It does not change forgot-password, password-change, email-change, OAuth, token
issuance, or session revocation behavior except where shared email
canonicalization applies automatically through the existing validator.

## Functional Requirements

### R1. Canonicalize email before business logic

Every email accepted by the auth validators must be:

- trimmed
- validated as an email address
- converted to lowercase
- limited to 255 characters

The canonical email must be the value passed to Redis key builders and MongoDB
queries. Inputs that differ only by case must address the same account and the
same pending registration.

### R2. Encrypt pending registration passwords

`registerOTPService` must encrypt the validated password before storing pending
registration data in Redis.

The Redis payload may contain:

```ts
{
  name: string;
  email: string;
  encryptedPassword: string;
}
```

It must not contain a plaintext `password` property or the plaintext password
value.

The implementation must use the existing authenticated AES-256-GCM
`encrypt`/`decrypt` utility. After successful OTP validation, the service
decrypts the pending password and passes the plaintext only to the existing
user model, which bcrypt-hashes it before MongoDB persistence.

The encryption utility must derive its key from `ENCRYPTION_SECRET`, not
`JWT_SECRET`. JWT signing and sensitive-data encryption must use separate
secrets.

### R3. Fail closed on invalid pending ciphertext

If pending registration data is missing, malformed, from the old plaintext
format, or cannot be decrypted:

- do not create a user
- delete the unusable pending registration and OTP state
- return the existing generic registration-session-expired outcome
- do not expose cryptographic details

Existing plaintext pending registrations are intentionally invalidated at
rollout. Users restart registration.

Existing ciphertext derived from `JWT_SECRET` is also intentionally
invalidated. No pending OTP session requires migration or fallback at rollout.

### R4. Return one login failure outcome

The following login cases must return the same public result:

- canonical email does not exist
- password is incorrect

Required response:

- HTTP status: `401`
- message: `Invalid email or password`
- same public error code

The login path must perform a bcrypt comparison against a fixed dummy hash when
the user does not exist, reducing the observable timing difference between the
two failure cases.

No raw password, password hash, dummy hash, or user-existence detail may be
logged.

### R5. Separate login password validation

Registration continues using the current password-creation policy.

Login uses a separate schema that:

- requires a non-empty string
- does not trim or mutate the password
- enforces a reasonable maximum input length
- does not re-apply uppercase, numeric, or special-character creation rules

This preserves compatibility with existing users and ensures authentication
compares the exact submitted password.

### R6. Preserve the unique email database constraint

The MongoDB unique email index remains the final concurrency boundary.

Pre-checks may provide an early conflict response, but correctness must not
depend on them.

If user creation fails with MongoDB duplicate-key code `11000` for email,
registration verification must return:

- HTTP status: `409`
- error code: `AUTH_EMAIL_ALREADY_EXISTS`
- existing user-facing duplicate-email message

Other database errors must propagate through the existing error handling.

### R7. Handle concurrent OTP verification predictably

When two valid OTP verification requests race for the same canonical email:

- at most one user is persisted
- one request may succeed
- the other returns the duplicate-email `409`, not `500`
- Redis cleanup remains idempotent

### R8. Preserve current successful API contracts

Successful registration request, OTP verification, resend, and login response
shapes remain unchanged.

No new client field is required.

## Acceptance Criteria

- Registering `User@Example.com` creates Redis keys and MongoDB queries for
  `user@example.com`.
- A second request using another casing observes the same pending-registration
  state.
- Redis pending data does not contain the plaintext password.
- Valid OTP verification decrypts the password and creates a user whose stored
  password is bcrypt-hashed.
- Old plaintext or corrupted pending data cannot create a user and is cleaned
  up.
- Missing-email and wrong-password login attempts both return the same `401`
  response.
- Missing-email login performs the dummy bcrypt comparison.
- Login accepts the exact password without applying registration complexity
  rules.
- Duplicate-key code `11000` during OTP verification returns the expected
  `409`.
- Concurrent verification cannot create duplicate users.
- Targeted unit and integration tests pass.
- Backend lint, typecheck, and build pass.

## Edge Cases

- Email contains leading or trailing whitespace.
- Email contains uppercase characters.
- Password contains leading or trailing spaces.
- Password is valid for an existing account but no longer satisfies the
  current registration policy.
- Redis pending payload is malformed JSON.
- Redis pending payload uses the pre-hardening plaintext shape.
- Ciphertext authentication fails.
- Email becomes registered after OTP issuance but before verification.
- Two OTP verification requests race.
- MongoDB returns a non-duplicate error.
- Email unique index is absent in a misconfigured database.

## Out Of Scope

- Hiding duplicate-email status from the registration endpoint.
- Changing OTP lifetime or retry limits.
- Replacing Redis pending registration storage.
- Changing password hashing parameters.
- Adding MFA or CAPTCHA.
- Refactoring the full auth service.
- Changing OAuth account linking.
- Migrating or recovering existing plaintext pending registration records.
- Migrating pending ciphertext derived from `JWT_SECRET`.

## Success Criteria

- Login no longer has a direct status/message account-enumeration oracle.
- Pending registration passwords are protected by authenticated encryption.
- Email casing cannot split account identity across Redis and MongoDB.
- Registration races produce stable client errors instead of internal errors.
- The implementation is covered by focused regression tests.
- AES key derivation uses `ENCRYPTION_SECRET` exclusively.
