# API Docs OpenAPI Requirements

Status: Draft.

## Goal

Create a reliable API documentation workflow so backend routes, request/response contracts, Swagger UI, and Postman collections can stay aligned.

The project should use an OpenAPI contract as the source of truth for API consumers. Postman should import from that contract instead of being maintained as an unrelated manual collection. Automatic Postman sync can be added later through Postman API Builder or repository integration.

## Users

- Frontend developers calling backend APIs.
- Backend developers changing routes, validators, controllers, and DTOs.
- Developers testing API flows in Postman.
- Reviewers checking whether API behavior changed intentionally.

## User Stories

- As a developer, I can open API docs locally and see the current v1 API contract.
- As a developer, I can import the same contract into Postman and test endpoints without manually recreating every route.
- As a backend developer, I can update a route and update the matching API contract in the same change.
- As a reviewer, I can detect route or payload changes by reviewing the OpenAPI diff.

## Acceptance Criteria

- The repository contains a committed OpenAPI 3.x contract file for the backend API.
- The contract documents the shared response envelope used by success and error responses.
- The contract starts with auth endpoints, including forgot-password, OTP verification, password reset, login, register, refresh, and logout flows.
- The contract can be served through Swagger UI in development.
- The contract can be manually imported into Postman without hand-copying routes.
- Automatic Postman sync is documented as optional future setup, not part of the first implementation.
- The implementation includes clear developer instructions for updating the contract when backend routes change.
- The first implementation does not attempt to auto-generate every route from Express.
- Protected endpoints document their bearer-token or cookie requirements where applicable.
- Auth endpoints document request validation requirements and common error responses.

## Edge Cases

- Backend route exists but is missing from the OpenAPI contract.
- Contract endpoint exists but backend route no longer exists.
- Response shape changes from `data/meta` envelope to another shape.
- Validation error response includes nested `error.details`.
- Auth flows use httpOnly refresh cookies that Postman users must preserve between requests.
- OAuth routes redirect instead of returning JSON.
- File upload endpoints require multipart request documentation later.

## Constraints

- Keep the initial scope focused on infrastructure and auth endpoints.
- Do not introduce a large route metadata framework in the first pass.
- Do not replace existing Express routes or validators.
- Do not require Postman to be the source of truth.
- Avoid adding API docs for unfinished or unstable endpoints until their contract is verified.
- Keep the OpenAPI contract human-reviewable.

## Success Criteria

- Developers can view API docs from the local backend in development.
- Developers can manually import the contract into Postman and call documented auth endpoints.
- Developers understand that Postman does not automatically track Express route changes unless it is configured to sync from the OpenAPI source.
- The auth password reset flow documents that `resetToken` comes from OTP verification and is required by reset password.
- CI or local verification can validate the OpenAPI contract syntax.
- Future API changes have a documented checklist item to update the contract.
