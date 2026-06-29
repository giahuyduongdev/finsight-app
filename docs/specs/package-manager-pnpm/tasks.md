# Package Manager pnpm Migration Tasks

## 1. Workspace Setup

- [x] Create pnpm migration spec.
- [x] Add `packageManager` and workspace metadata to root `package.json`.
- [x] Add `pnpm-workspace.yaml`.
- [x] Add pnpm install settings if needed for existing peer dependency behavior.

## 2. Lockfile Migration

- [x] Generate `pnpm-lock.yaml`.
- [x] Remove root, backend, and client `package-lock.json` files.
- [x] Confirm `pnpm install --frozen-lockfile` works from the root.

## 3. Command Migration

- [x] Update backend scripts that shell out to npm.
- [x] Update Husky hooks from npm/npx to pnpm.
- [x] Update GitHub Actions from npm cache/install/run commands to pnpm.

## 4. Verification

- [x] Run backend type-check.
- [x] Run backend lint.
- [x] Run backend unit tests.
- [x] Run backend integration tests.
- [x] Run backend build.
- [x] Run client type-check.
- [x] Run client lint.
- [x] Run client tests.
- [x] Run client build.
- [x] Run `git diff --check`.
