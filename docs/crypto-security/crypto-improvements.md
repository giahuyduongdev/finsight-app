# Các cải thiện bảo mật crypto/token đã thực hiện

Tài liệu này ghi lại các thay đổi code đã làm sau phần kết luận trong `docs/crypto-security/crypto-summary.md`.

## Mục tiêu

- Không dùng chung `JWT_SECRET` cho mã hóa dữ liệu tạm.
- Không lưu refresh token plaintext trong MongoDB.
- Pin thuật toán khi verify JWT.
- Verify refresh token đúng audience.
- Không dùng SHA-256 trần cho OTP/reset token.

## Thay đổi đã thực hiện

### 1. Tách secret cho mã hóa AES

File liên quan:

- `backend/src/config/env.config.ts`
- `backend/src/utils/encryption.util.ts`
- `backend/.env.example`
- `backend/samples/.env.sample`

Thay đổi:

- Thêm `Env.ENCRYPTION_SECRET`.
- `encrypt()` và `decrypt()` derive key từ `Env.ENCRYPTION_SECRET` thay vì `Env.JWT_SECRET`.
- Giữ nguyên thuật toán `aes-256-gcm`, PBKDF2-SHA256 `600000` iterations, salt/IV/auth tag như trước.

Kết quả:

- Rotation `JWT_SECRET` không còn ảnh hưởng trực tiếp đến dữ liệu mã hóa tạm trong Redis.
- Secret boundary rõ hơn: JWT dùng cho ký token, encryption secret dùng cho mã hóa.

### 2. Thêm HMAC helper cho token/OTP

File liên quan:

- `backend/src/utils/secure-hash.util.ts`
- `backend/src/config/env.config.ts`
- `backend/.env.example`
- `backend/samples/.env.sample`
- `backend/jest.setup.js`

Thay đổi:

- Thêm helper HMAC-SHA256 dùng chung:
  - `hashOtp()`
  - `hashResetToken()`
  - `hashRefreshToken()`
- Thêm `TOKEN_HASH_SECRET`.
- `TOKEN_HASH_SECRET` là secret bắt buộc riêng, không fallback về `ENCRYPTION_SECRET`.

Kết quả:

- OTP/reset token/refresh token digest không còn là SHA-256 trần.
- Nếu Redis hoặc DB bị dump, attacker khó brute force offline hơn vì cần biết server-side secret.

### 3. Đổi OTP và reset token sang HMAC-SHA256

File liên quan:

- `backend/src/services/auth.service.ts`

Thay đổi:

- Các đoạn tạo/verify OTP chuyển từ:

```ts
crypto.createHash('sha256').update(value).digest('hex')
```

sang:

```ts
hashOtp(value)
```

- Reset token trong forgot password flow chuyển sang:

```ts
hashResetToken(resetToken)
```

Các flow bị ảnh hưởng:

- Đăng ký và verify OTP đăng ký.
- Resend OTP đăng ký.
- Quên mật khẩu, verify OTP quên mật khẩu, reset mật khẩu.
- Resend OTP quên mật khẩu.
- Đổi mật khẩu khi đã đăng nhập.
- Resend OTP đổi mật khẩu.
- Đổi email với OTP email cũ/email mới.
- Resend OTP đổi email.

Kết quả:

- Redis không còn lưu hash SHA-256 trần của OTP/reset token.
- Behavior API không đổi: client vẫn nhận/nhập OTP và reset token như trước.

### 4. Lưu refresh token dạng digest thay vì plaintext

File liên quan:

- `backend/src/services/auth.service.ts`
- `backend/src/repositories/refresh-token.repository.ts`
- `backend/src/utils/secure-hash.util.ts`

Thay đổi:

- Khi tạo refresh token, backend vẫn trả JWT refresh token thật cho client/cookie.
- Trước khi lưu MongoDB, backend tính:

```ts
const refreshTokenHash = hashRefreshToken(refreshToken)
```

- Field `token` trong MongoDB giờ lưu digest thay vì token gốc.
- Khi refresh/logout, backend hash token client gửi lên rồi query theo digest.
- Repository `create()`, `findByToken()` và `revokeToken()` cũng hash token trước khi thao tác DB.
- Để deploy an toàn, lookup thử digest trước; nếu không thấy thì thử plaintext token cũ và migrate record đó sang digest.
- Logout/revoke cũng hỗ trợ cả digest mới và plaintext token cũ.

Kết quả:

- MongoDB không còn lưu refresh token plaintext cho token mới.
- Nếu DB leak, attacker không thể dùng trực tiếp giá trị trong field `token` để refresh session.

Lưu ý deploy:

- Refresh token cũ đang lưu plaintext vẫn có thể dùng trong lần refresh/logout đầu tiên sau deploy.
- Khi token cũ được dùng hợp lệ, backend tự migrate field `token` sang digest.
- Sau khi các session cũ được refresh/logout hoặc hết hạn, DB sẽ không còn cần plaintext token legacy.

### 5. Pin thuật toán JWT và verify audience refresh token

File liên quan:

- `backend/src/utils/jwt.util.ts`

Thay đổi:

- `verifyAccessToken()` thêm:

```ts
algorithms: ['HS256']
```

- `verifyRefreshToken()` thêm:

```ts
audience: 'refresh',
algorithms: ['HS256']
```

Kết quả:

- Verify JWT nhất quán hơn với signing config.
- Refresh token phải đúng issuer, signature, thuật toán và audience.

## Verification

Đã chạy lại sau batch fix CodeRabbit PR #65:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test:unit -- --runInBand
```

Kết quả:

- TypeScript type-check pass.
- ESLint pass.
- Unit test backend pass: 26 suites passed, 195 tests passed, 3 skipped.

## File đã chỉnh

- `backend/.env.example`
- `backend/jest.setup.js`
- `backend/samples/.env.sample`
- `backend/src/config/env.config.ts`
- `backend/src/repositories/refresh-token.repository.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/utils/encryption.util.ts`
- `backend/src/utils/jwt.util.ts`
- `backend/src/utils/secure-hash.util.ts`

## Ghi chú

- Các file backup `.bak` không còn được commit vào repo; `.gitignore` đã ignore `*.bak` và `*.bak2`.
- Các thay đổi này không đổi contract API phía client.
