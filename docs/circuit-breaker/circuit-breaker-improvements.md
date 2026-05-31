# CÃ¡c cáº£i thiá»‡n circuit breaker/retry/fallback Ä‘Ã£ thá»±c hiá»‡n

TÃ i liá»‡u nÃ y ghi láº¡i cÃ¡c thay Ä‘á»•i Ä‘Ã£ lÃ m sau khi rÃ  soÃ¡t `docs/circuit-breaker/circuit-breaker-retry-summary.md`.

## Má»¥c tiÃªu

- Ãp dá»¥ng circuit breaker cho cÃ¡c dependency cÃ²n thiáº¿u.
- Cho phÃ©p cáº¥u hÃ¬nh threshold/timeout qua env.
- TÄƒng visibility tráº¡ng thÃ¡i circuit breaker.
- Bá»• sung fallback thá»±c táº¿ hÆ¡n cho exchange rate khi API ngoÃ i lá»—i.

## 1. ThÃªm circuit breaker cho Exchange Rate API

File liÃªn quan:

- `backend/src/lib/exchange-rate-currency.ts`
- `backend/src/utils/circuitBreaker.util.ts`

Thay Ä‘á»•i:

- ThÃªm `exchangeRateCircuitBreaker`.
- Bá»c `fetchExchangeRatesWithFallback()` báº±ng:

```ts
exchangeRateCircuitBreaker.execute(
  () => fetchExchangeRatesWithFallbackInternal(currency),
  'Exchange Rate API'
)
```

Káº¿t quáº£:

- Náº¿u primary/fallback exchange rate API lá»—i liÃªn tá»¥c, circuit sáº½ má»Ÿ.
- Khi circuit má»Ÿ, request má»›i fail nhanh thay vÃ¬ tiáº¿p tá»¥c gá»i API ngoÃ i.
- Náº¿u primary fail nhÆ°ng fallback thÃ nh cÃ´ng, operation váº«n Ä‘Æ°á»£c tÃ­nh lÃ  thÃ nh cÃ´ng.

## 2. ThÃªm stale cache cho exchange rate

File liÃªn quan:

- `backend/src/lib/exchange-rate-currency.ts`

Thay Ä‘á»•i:

- Váº«n giá»¯ cache chÃ­nh TTL `3600` giÃ¢y.
- ThÃªm stale cache TTL `24` giá».
- Khi API ngoÃ i fail, náº¿u cÃ²n stale rate thÃ¬ tráº£ stale rate thay vÃ¬ throw ngay.

Káº¿t quáº£:

- CÃ¡c flow tÃ­nh toÃ¡n tiá»n tá»‡ bá»n hÆ¡n khi exchange rate provider táº¡m lá»—i.
- User váº«n cÃ³ thá»ƒ nháº­n káº¿t quáº£ gáº§n Ä‘Ãºng dá»±a trÃªn rate cÅ©.

## 2.1. Harden manual refresh vÃ  cached rate payload

File liÃªn quan:

- `backend/src/services/currency.service.ts`
- `backend/src/lib/exchange-rate-currency.ts`
- `client/src/features/analytics/analyticsAPI.ts`

Thay Ä‘á»•i:

- `refreshRatesManually()` bá»c Redis lock/cache flow báº±ng `try/catch/finally`.
- Náº¿u manual refresh lá»—i do Redis/network/provider, endpoint fallback vá» `getLatestRates()` thay vÃ¬ fail cá»©ng.
- Manual refresh lock Ä‘Æ°á»£c release trong `finally`; náº¿u release lock lá»—i thÃ¬ log warning.
- Cached/stale exchange rate payload Ä‘Æ°á»£c parse báº±ng `Number()` vÃ  validate `Number.isFinite`.
- Náº¿u cache/stale cache corrupt, backend log warning vÃ  bá» qua entry Ä‘Ã³ thay vÃ¬ tráº£ `NaN`.
- Frontend mutation `refreshExchangeRates` invalidate tag `analytics` Ä‘á»ƒ UI refetch dá»¯ liá»‡u liÃªn quan sau khi refresh.

Káº¿t quáº£:

- Manual refresh exchange rate Ã­t lÃ m giÃ¡n Ä‘oáº¡n UI hÆ¡n khi dependency táº¡m lá»—i.
- KhÃ´ng tráº£ rate `NaN` tá»« Redis cache corrupt.
- Frontend analytics cache Ä‘á»“ng bá»™ láº¡i sau manual refresh.

## 3. ThÃªm circuit breaker cho Cloudinary

File liÃªn quan:

- `backend/src/config/cloudinary.config.ts`
- `backend/src/utils/circuitBreaker.util.ts`

Thay Ä‘á»•i:

- Bá»c upload Cloudinary báº±ng `cloudinaryCircuitBreaker`.
- Bá»c delete Cloudinary báº±ng `cloudinaryCircuitBreaker`.
- TÃ¡ch upload stream thÃ nh promise helper Ä‘á»ƒ dá»… bá»c báº±ng breaker.

Káº¿t quáº£:

- Náº¿u Cloudinary upload/delete lá»—i liÃªn tá»¥c, circuit sáº½ má»Ÿ.
- Khi circuit má»Ÿ, request má»›i fail nhanh thay vÃ¬ tiáº¿p tá»¥c gá»i Cloudinary.

## 4. Cho phÃ©p cáº¥u hÃ¬nh circuit breaker báº±ng env

File liÃªn quan:

- `backend/src/utils/circuitBreaker.util.ts`
- `backend/.env.example`
- `backend/samples/.env.sample`

Thay Ä‘á»•i:

- ThÃªm env chung:

```env
CIRCUIT_FAILURE_THRESHOLD=
CIRCUIT_RESET_TIMEOUT_MS=
```

- ThÃªm env riÃªng theo service:

```env
GEMINI_CIRCUIT_FAILURE_THRESHOLD=
GEMINI_CIRCUIT_RESET_TIMEOUT_MS=
RESEND_CIRCUIT_FAILURE_THRESHOLD=
RESEND_CIRCUIT_RESET_TIMEOUT_MS=
CLOUDINARY_CIRCUIT_FAILURE_THRESHOLD=
CLOUDINARY_CIRCUIT_RESET_TIMEOUT_MS=
EXCHANGE_RATE_CIRCUIT_FAILURE_THRESHOLD=
EXCHANGE_RATE_CIRCUIT_RESET_TIMEOUT_MS=
```

Rule:

- Env riÃªng theo service Ä‘Æ°á»£c Æ°u tiÃªn.
- Náº¿u env riÃªng khÃ´ng cÃ³, fallback vá» env chung.
- Náº¿u env chung cÅ©ng khÃ´ng cÃ³, dÃ¹ng default:
  - `failureThreshold = 5`
  - `resetTimeoutMs = 30000`

## 5. ThÃªm visibility vÃ o health check

File liÃªn quan:

- `backend/src/controllers/health.controller.ts`
- `backend/src/@types/index.d.ts`
- `backend/src/utils/circuitBreaker.util.ts`

Thay Ä‘á»•i:

- ThÃªm `getCircuitBreakerSnapshots()`.
- Endpoint `/health` tráº£ thÃªm tráº¡ng thÃ¡i cÃ¡c breaker:
  - `gemini`
  - `resend`
  - `cloudinary`
  - `exchangeRate`

Má»—i breaker tráº£:

```ts
{
  state,
  failureCount,
  failureThreshold,
  resetTimeoutMs
}
```

Káº¿t quáº£:

- CÃ³ thá»ƒ kiá»ƒm tra breaker nÃ o Ä‘ang `OPEN`, `HALF_OPEN`, hoáº·c `CLOSED`.
- Dá»… debug hÆ¡n khi dependency ngoÃ i bá»‹ lá»—i.

## 6. Cáº­p nháº­t tÃ i liá»‡u summary

File liÃªn quan:

- `docs/circuit-breaker/circuit-breaker-retry-summary.md`

Thay Ä‘á»•i:

- Cáº­p nháº­t tráº¡ng thÃ¡i má»›i:
  - Exchange Rate API Ä‘Ã£ cÃ³ circuit breaker.
  - Cloudinary Ä‘Ã£ cÃ³ circuit breaker.
  - Exchange Rate cÃ³ stale cache fallback.
  - `/health` cÃ³ circuit breaker snapshot.
  - Env config cho circuit breaker Ä‘Ã£ Ä‘Æ°á»£c bá»• sung.

## Verification

ÄÃ£ cháº¡y trong `backend`:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Káº¿t quáº£:

- TypeScript type-check pass.
- ESLint pass.
- Unit test pass: 26 suites passed, 195 tests passed, 3 skipped.

## File Ä‘Ã£ chá»‰nh

- `backend/.env.example`
- `backend/samples/.env.sample`
- `backend/src/@types/index.d.ts`
- `backend/src/config/cloudinary.config.ts`
- `backend/src/controllers/health.controller.ts`
- `backend/src/lib/exchange-rate-currency.ts`
- `backend/src/services/currency.service.ts`
- `backend/src/utils/circuitBreaker.util.ts`
- `client/src/features/analytics/analyticsAPI.ts`
- `docs/circuit-breaker/circuit-breaker-retry-summary.md`

## Ghi chÃº cÃ²n láº¡i

- Resend Email váº«n chá»‰ cÃ³ circuit breaker, chÆ°a cÃ³ retry hoáº·c fallback provider.
- Gemini retry classification váº«n nÃªn Ä‘Æ°á»£c rÃ  riÃªng náº¿u muá»‘n phÃ¢n biá»‡t rÃµ lá»—i permission/config vá»›i lá»—i provider táº¡m thá»i.
- Cloudinary hiá»‡n cÃ³ circuit breaker nhÆ°ng chÆ°a cÃ³ retry riÃªng hoáº·c fallback storage provider.
