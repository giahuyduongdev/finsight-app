# Auth User Lookup And Abuse Protection - Tong Hop Implement Va Manual Test

## Tong Quan Phan Da Implement

Phan nay them lop toi uu lookup user bang Redis cho cac flow auth, nhung
MongoDB van la source of truth.

Da implement:

- `backend/src/utils/auth-user-lookup.util.ts`
  - bitmap versioned key: `bitmap:users:email:v1`
  - ready flag: `bitmap:users:email:v1:ready`
  - positive cache key: `user:email:{sha256(canonicalEmail)}`
  - negative cache key: `nf:email:{sha256(canonicalEmail)}`
  - tinh bitmap index bang CRC32
  - xu ly ready / not ready
  - helper sync cache va bitmap theo kieu best-effort
  - log debug/warn chi dung email hash, khong log raw email

- `backend/src/scripts/backfill-user-email-bitmap.ts`
  - xoa ready flag truoc khi rebuild
  - rebuild `bitmap:users:email:v1` tu toan bo users trong MongoDB
  - chi set `bitmap:users:email:v1:ready = 1` sau khi backfill thanh cong

- `backend/package.json`
  - them script `npm run backfill:user-email-bitmap`

- `backend/src/services/auth.service.ts`
  - register va register resend dung lookup layer de pre-check duplicate email
  - verify register sync positive cache, bitmap, va xoa negative cache
  - forgot-password request/resend/verify OTP dung bitmap/cache/MongoDB lookup
  - login thanh cong se sync lookup state
  - reset password thanh cong se sync lookup state
  - change-email request dung lookup layer de pre-check email moi
  - change-email verify sync lookup state cho email cu va email moi
  - OAuth callback canonicalize email provider, handle duplicate-key race, va
    sync lookup state

## Nguyen Tac Hoat Dong

### Bitmap Ready

Chi duoc dung `BIT = 0` de skip MongoDB khi co ready flag:

```text
bitmap:users:email:v1:ready = 1
```

Neu ready flag bi thieu hoac Redis lookup loi:

- register fallback sang MongoDB duplicate pre-check
- change-email fallback sang MongoDB duplicate pre-check
- forgot-password fallback sang MongoDB sau rate limit

### Y Nghia BIT

```text
BIT = 0 -> chac chan khong co, nhung chi khi bitmap ready
BIT = 1 -> co the ton tai, bat buoc check cache hoac MongoDB tiep
```

`BIT = 1` khong bao gio duoc xem la bang chung user ton tai.

### MongoDB La Nguon Su That

MongoDB van quyet dinh cuoi cung cho:

- user co ton tai hay khong
- verify password
- unique email
- refresh token state
- token version
- lien ket OAuth identity

## Setup / Deploy

Sau khi deploy code, chay backfill truoc khi tin vao `BIT = 0` de skip DB:

```bash
cd backend
npm run backfill:user-email-bitmap
```

Ket qua mong doi:

- `bitmap:users:email:v1` duoc rebuild tu users trong MongoDB
- `bitmap:users:email:v1:ready` duoc set thanh `1`
- log co dong `User email bitmap backfill completed`

Neu Redis bi flush, bitmap key bi xoa, doi hash strategy, hoac doi bitmap size,
can chay lai backfill.

## Checklist Manual Test

Can chay local backend voi MongoDB va Redis.

### 1. Kiem Tra Ready Flag Sau Backfill

1. Start MongoDB va Redis.
2. Dam bao MongoDB co it nhat mot user.
3. Chay:

```bash
cd backend
npm run backfill:user-email-bitmap
```

4. Check Redis:

```text
GET bitmap:users:email:v1:ready
```

Expected:

```text
1
```

### 2. Register - Bitmap Chua Ready Thi Fallback MongoDB

1. Xoa ready flag:

```text
DEL bitmap:users:email:v1:ready
```

2. Goi API:

```http
POST /api/v1/auth/register
```

voi mot email moi.

Expected:

- request van hoat dong
- he thong dung MongoDB duplicate pre-check
- OTP duoc gui
- user chua duoc tao cho toi khi verify OTP

### 3. Register - Bitmap Ready Va Email Moi

1. Chay backfill de ready flag = `1`.
2. Register mot email hoan toan moi.

Expected:

- neu bitmap bit = `0`, co the skip MongoDB duplicate pre-check
- pending registration va OTP Redis keys duoc tao
- email verification OTP duoc gui

3. Verify OTP.

Expected:

- user duoc tao trong MongoDB
- `user:email:{sha256(email)}` ton tai
- bitmap bit cua email duoc set
- `nf:email:{sha256(email)}` bi xoa neu truoc do co ton tai

### 4. Register - Email Da Ton Tai

1. Register bang email da ton tai.

Expected:

- response la duplicate email conflict
- user khong bi tao lai
- `BIT = 1` khong tu quyet dinh user ton tai, flow van check cache hoac MongoDB

### 5. Forgot Password - Email Khong Ton Tai Va Bitmap Ready

1. Dam bao ready flag = `1`.
2. Dung email khong ton tai va co bitmap bit = `0`.
3. Goi API:

```http
POST /api/v1/auth/password/forgot
```

Expected:

- response van la generic accepted message
- khong gui reset email
- khong query MongoDB cho email do

### 6. Forgot Password - Email Ton Tai

1. Goi forgot password voi email ton tai.

Expected:

- response van la generic
- forgot OTP Redis state duoc tao
- reset OTP email duoc gui
- positive cache va bitmap duoc sync

### 7. Forgot Password - Bitmap Chua Ready

1. Xoa ready flag:

```text
DEL bitmap:users:email:v1:ready
```

2. Goi forgot password voi email ton tai.

Expected:

- flow fallback sang MongoDB
- response van la generic
- reset OTP email van duoc gui cho user that

### 8. Forgot Password Resend

1. Request forgot password cho mot email ton tai.
2. Cho het resend cooldown hoac xoa resend key trong local Redis.
3. Goi API:

```http
POST /api/v1/auth/password/resend
```

Expected:

- user ton tai nhan OTP moi
- user khong ton tai nhan generic response
- khong lo email co ton tai hay khong

### 9. Forgot Password Verify OTP

1. Request forgot password cho email ton tai.
2. Lay OTP tu local mail/dev mail sink.
3. Goi API:

```http
POST /api/v1/auth/password/verify-otp
```

Expected:

- OTP dung tra ve reset token
- user khong ton tai hoac OTP sai tra ve loi OTP hien co
- lookup state duoc sync cho user ton tai

### 10. Login

1. Login voi user hop le.

Expected:

- login thanh cong
- positive cache va bitmap duoc sync

2. Login voi email khong ton tai.

Expected:

- response la `401 Invalid email or password`
- bitmap khong duoc dung de reject credential

### 11. Change Email

1. Login va lay access token.
2. Request change email sang mot email moi.

Expected:

- neu bitmap chua ready, he thong dung MongoDB pre-check
- neu bitmap ready va bit = `0`, duplicate pre-check co the skip MongoDB
- OTP duoc gui toi email cu va email moi

3. Verify ca hai OTP.

Expected:

- email trong MongoDB duoc update
- old positive cache bi xoa
- new positive cache duoc set
- new bitmap bit duoc set
- new negative cache bi xoa
- session cu bi revoke qua token-version flow

### 12. OAuth Callback

Chi test duoc neu local da cau hinh Auth0 credentials.

Expected:

- provider email duoc canonicalize
- user ton tai co the duoc link bang email
- user OAuth moi co the duoc tao
- duplicate-key race se re-read va link user ton tai
- positive cache, bitmap, va negative cache duoc sync

## Automated Verification Da Chay

Cac lenh sau da pass sau khi implement:

```bash
cd backend
npm test -- auth-user-lookup.util.test.ts auth.service.test.ts --runInBand
npm run type-check
npm run lint
npm run build
npm run test:unit -- --runInBand
npm test -- integration\auth-registration-race.test.ts --runInBand --forceExit
```

## Ghi Chu

- Redis lookup cache va bitmap sync la best-effort sau khi MongoDB persist thanh
  cong.
- OTP Redis writes van fail-closed.
- Raw email khong duoc dung trong lookup/cache keys moi.
- Log dung `emailHash`, khong log raw email.
- Cac OTP Redis keys dang dung raw email hien tai chua migrate trong scope nay.
