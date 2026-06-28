# Tom tat - Hardening token va Redis secret

## Muc tieu

Tang bao mat cho cac du lieu auth dang luu trong Redis va MongoDB de neu Redis
hoac database bi dump thi attacker khong lay duoc token dung truc tiep, khong
brute-force OTP de dang, va khong thay raw email trong Redis auth key.

Thay doi nay giu nguyen contract API hien tai, khong bat frontend doi request
hoac response.

## Pham vi can lam

- Luu refresh token trong MongoDB bang digest HMAC, khong luu raw refresh JWT.
- Doi Redis blacklist key tu `blacklist:{rawAccessToken}` sang
  `blacklist:{accessTokenDigest}`.
- Doi OTP va reset token tu SHA-256 tron sang HMAC-SHA256 voi
  `TOKEN_HASH_SECRET`.
- Doi cac Redis key theo email sang suffix hash cua canonical email, khong dua
  raw email vao key.
- Giu password tam thoi trong Redis o dang ma hoa, vi app can giai ma de tao
  hoac doi mat khau.
- Them `TOKEN_HASH_SECRET` vao `backend/.env.example` va yeu cau moi env key moi
  sau nay phai co note trong example.

## Nhung thu khong nen hash

Khong nen hash cac cache can doc lai va tra ve cho app. Neu can bao mat hon thi
phai ma hoa, khong hash.

Trong scope nay tam chap nhan plaintext:

- exchange-rate cache
- analytics summary cache
- user profile cache da omit password va tokenVersion

Nen tach thanh follow-up neu muon privacy manh hon:

- receipt scan cache, vi co title, amount, category, payment method, receipt URL
- BullMQ receipt job metadata, vi co image URL va file name
- import batch data, vi tam luu cac dong transaction nguoi dung trong MongoDB

## Cac quyet dinh da chot

1. Co chap nhan xoa hoac revoke tat ca refresh token plaintext cu khi deploy
   khong?

   Da chot: chap nhan. Nguoi dung dang co session cu co the phai dang nhap lai.
   Cach nay an toan hon viec fallback query ca plaintext lan digest. Da them
   script `revoke:plaintext-refresh-tokens`.

2. `TOKEN_HASH_SECRET` co bat buoc tren moi moi truong khong?

   Da chot: bat buoc. Tao bang 32 random bytes encode hex:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Ket qua dai 64 ky tu hex. Khong dung lai `JWT_SECRET`,
   `JWT_REFRESH_SECRET`, hoac `ENCRYPTION_SECRET`. Neu thieu secret thi auth
   flow lien quan digest phai fail closed, khong fallback sang SHA-256 tron.

3. Co chap nhan cac OTP/reset session dang pending truoc deploy bi het han khong?

   Da chot: chap nhan. TTL cua cac state nay ngan, user co the request OTP moi.

4. Receipt scan cache co dua vao scope lan nay khong?

   Da chot: khong. Day la readable business cache, neu lam thi nen la feature
   rieng ve encryption/retention, khong tron vao token hardening.

5. Co doi ten field `RefreshToken.token` thanh `tokenDigest` ngay khong?

   Da chot: chua doi trong slice dau de giam migration/refactor. Them test de
   noi ro field nay dang luu digest. Neu muon sach schema hon thi tach thanh
   task sau.

## Rủi ro khi rollout

- User co refresh token cu co the bi logout va can dang nhap lai.
- OTP/reset token dang pending truoc deploy co the khong verify duoc.
- Neu quen set `TOKEN_HASH_SECRET`, auth flow lien quan token/OTP se fail closed.
- Neu dung lai `TOKEN_HASH_SECRET` tu secret khac, secret boundary yeu hon va
  phai sua cau hinh truoc deploy.
- Neu chi doi code ma khong cleanup refresh token plaintext cu, database van con
  du lieu nhay cam cu.

## Kiem tra sau implement

- Inspect Redis keys sau cac flow auth: khong thay raw email, raw access token.
- Inspect Redis values cho OTP/reset token: khong thay raw OTP/reset token, khong
  dung SHA-256 tron.
- Inspect MongoDB `RefreshToken`: khong thay raw refresh JWT cho token moi.
- Test refresh-token, logout, blacklist middleware, register OTP, forgot password,
  change password, change email.
- Run backend lint, typecheck, build, unit va integration tests lien quan auth.

## File lien quan

- `requirements.md`
- `design.md`
- `tasks.md`
- `sequence.mmd`
- `backend/.env.example`
