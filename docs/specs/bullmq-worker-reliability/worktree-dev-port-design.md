# Worktree Development Port

## Goal

Allow a Git worktree to run the client on a different development port without
changing the default port used by the root checkout.

## Design

- `client/vite.config.ts` reads the optional `VITE_DEV_PORT` environment
  variable.
- When the variable is a valid port, Vite uses it as `server.port`.
- When the variable is absent, Vite keeps its default port (`5173`).
- The BullMQ worktree sets `VITE_DEV_PORT=5174` in its ignored `client/.env`.
- The worktree backend remains on port `8001`.

## Verification

- Running `npm run dev` in the worktree client starts Vite on port `5174`.
- Running without `VITE_DEV_PORT` preserves Vite's default behavior.
- Invalid port values do not override Vite's default.

