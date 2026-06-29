# Package Manager pnpm Migration Requirements

## Goal

Move the repository from separate npm installs to one pnpm workspace that covers the root tooling, backend, and client packages.

## Scope

- Add a root pnpm workspace for `backend` and `client`.
- Replace npm lockfiles with one root `pnpm-lock.yaml`.
- Update CI and Git hooks to use pnpm.
- Keep runtime application behavior unchanged.
- Keep Docker Compose service definitions unchanged unless they directly depend on package manager commands.

## Non-Goals

- Do not refactor backend or client application code.
- Do not add app Docker images in this change.
- Do not change deployment topology.
- Do not upgrade dependencies beyond what pnpm lock resolution requires.

## Requirements

- Developers install all packages with `pnpm install` from the repository root.
- CI installs dependencies once from the repository root with `pnpm install --frozen-lockfile`.
- Backend commands remain available from `backend/` through pnpm, for example `pnpm run test:unit`.
- Client commands remain available from `client/` through pnpm, for example `pnpm run build`.
- Existing Husky hooks use pnpm commands.
- The backend build script must not call npm internally.
- The migration must leave no `package-lock.json` files in the repository.

## Verification

- `pnpm.cmd install --frozen-lockfile`
- `pnpm.cmd --dir backend run type-check`
- `pnpm.cmd --dir backend run lint`
- `pnpm.cmd --dir backend run test:unit`
- `pnpm.cmd --dir backend run test:integration`
- `pnpm.cmd --dir backend run build`
- `pnpm.cmd --dir client run type-check`
- `pnpm.cmd --dir client run lint`
- `pnpm.cmd --dir client run test`
- `pnpm.cmd --dir client run build`
- `git diff --check`
