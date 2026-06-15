# API Docs OpenAPI Tasks

Status: Draft.

## Implementation Checklist

- [x] Add `backend/docs/openapi.yaml`.
- [x] Define API metadata, local server URL, tags, and reusable components.
- [x] Document shared success response envelope.
- [x] Document shared error response envelope, including validation details.
- [x] Document auth security schemes for bearer access tokens and refresh cookie flows.
- [x] Document initial auth endpoints.
- [x] Add Swagger UI and OpenAPI validation dependencies.
- [x] Wire development-only Swagger UI route at `/api/docs`.
- [x] Serve raw OpenAPI contract at `/api/docs/openapi.yaml`.
- [x] Add a backend script to validate the OpenAPI contract.
- [x] Add API docs README or backend README section explaining manual Postman import.
- [x] Document that automatic Postman sync requires optional Postman API Builder or repository integration setup.
- [x] Add local verification notes for Swagger UI and Postman.

## Validation Checklist

- [x] OpenAPI contract passes syntax validation.
- [x] Backend starts successfully in development with Swagger enabled.
- [x] `GET /api/docs` opens Swagger UI locally.
- [x] `GET /api/docs/openapi.yaml` returns the committed contract.
- [ ] Postman can manually import the contract.
- [x] Docs clarify that Postman does not automatically update from Express route changes.
- [x] Documented auth password reset flow includes `resetToken` from OTP verification.
- [ ] Login and refresh-token response schemas match actual backend envelope.
- [x] Error response schema matches actual `errorHandler` output.
- [x] Swagger UI is not enabled in production by default.
- [x] Backend lint and type-check pass.

## Suggested Execution Order

1. Add OpenAPI contract skeleton and shared schemas.
2. Document auth endpoints.
3. Add OpenAPI validation script.
4. Add Swagger UI dev route.
5. Add developer documentation for manual Postman import and optional future sync.
6. Validate contract, Swagger UI, and backend checks.
7. Security review for docs exposure and sensitive examples.

## Out Of Scope For First Pass

- New Swagger UI or OpenAPI validator dependencies in the first pass.
- Full auto-generation from Express routes.
- Full API coverage for transactions, reports, analytics, and users.
- Publishing public hosted API docs.
- CI OpenAPI diff enforcement.
- Generating typed frontend clients from OpenAPI.
