# Timezone Normalization Requirements

Status: Draft.

## Goal

Normalize timezone handling across account settings, sign in, sign up, OAuth, and backend profile updates.

The application should accept valid IANA timezone identifiers from browsers and APIs, normalize known aliases, and store one canonical timezone value per user.

## Users

- End users updating account settings.
- End users signing in, signing up, or using OAuth.
- Backend services that calculate analytics, reports, and transaction date ranges.
- Developers maintaining auth and profile validation.

## User Stories

- As a user, I can detect my browser timezone in Account Settings and save a valid timezone.
- As a user, I can sign in, sign up, or use OAuth without timezone aliases causing inconsistent profile values.
- As a user, my analytics, reports, and transaction date ranges use the same saved timezone consistently.
- As a developer, I can validate timezone input through shared helpers instead of scattered string checks.

## Acceptance Criteria

- Vietnam timezone is stored canonically as `Asia/Ho_Chi_Minh`.
- Incoming `Asia/Saigon` is accepted as an alias and normalized to `Asia/Ho_Chi_Minh`.
- Backend accepts any runtime-supported IANA timezone, not only frontend dropdown values.
- Backend rejects invalid timezone strings in API form flows with validation error `400`.
- Auth register, login, account update, and OAuth timezone paths use the same backend normalization rule where practical.
- Frontend browser timezone detection uses a shared helper.
- Account Settings can display a valid detected timezone even when it is not in the curated dropdown.
- Existing dropdown labels continue to work for manual selection.
- Existing `Asia/Saigon` user records can be normalized through an explicit manual script.
- Analytics, reports, and transactions continue to receive valid IANA timezone values.

## Edge Cases

- Browser returns an empty timezone.
- Browser returns `Asia/Saigon`.
- Browser returns `Asia/Ho_Chi_Minh`.
- Browser returns a valid IANA timezone not listed in `TIMEZONE_OPTIONS`.
- Backend receives an invalid string such as `Mars/Base`.
- Existing user profile already has `Asia/Saigon`.
- Runtime supports `Intl.DateTimeFormat` but not `Intl.supportedValuesOf`.

## Constraints

- Preserve current API shape: `timezone` remains an optional string.
- Do not add a timezone package unless native `Intl` is insufficient.
- Backend remains the trust boundary; frontend validation is only a convenience.
- Keep changes surgical and avoid unrelated date/report refactors.
- Do not run data normalization automatically during app startup.
- Preserve UTF-8 and existing Vietnamese text encoding when editing touched files.

## Success Criteria

- `Asia/Ho_Chi_Minh` is accepted and stored.
- `Asia/Saigon` is accepted and stored as `Asia/Ho_Chi_Minh`.
- Valid non-dropdown IANA timezones are accepted by backend.
- Invalid timezone strings return a validation error before persistence.
- Account Settings detect can select or display the normalized browser timezone.
- Sign In, Sign Up, and OAuth continue to send timezone safely.
- Manual normalization script reports matched and modified user counts.
- Relevant frontend type-check/lint and backend tests pass.
