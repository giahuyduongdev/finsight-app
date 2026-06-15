# Backend API Docs

`openapi.yaml` is the source of truth for the documented backend API contract.

## Local Swagger UI

Run the backend in development mode and open:

```text
http://localhost:8000/api/docs
```

The raw OpenAPI file is served at:

```text
http://localhost:8000/api/docs/openapi.yaml
```

Swagger UI is enabled only when `appConfig.features.swagger` is enabled. By
default, that means development only.

## Postman

First-pass workflow is manual import:

1. Open Postman.
2. Import `backend/docs/openapi.yaml`.
3. Configure environment variables such as `baseUrl`, `accessToken`, and test credentials.
4. Preserve cookies when testing refresh-token flows.

Postman does not automatically update when Express routes change. Re-import the
OpenAPI file after contract changes, or configure Postman API Builder /
repository sync later.

## Updating API Docs

When changing backend API behavior, update these together:

- Express route, controller, validator, or DTO.
- Matching path/schema in `backend/docs/openapi.yaml`.
- Tests when request or response behavior changes.

Validate the contract before finishing:

```bash
npm run docs:api:validate
```
