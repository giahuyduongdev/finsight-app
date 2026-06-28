# Manual test - Hardening token va Redis secret

## Da lam

- Them `TOKEN_HASH_SECRET` vao `backend/.env.example`.
- Them helper HMAC-SHA256 trong `backend/src/utils/secure-hash.util.ts`.
- Doi OTP va reset token tu SHA-256 tron sang HMAC.
- Doi refresh token MongoDB tu raw JWT sang digest.
- Doi access-token blacklist Redis key tu raw token sang digest.
- Doi auth Redis key theo email sang digest, khong con raw email trong key.
- Doi auth user lookup cache key sang HMAC email digest.
- Them script cleanup refresh token plaintext:

```bash
npm run revoke:plaintext-refresh-tokens
```

- Them test unit/integration cho secure hash, Redis key, refresh token digest,
  blacklist middleware, auth service va registration race.

## Chuan bi env

Trong `backend/.env` phai co:

```env
TOKEN_HASH_SECRET=<chuoi-64-ky-tu-hex>
```

Neu can tao secret moi:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Khong dung lai:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_SECRET`
- `REDIS_PASSWORD`

Neu Redis local co password, `REDIS_URL` cua backend phai chua password:

```env
REDIS_URL=redis://:<REDIS_PASSWORD>@localhost:6379
```

## Chay verification tu dong

Trong thu muc `backend`:

```bash
npm run test:unit -- --runInBand
npm run test:integration -- --runInBand auth-token-digest auth-registration-race
npm run type-check
npm run lint
npm run build
```

Ket qua da verify luc implement:

- full unit: 56 suites pass, 332 tests pass, 3 skipped
- targeted integration: pass
- type-check: pass
- lint: pass
- build: pass

## Manual test Redis keys

### 1. Start app va Redis

Chay Redis/backend theo flow local cua project.

Sau do login/register/forgot-password bang UI hoac API.

### 2. Kiem tra Redis khong co raw email trong auth keys

Dung Redis CLI. Neu Redis co password:

```bash
redis-cli -a <REDIS_PASSWORD>
```

Trong Redis CLI:

```redis
SCAN 0 MATCH "*email@example.com*" COUNT 100
SCAN 0 MATCH "*@*" COUNT 100
SCAN 0 MATCH "otp:*" COUNT 100
SCAN 0 MATCH "pending:*" COUNT 100
SCAN 0 MATCH "reset:*" COUNT 100
SCAN 0 MATCH "blacklist:*" COUNT 100
```

Ky vong:

- Khong thay raw email trong key.
- Cac key `otp:*`, `pending:*`, `reset:*` co suffix dang digest hex dai.
- Key blacklist khong chua raw JWT.

### 3. Kiem tra OTP/reset token khong luu plaintext

Tao OTP flow, vi du forgot password.

Trong Redis CLI:

```redis
GET <otp-key>
GET <reset-token-key>
```

Ky vong:

- Value khong phai OTP 6 so.
- Value khong phai reset token raw.
- Value la digest hex.

## Manual test MongoDB refresh token

### 1. Login de tao refresh token

Login bang UI hoac API.

### 2. Kiem tra collection refresh tokens

Dung Mongo shell/Compass, xem collection `refreshtokens` hoac ten collection
tuong ung cua Mongoose model `RefreshToken`.

Kiem tra field:

```text
token
```

Ky vong:

- `token` la digest hex 64 ky tu.
- `token` khong phai JWT.
- Raw JWT thuong co dang `xxxxx.yyyyy.zzzzz`, neu thay dau cham `.` trong field
  token thi do la du lieu cu hoac bug.

### 3. Test refresh-token van hoat dong

Sau login, goi refresh endpoint:

```http
POST /api/v1/auth/refresh-token
```

Ky vong:

- Tra ve access token moi.
- MongoDB van chi luu digest.

### 4. Test logout revoke dung digest

Goi:

```http
POST /api/v1/auth/logout
```

Ky vong:

- Refresh token record bi set `isRevoked: true`.
- Redis co key `blacklist:{digest}`.
- Redis khong co key `blacklist:{rawAccessToken}`.

## Manual test access token blacklist

1. Login lay access token.
2. Logout bang access token do.
3. Goi lai mot endpoint bat ky voi access token cu.

Ky vong:

- Request bi tu choi `401`.
- Redis key blacklist la digest, khong chua raw access token.

## Cleanup refresh token plaintext cu

Sau deploy code moi, chay trong `backend`:

```bash
npm run revoke:plaintext-refresh-tokens
```

Tac dong:

- Xoa refresh token record cu ma field `token` khong phai digest hex 64 ky tu.
- User dang giu session cu co the phai dang nhap lai.

Nen chay sau khi da set `TOKEN_HASH_SECRET` o moi truong deploy.

## Rollout checklist

- [ ] Set `TOKEN_HASH_SECRET` o local/staging/production.
- [ ] Confirm `TOKEN_HASH_SECRET` khong trung cac secret khac.
- [ ] Deploy code moi.
- [ ] Chay `npm run revoke:plaintext-refresh-tokens`.
- [ ] Login/refresh/logout manual test thanh cong.
- [ ] Inspect Redis: khong co raw email/raw access token trong auth keys.
- [ ] Inspect MongoDB: refresh token moi la digest, khong phai JWT.
- [ ] Monitor auth error rate sau deploy.
- [ ] Monitor logs de chac khong co raw token/OTP/reset token/password.

## Luu y

- Root `.env` khong can `TOKEN_HASH_SECRET` neu backend chay tu thu muc
  `backend` va doc `backend/.env`.
- Root `.env` co `REDIS_PASSWORD` vi docker-compose dung no de dat password cho
  Redis server.
- `REDIS_PASSWORD` khong duoc dung thay `TOKEN_HASH_SECRET`.
