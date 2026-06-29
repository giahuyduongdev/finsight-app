# Package Manager pnpm Migration Design

## Approach

Use the repository root as the only install point. The root package becomes a private pnpm workspace with `backend` and `client` listed in `pnpm-workspace.yaml`.

This keeps dependency installation deterministic and avoids maintaining three separate npm lockfiles.

## Workspace Layout

```text
finsight/
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  backend/package.json
  client/package.json
```

## Package Scripts

Root scripts provide convenience commands for common cross-package checks. Package-local scripts stay in `backend/package.json` and `client/package.json`.

The backend `build` script uses local binaries directly instead of shelling out to `npm run clean`.

## CI

Each CI job enables Corepack, configures Node with pnpm cache, installs from the root lockfile, and then runs commands for the relevant package with `pnpm --dir`.

Frontend and backend jobs stay separate so failures remain easy to read.

## Git Hooks

Husky hooks use `pnpm exec` or `pnpm --dir` instead of `npx` and `npm run`.

## Docker/VPS Impact

The current `docker-compose.yml` only defines Redis and monitoring services, so it does not need package manager changes. Future app Dockerfiles should use Corepack and copy the root workspace files before running `pnpm fetch` or `pnpm install --frozen-lockfile`.

## Risks

- pnpm may expose dependencies that were previously available only through npm hoisting.
- Peer dependency warnings may appear for existing React/tooling combinations.
- CI cache keys change because npm lockfiles are replaced by `pnpm-lock.yaml`.
