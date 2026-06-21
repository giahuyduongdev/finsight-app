# Auth Registration And Login Hardening - Design

## Selected Approach

Keep the current OTP registration architecture and make surgical changes:

1. Canonicalize email in the shared Zod schema.
2. Make AES-256-GCM derive keys from `ENCRYPTION_SECRET`.
3. Encrypt the pending password with the existing AES-256-GCM utility.
4. Decrypt only after OTP verification succeeds.
5. Use one generic login authentication failure and a dummy bcrypt comparison
   for missing users.
6. Give login its own non-mutating password input schema.
7. Translate MongoDB email duplicate-key errors into the existing conflict
   response.
8. Add focused service, validator, and integration tests.

This preserves the API contract and existing project patterns without adding a
new persistence layer or auth abstraction.

## Encryption Key Separation

`encryption.util.ts` must use `Env.ENCRYPTION_SECRET` for PBKDF2 key derivation
in both `encrypt` and `decrypt`.

`JWT_SECRET` remains limited to JWT signing and verification. No fallback to
`JWT_SECRET` is implemented because the user confirmed there are no pending OTP
sessions requiring compatibility.

## Validation Design

### Email

Extend the existing shared `emailSchema` with lowercase canonicalization:

```ts
z.string().trim().toLowerCase().email().max(255)
```

Zod returns the transformed value, and the validation middleware replaces
`req.body` with parsed data. Services therefore receive canonical email values.

MongoDB's existing `lowercase: true`, `trim: true`, and unique index remain a
defense-in-depth boundary.

### Password

Keep `passwordSchema` for password creation.

Add `loginPasswordSchema` for authentication:

```ts
z.string().min(1).max(1024)
```

It intentionally does not call `.trim()`. Password whitespace is data and must
not be silently changed during authentication.

## Pending Registration Data

### Write path

`registerOTPService`:

1. Receives canonical email and validated registration password.
2. Checks pending state and existing user as today.
3. Calls `encrypt(password)`.
4. Stores `{ name, email, encryptedPassword }` in the pending Redis key.
5. Stores the hashed OTP and retry keys as today.
6. Sends the OTP email.

The plaintext password remains in process memory only for request processing
and encryption. It is never written to Redis or logs.

### Read path

`verifyRegisterOTPService`:

1. Validates OTP and retry limits as today.
2. Loads and parses pending JSON.
3. Validates that `name` and `encryptedPassword` are strings.
4. Calls `decrypt(encryptedPassword)`.
5. Creates the user with the decrypted password.
6. The user model hashes the password through its existing pre-save hook.
7. Cleans registration Redis keys after success.

Pending payload parsing/decryption should be contained in a small private
helper inside the auth service unless reuse becomes real.

### Invalid pending data

Malformed JSON, missing encrypted fields, old plaintext payloads, and
decryption failures are treated as an expired registration session.

The service deletes:

- registration OTP
- pending registration
- resend lock
- attempt counter

Cryptographic or payload details may be recorded only as a generic internal
warning without including the payload or password.

## Login Design

Define one internal invalid-credentials outcome:

```ts
new UnauthorizedException('Invalid email or password')
```

Login flow:

1. Query by canonical email and select `tokenVersion`.
2. If the user exists, compare the submitted password with the user's hash.
3. If the user does not exist, compare the submitted password with a fixed
   valid bcrypt dummy hash.
4. Reject with the same unauthorized error when the user is missing or the
   comparison fails.
5. Continue the existing successful login flow unchanged.

The dummy hash is a static valid bcrypt hash generated for a non-secret
placeholder password. It is not an application credential.

This does not provide strict constant-time network behavior, but removes the
large difference caused by skipping bcrypt and removes status/message
enumeration.

## Duplicate Email And Race Handling

The unique email index is authoritative.

Add a narrow helper or catch block that recognizes a MongoDB duplicate-key
error:

```ts
error instanceof MongoServerError && error.code === 11000
```

When user creation in registration verification fails this way, throw the
existing:

```ts
new ConflictException(
  'Email already exists',
  ErrorCodeEnum.AUTH_EMAIL_ALREADY_EXISTS
)
```

Do not translate unrelated MongoDB failures.

The transaction rolls back the report-setting creation if user creation fails.
Redis cleanup after a duplicate conflict is idempotent and removes stale
registration state because the canonical email is already registered.

## Components Changed

- `backend/src/validators/auth.validator.ts`
  - lowercase email transformation
  - separate login password schema
- `backend/src/services/auth.service.ts`
  - encrypt/decrypt pending password
  - invalid pending-data cleanup
  - generic login failure with dummy bcrypt work
  - duplicate-key translation
- `backend/src/utils/encryption.util.ts`
  - derive encryption keys from `ENCRYPTION_SECRET`
- `backend/src/__tests__/unit/auth.validator.test.ts`
  - validator transformation and password behavior
- `backend/src/__tests__/unit/auth.service.test.ts`
  - focused service security and error behavior
- `backend/src/__tests__/integration/auth-registration-race.test.ts`
  - unique-index/race behavior when practical with the existing in-memory
    replica-set test pattern

Exact test filenames may follow an existing nearby convention while preserving
the listed coverage.

## Error Handling

| Scenario | Public outcome |
| --- | --- |
| Email missing during login | `401 Invalid email or password` |
| Password incorrect | `401 Invalid email or password` |
| Email already registered before OTP request | Existing `409` |
| Email registered during OTP window | Existing duplicate-email `409` |
| Pending payload missing or unusable | Existing registration-session-expired error |
| Non-duplicate MongoDB failure | Existing centralized error handling |
| Redis or mail failure | Existing behavior |

No response includes ciphertext, password material, MongoDB index names, or
whether the login email exists.

## Test Strategy

### Validator tests

- email is trimmed and lowercased
- registration password policy remains enforced
- login password does not require registration complexity
- login password preserves whitespace
- empty and oversized login passwords are rejected

### Service tests

- pending registration stores `encryptedPassword`, not plaintext `password`
- encryption receives the submitted password
- verification decrypts before user creation
- malformed, legacy, and corrupted pending payloads fail closed and clean up
- nonexistent user and wrong password throw identical unauthorized errors
- nonexistent user executes dummy bcrypt comparison
- successful login behavior remains unchanged
- duplicate-key code `11000` becomes the existing conflict
- non-duplicate errors are not swallowed

### Integration tests

- mixed-case registration and login address the same user
- two verification attempts cannot persist duplicate users
- one concurrent loser receives `409`
- stored MongoDB password is bcrypt-hashed

## Security Review

Verify before completion:

- no plaintext pending password in Redis
- no password/ciphertext logging
- no user-existence distinction in login status, message, or error code
- dummy comparison uses a valid bcrypt hash
- email canonicalization occurs before Redis key construction
- duplicate handling is limited to code `11000`
- invalid ciphertext fails closed
- secrets remain environment-backed
- JWT and data-encryption secrets are not reused

## Alternatives Considered

### Bcrypt pending password before Redis

This avoids reversible storage but requires changing the user model or creation
path to prevent double hashing. Rejected as a broader persistence change.

### Client resubmits password during OTP verification

This removes password storage from Redis but changes the API and user
experience. Rejected for compatibility.

### Generic registration response

This would also reduce email enumeration through registration, but changes the
current product behavior for existing-account guidance. Out of scope for this
hardening pass.

## Rollout

No database migration is required.

Deploying the new code invalidates pending registrations created by the old
plaintext format. Their TTL is at most the current pending-registration TTL,
and affected users restart registration.

It also invalidates short-lived OTP ciphertext previously encrypted with
`JWT_SECRET`. No compatibility fallback is required.
