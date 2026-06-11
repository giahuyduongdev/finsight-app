# Timezone Normalization Tasks

Status: Draft.

## Implementation Checklist

- [x] Remove or replace the partial Account Settings local timezone mapping.
- [x] Add frontend timezone helper in `client/src/lib/timezone.ts`.
- [x] Change Vietnam dropdown option from `Asia/Saigon` to `Asia/Ho_Chi_Minh`.
- [x] Update Account Settings detect/default/display behavior to use the shared frontend helper.
- [x] Allow Account Settings to display a valid selected timezone outside `TIMEZONE_OPTIONS`.
- [x] Update Sign In timezone detection and OAuth redirect timezone to use the shared frontend helper.
- [x] Update Sign Up timezone detection and OAuth redirect timezone to use the shared frontend helper.
- [x] Normalize persisted auth timezone values during Redux Persist rehydration.
- [x] Add backend timezone helper in `backend/src/utils/timezone.util.ts`.
- [x] Update `backend/src/validators/user.validator.ts` to normalize valid timezone values and reject invalid values.
- [x] Update `backend/src/validators/auth.validator.ts` to normalize valid timezone values and reject invalid values.
- [x] Update OAuth callback timezone handling to use backend normalization where practical.
- [x] Add manual backend migration script for `Asia/Saigon` -> `Asia/Ho_Chi_Minh`.
- [x] Add backend npm script to run the migration manually.
- [x] Add or update backend tests for valid, alias, non-dropdown, missing, and invalid timezone values.

## Validation Checklist

- [x] `Asia/Ho_Chi_Minh` is accepted and stored.
- [x] `Asia/Saigon` is accepted and normalized to `Asia/Ho_Chi_Minh`.
- [x] Valid IANA timezone outside frontend dropdown is accepted by backend.
- [x] Invalid timezone strings return validation error `400` in API form flows.
- [x] Account Settings detect updates the selected timezone to the canonical timezone.
- [x] Account Settings can display a valid non-dropdown timezone.
- [x] Sign In and Sign Up still include timezone correctly.
- [x] Existing local persisted auth timezone aliases are normalized on rehydration.
- [x] OAuth callback still handles timezone safely.
- [x] Migration script reports matched and modified user counts.
- [x] Analytics and reports continue to receive valid timezone values.
- [x] Client type-check and lint pass.
- [x] Backend relevant tests pass.

## Suggested Execution Order

1. Backend helper and validator tests.
2. Backend validator integration.
3. OAuth normalization.
4. Frontend helper.
5. Frontend consumers.
6. Migration script and npm script.
7. Final verification and security review.
