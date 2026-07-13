# Client Vendor Chunk Strategy Tasks

## Implementation

- [x] Create branch `fix/client-vendor-chunk-strategy`.
- [x] Capture baseline build output.
- [x] Add narrow `manualChunks` package groups in `client/vite.config.ts`.
- [x] Avoid catch-all vendor grouping.

## Validation

- [x] Run `pnpm.cmd --dir client run type-check`.
- [x] Run `pnpm.cmd --dir client run lint`.
- [x] Run `pnpm.cmd --dir client run build`.
- [x] Confirm build output has no circular chunk warnings.
- [x] Confirm main `index` JS chunk is below 500 kB.
- [x] Record final build output in this spec.

## Decision Gate

- [x] No vendor chunk remains above 500 kB.
- [x] Circular chunk warnings were resolved by grouping Redux state packages with `vendor-react-core`.

## Final Measurements

- React Doctor: `0 errors`, `28 warnings`, `14 affected files`, score `69/100`.
- Build: pass, no Vite chunk-size warning, no circular chunk warning.
- Main JS chunk: `assets/index-D1uAdHzY.js` - `491.43 kB`, gzip `142.31 kB`.
- Largest vendor chunk: `assets/vendor-recharts-DpEcDH--.js` - `421.02 kB`, gzip `113.70 kB`.
