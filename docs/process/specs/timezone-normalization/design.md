# Timezone Normalization Design

Status: Draft.

## Summary

Use shared frontend and backend timezone helpers to normalize browser/API timezone values before they are displayed, submitted, validated, or persisted.

`Asia/Ho_Chi_Minh` is the canonical Vietnam timezone. `Asia/Saigon` remains accepted as an input alias for compatibility, but new saved data should use `Asia/Ho_Chi_Minh`.

## Current State

- `TIMEZONE_OPTIONS` contains `Asia/Saigon`.
- `TIMEZONE_ALIAS_MAPPING` maps several nearby zones, including `Asia/Ho_Chi_Minh`, to `Asia/Saigon`.
- Account Settings has partial local detect logic in `account-form.tsx`.
- Sign In has local timezone mapping logic.
- Sign Up sends the raw browser timezone.
- Backend `auth.validator.ts` and `user.validator.ts` accept timezone as `z.string().optional()`.
- OAuth callback validates timezone inline and falls back to `UTC`.

## Frontend Design

Create `client/src/lib/timezone.ts`.

Exports:

```ts
isValidTimeZone(value: string): boolean
normalizeTimeZone(value?: string): string | undefined
getBrowserTimeZone(): string | undefined
```

Rules:

- Trim input before validation.
- Return `undefined` for missing, empty, or invalid values.
- Normalize aliases before returning.
- Alias policy:
  - `Asia/Saigon` -> `Asia/Ho_Chi_Minh`
  - `Asia/Ho_Chi_Minh` -> `Asia/Ho_Chi_Minh`
- Validate with `Intl.DateTimeFormat(undefined, { timeZone: value })` inside `try/catch`.

Consumers:

- Account Settings detect button.
- Account Settings default/display value.
- Sign In default timezone and OAuth redirect timezone.
- Sign Up default timezone and OAuth redirect timezone.

`TIMEZONE_OPTIONS` should change the Vietnam option from `Asia/Saigon` to `Asia/Ho_Chi_Minh`.

When Account Settings receives a valid selected timezone that is not in `TIMEZONE_OPTIONS`, it should add a temporary select option using the timezone string as both value and label.

## Backend Design

Create `backend/src/utils/timezone.util.ts`.

Exports:

```ts
isValidTimezone(value: string): boolean
normalizeTimezone(value?: string): string | undefined
```

Rules:

- Trim input before validation.
- Return `undefined` for missing or empty values.
- Normalize aliases before validation.
- Validate with `Intl.DateTimeFormat(undefined, { timeZone: normalized })`.
- Return `undefined` for invalid values in the helper.
- Let validators decide whether invalid input becomes a validation error.

Use the helper in:

- `backend/src/validators/user.validator.ts`
- `backend/src/validators/auth.validator.ts`
- OAuth callback timezone handling where practical.

Validator behavior:

- Missing timezone remains allowed.
- Valid timezone is transformed to normalized timezone.
- Invalid timezone fails validation with a clear validation message.

Service behavior should not silently coerce invalid submitted timezone values to `UTC`. `UTC` remains only a default when no timezone is supplied.

## Migration Design

Add `backend/src/scripts/normalize-timezones.ts`.

Behavior:

- Connect using existing backend database configuration.
- Update user records where `timezone` is exactly `Asia/Saigon`.
- Set `timezone` to `Asia/Ho_Chi_Minh`.
- Log matched and modified counts.
- Exit non-zero on connection or update failure.
- Do not run automatically during app startup.

Expose through a backend npm script:

```json
"normalize:timezones": "ts-node-dev --files src/scripts/normalize-timezones.ts"
```

The exact runner can be adjusted to match existing backend script conventions.

## Data Flow

See: `data-flow.mmd`.

## Error Handling

- Frontend helper returns `undefined` for unsupported browser values and avoids submitting invalid detected values.
- Backend validators reject invalid submitted timezone strings with normal validation error handling.
- OAuth callback normalizes valid timezone values and falls back to `UTC` only when the OAuth state is missing or invalid.
- Migration script logs failure details and exits non-zero.

## Testing

Backend tests:

- `normalizeTimezone(undefined)` returns `undefined`.
- `normalizeTimezone('Asia/Ho_Chi_Minh')` returns `Asia/Ho_Chi_Minh`.
- `normalizeTimezone('Asia/Saigon')` returns `Asia/Ho_Chi_Minh`.
- A valid non-dropdown timezone is accepted.
- Invalid timezone values fail validator parsing.
- Register, login, and update-user schemas transform aliases consistently.

Frontend verification:

- Account Settings detect uses `getBrowserTimeZone`.
- Account Settings can render a valid non-dropdown timezone.
- Sign In and Sign Up use the shared helper.
- Vietnam dropdown value is `Asia/Ho_Chi_Minh`.

Migration verification:

- Script only updates users with `timezone: 'Asia/Saigon'`.
- Script reports matched and modified counts.

## Security Review Notes

- Timezone is user-controlled input and must be validated server-side.
- Validation should happen before persistence.
- Error messages should not expose stack traces or internals.
- Migration script should update only the intended `timezone` field.
