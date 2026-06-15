# API Docs OpenAPI Design

Status: Draft.

## Summary

Use a committed OpenAPI 3.x contract as the API documentation source of truth. Serve that contract through Swagger UI during local development and import the same contract into Postman for manual API testing.

The first implementation should document API infrastructure and auth endpoints only. Other endpoint groups can be added in later slices once the docs workflow is proven.

## Current State

- Express routes live under `backend/src/routes`.
- v1 routes are mounted under `/api/v1`.
- Validators live under `backend/src/validators`.
- Controllers return a shared success envelope through `ResponseFormatter.success`.
- Error handling returns a shared error envelope from `errorHandler`.
- `appConfig.features.swagger` exists, but no Swagger UI or OpenAPI route is currently wired.
- No Postman collection or OpenAPI contract was found in the repository.

## Contract Location

Add:

```text
backend/docs/openapi.yaml
```

The contract should use OpenAPI 3.x and document:

- API title, version, and local server URL.
- Shared schemas for success and error envelopes.
- Shared auth security schemes.
- Auth endpoint paths under `/api/v1/auth`.

This location keeps backend API docs near the backend implementation while still making the file easy for Postman import and CI validation.

## Swagger UI

Add development-only Swagger UI support in the backend using `swagger-ui-express`. The backend should parse the committed OpenAPI file with `yaml` and serve the Swagger UI from local package assets.

Expected local paths:

```text
GET /api/docs
GET /api/docs/openapi.yaml
```

Rules:

- Enable only when `appConfig.features.swagger` is true.
- Serve the static OpenAPI file without mutating it at runtime.
- Do not expose Swagger UI in production unless a future decision explicitly allows it.

## Postman Workflow

Postman should import from:

```text
backend/docs/openapi.yaml
```

First-pass use:

- Import the OpenAPI file into Postman manually.
- Configure environment variables such as `baseUrl`, `accessToken`, and test credentials in Postman.
- Preserve cookies for refresh-token flows.
- Re-import when `openapi.yaml` changes.

Postman is a consumer of the contract, not the source of truth.

Automatic Postman sync is optional future work. It can be configured later through Postman API Builder or repository integration, but Express route changes will not update Postman by themselves. The OpenAPI file remains the artifact that Postman reads.

## Initial Auth Coverage

Document these endpoints first:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/register/verify-otp`
- `POST /api/v1/auth/register/resend`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/verify-otp`
- `POST /api/v1/auth/password/resend`
- `POST /api/v1/auth/password/reset`
- `GET /api/v1/auth/oauth/{provider}`
- `GET /api/v1/auth/callback`

OAuth redirect endpoints should be documented as redirect-oriented flows, not normal JSON APIs.

## Schemas

Create reusable OpenAPI components for:

- `SuccessResponse`
- `MessageResponse`
- `ErrorResponse`
- `ValidationErrorDetail`
- `RegisterRequest`
- `LoginRequest`
- `RefreshTokenRequest`
- `EmailRequest`
- `OtpRequest`
- `ResetPasswordRequest`
- `AuthCredentials`
- `User`
- `ReportSettingSummary`

Password constraints should match `backend/src/validators/auth.validator.ts`.

## Validation

Add a backend script to validate the contract syntax and internal `$ref` values.

Script:

```json
"docs:api:validate": "redocly lint docs/openapi.yaml"
```

Use Redocly for standards-aware OpenAPI validation in local verification and CI.

## Developer Workflow

When changing an API route, developers should update:

- Express route/controller/validator.
- Matching OpenAPI path or schema.
- Manual Postman import if they rely on a local collection.
- Tests if request or response behavior changed.

Add this checklist to backend docs or API docs README.

## Security Notes

- Do not publish secrets, example JWTs, reset tokens, OTPs, or real emails in examples.
- Use placeholder examples only.
- Document auth requirements without weakening the actual middleware.
- Keep Swagger UI disabled in production by default.
- Redact sensitive fields in examples where needed.

## Tradeoffs

- Manual OpenAPI is reviewable and simple, but developers must keep it updated.
- Auto-generating from Express/Zod may reduce drift later, but it requires a larger convention change.
- Starting with auth endpoints limits scope while covering the most important flows.

## Future Work

- Add transactions, analytics, reports, and user endpoints.
- Add multipart documentation for upload/import endpoints.
- Add Postman API Builder or repository-based sync from `backend/docs/openapi.yaml`.
- Add OpenAPI diff checks in CI.
- Consider generating schemas from Zod once endpoint documentation stabilizes.
