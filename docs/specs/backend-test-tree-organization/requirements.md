# Backend Test Tree Organization Requirements

## Context

The backend test directory currently mixes many test files directly under `backend/src/__tests__/unit`, with only a small `middlewares` subfolder. This makes the Explorer view noisy and makes it harder to find tests by feature area.

Current Jest configuration already discovers tests with:

```txt
**/__tests__/**/*.test.ts
```

CI runs:

```txt
npm run test:unit
npm run test:integration
```

The reorganization should keep those commands working.

## Goals

- Make backend tests easier to browse by grouping them by domain or technical area.
- Preserve existing test behavior and coverage.
- Avoid changing production code.
- Avoid changing Jest/CI behavior unless required by moved paths.
- Keep the refactor mechanical and easy to review.

## Non-Goals

- Do not rewrite test logic.
- Do not rename production modules.
- Do not introduce a new test runner.
- Do not merge unit and integration tests.
- Do not use this refactor to fix unrelated flaky tests.

## Requirements

### R1. Preserve Test Categories

Keep top-level categories:

```txt
backend/src/__tests__/unit
backend/src/__tests__/integration
backend/src/__tests__/mocks
backend/src/__tests__/setup
```

### R2. Group Unit Tests by Area

Move unit tests into subfolders by feature or layer:

```txt
unit/auth
unit/users
unit/transactions
unit/reports
unit/receipts
unit/middlewares
unit/repositories
unit/observability
unit/utils
unit/config
unit/routing
unit/analytics
unit/workers
```

The exact folder set may be reduced during implementation if a category would contain only unclear or misplaced tests.

### R3. Group Integration Tests by Area

Move integration tests into subfolders by feature:

```txt
integration/auth
integration/bullmq
integration/receipts
integration/routing
integration/api
```

### R4. Preserve Relative Imports

Every moved test must have its relative imports updated correctly.

Imports from `mocks` and `setup` should continue to point to the existing shared folders.

### R5. Preserve NPM Scripts and CI

The existing scripts should continue to work:

```txt
npm test
npm run test:unit
npm run test:integration
```

Do not change script semantics unless a verification failure proves it is necessary.

### R6. Update Test Documentation

Update `backend/src/__tests__/README.md` to describe the new layout and how to choose the right folder for new tests.

### R7. Verification

After implementation, run:

```txt
npm.cmd run test:unit
npm.cmd run test:integration
npm.cmd run type-check
npm.cmd run lint
```

If full integration tests require services that are not available locally, document the blocker and run the narrowest equivalent checks that are available.

## Acceptance Criteria

- Backend test files are grouped into meaningful subfolders.
- No test file remains directly under `unit/` unless explicitly justified.
- CI test scripts still discover moved tests.
- TypeScript imports compile after moving files.
- README describes the new test tree.
- Lint and type-check pass.
