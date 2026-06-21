# Auth Registration And Login Hardening - Tasks

## Decision Gate

- [x] Keep the existing OTP registration API.
- [x] Use the existing AES-256-GCM utility for pending passwords.
- [x] Canonicalize email to lowercase in the validator.
- [x] Use one generic login failure.
- [x] Perform dummy bcrypt work for a missing login user.
- [x] Preserve registration's existing duplicate-email response.
- [x] Treat legacy plaintext pending records as expired.
- [x] Use `ENCRYPTION_SECRET` exclusively with no `JWT_SECRET` fallback.

## TDD: Encryption Key Separation

- [x] Add a failing test proving ciphertext depends on `ENCRYPTION_SECRET`.
- [x] Change AES key derivation from `JWT_SECRET` to `ENCRYPTION_SECRET`.
- [x] Verify encrypt/decrypt round trips with the configured encryption secret.
- [x] Confirm JWT behavior is unaffected.

## TDD: Validation

- [x] Add failing tests for lowercase/trim email canonicalization.
- [x] Add failing tests proving login password validation is separate.
- [x] Add failing tests proving login password whitespace is preserved.
- [x] Implement validator changes.
- [x] Run targeted validator tests.

## TDD: Pending Registration Encryption

- [x] Add failing tests for encrypted pending registration payloads.
- [x] Add failing tests for decrypting during successful OTP verification.
- [x] Add failing tests for malformed, legacy, and corrupted pending data.
- [x] Implement encryption on registration request.
- [x] Implement validated decryption and fail-closed cleanup on verification.
- [x] Run targeted auth service tests.

## TDD: Login Enumeration Resistance

- [x] Add failing tests for identical missing-user and wrong-password errors.
- [x] Add failing test for dummy bcrypt comparison on missing user.
- [x] Implement generic unauthorized handling.
- [x] Preserve the successful login path.
- [x] Run targeted auth service and controller tests.

## TDD: Duplicate Email Race

- [x] Add failing test for duplicate-key code `11000`.
- [x] Add failing test that unrelated database errors propagate.
- [x] Implement narrow duplicate-key translation.
- [x] Add integration coverage for concurrent OTP verification.
- [x] Verify at most one user is persisted and the loser receives `409`.

## Verification

- [x] Run all targeted auth tests.
- [x] Run the full backend test suite.
- [x] Run backend lint.
- [x] Run backend typecheck.
- [x] Run backend build.
- [x] Run `git diff --check`.
- [x] Confirm successful API response shapes are unchanged.
- [x] Confirm unrelated Redis Compose work remains untouched.

## Security Review

- [x] Inspect Redis pending payload and confirm no plaintext password.
- [x] Confirm login failures do not disclose user existence.
- [x] Confirm missing-user login performs bcrypt work.
- [x] Confirm invalid ciphertext fails closed.
- [x] Confirm logs do not include password or ciphertext material.
- [x] Confirm duplicate-key handling does not hide unrelated errors.
- [x] Confirm no new hardcoded application secret was introduced.
- [x] Confirm AES key derivation does not use `JWT_SECRET`.

## Completion

- [x] Update spec status after implementation.
- [x] Record verification results.
- [ ] Use the development-branch completion workflow if a branch is created.

## Verification Results

- Full backend test suite: 263 passed, 3 skipped.
- Targeted encryption tests: 2 passed.
- Backend lint: passed.
- Backend typecheck: passed.
- Backend build: passed.
- `git diff --check`: passed.
