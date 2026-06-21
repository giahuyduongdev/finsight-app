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

- [ ] Add a failing test proving ciphertext depends on `ENCRYPTION_SECRET`.
- [ ] Change AES key derivation from `JWT_SECRET` to `ENCRYPTION_SECRET`.
- [ ] Verify encrypt/decrypt round trips with the configured encryption secret.
- [ ] Confirm JWT behavior is unaffected.

## TDD: Validation

- [ ] Add failing tests for lowercase/trim email canonicalization.
- [ ] Add failing tests proving login password validation is separate.
- [ ] Add failing tests proving login password whitespace is preserved.
- [ ] Implement validator changes.
- [ ] Run targeted validator tests.

## TDD: Pending Registration Encryption

- [ ] Add failing tests for encrypted pending registration payloads.
- [ ] Add failing tests for decrypting during successful OTP verification.
- [ ] Add failing tests for malformed, legacy, and corrupted pending data.
- [ ] Implement encryption on registration request.
- [ ] Implement validated decryption and fail-closed cleanup on verification.
- [ ] Run targeted auth service tests.

## TDD: Login Enumeration Resistance

- [ ] Add failing tests for identical missing-user and wrong-password errors.
- [ ] Add failing test for dummy bcrypt comparison on missing user.
- [ ] Implement generic unauthorized handling.
- [ ] Preserve the successful login path.
- [ ] Run targeted auth service and controller tests.

## TDD: Duplicate Email Race

- [ ] Add failing test for duplicate-key code `11000`.
- [ ] Add failing test that unrelated database errors propagate.
- [ ] Implement narrow duplicate-key translation.
- [ ] Add integration coverage for concurrent OTP verification.
- [ ] Verify at most one user is persisted and the loser receives `409`.

## Verification

- [ ] Run all targeted auth tests.
- [ ] Run the full backend test suite.
- [ ] Run backend lint.
- [ ] Run backend typecheck.
- [ ] Run backend build.
- [ ] Run `git diff --check`.
- [ ] Confirm successful API response shapes are unchanged.
- [ ] Confirm unrelated Redis Compose work remains untouched.

## Security Review

- [ ] Inspect Redis pending payload and confirm no plaintext password.
- [ ] Confirm login failures do not disclose user existence.
- [ ] Confirm missing-user login performs bcrypt work.
- [ ] Confirm invalid ciphertext fails closed.
- [ ] Confirm logs do not include password or ciphertext material.
- [ ] Confirm duplicate-key handling does not hide unrelated errors.
- [ ] Confirm no new hardcoded application secret was introduced.
- [ ] Confirm AES key derivation does not use `JWT_SECRET`.

## Completion

- [ ] Update spec status after implementation.
- [ ] Record verification results.
- [ ] Use the development-branch completion workflow if a branch is created.
