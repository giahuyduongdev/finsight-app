# Tóm tắt cơ chế mã hóa, hash và token trong Finsight

Tài liệu này tóm tắt các cơ chế bảo mật đang dùng trong dự án, nơi chúng xuất hiện, flow chính và các điểm nên cải thiện. Phạm vi tập trung vào password storage, JWT, refresh token, OTP/reset token, mã hóa dữ liệu tạm trong Redis và Redux Persist.

## Tổng quan nhanh

| Cơ chế | Dùng cho | File chính | Đánh giá |
| --- | --- | --- | --- |
| `bcrypt` | Hash mật khẩu user | `backend/src/utils/bcrypt.util.ts`, `backend/src/models/user.model.ts` | Đúng hướng cho password storage |
| JWT `HS256` | Access token, refresh token | `backend/src/utils/jwt.util.ts`, `backend/src/config/passport.config.ts` | Đã tách secret access/refresh, pin thuật toán và verify audience refresh |
| Refresh token HMAC digest | Lưu phiên đăng nhập | `backend/src/models/refresh-token.model.ts`, `backend/src/services/auth.service.ts`, `backend/src/repositories/refresh-token.repository.ts` | Token mới không lưu plaintext; có migration-safe lookup cho plaintext legacy |
| HMAC-SHA256 | Hash OTP, reset token và refresh token | `backend/src/utils/secure-hash.util.ts` | Dùng `TOKEN_HASH_SECRET` riêng, bắt buộc cấu hình |
| `AES-256-GCM` + `PBKDF2-SHA256` | Mã hóa mật khẩu mới tạm thời trong Redis | `backend/src/utils/encryption.util.ts` | Thuật toán tốt; dùng `ENCRYPTION_SECRET` riêng |
| Redux Persist không mã hóa | Lưu một phần state frontend | `client/src/app/store.ts` | Ổn nếu không persist token nhạy cảm |

## 1. Mật khẩu user

### Hiện trạng

- `hashValue()` trong `backend/src/utils/bcrypt.util.ts` dùng `bcrypt.hash(value, saltRounds)`, mặc định `saltRounds = 10`.
- `userSchema.pre('save')` trong `backend/src/models/user.model.ts` tự hash password trước khi ghi MongoDB.
- Đăng nhập dùng `user.comparePassword()`, bên dưới gọi `bcrypt.compare()`.
- Các flow đổi/reset mật khẩu cuối cùng đều ghi password mới vào user model, rồi model hook hash trước khi lưu.

### Nhận xét

- Đây là cách đúng để lưu mật khẩu: chỉ lưu hash một chiều, không lưu plaintext.
- `saltRounds = 10` vẫn dùng được. Nếu latency đăng ký/đổi mật khẩu cho phép, nên benchmark và cân nhắc tăng lên `12`.
- Không cần mã hóa password trong MongoDB bằng AES; bcrypt mới là lớp bảo vệ phù hợp cho password storage.

## 2. Access token và refresh token

### Hiện trạng

- Access token được ký bằng `JWT_SECRET`, có `audience: user`, `issuer` và `algorithm: HS256`.
- Refresh token được ký bằng `JWT_REFRESH_SECRET`, có `audience: refresh`, `issuer` và thời hạn riêng.
- Route cần đăng nhập dùng `passportAuthenticateJwt` trong `backend/src/config/passport.config.ts`.
- `passport.config.ts` đã cấu hình `algorithms: ['HS256']`.
- `verifyAccessToken()` và `verifyRefreshToken()` trong `backend/src/utils/jwt.util.ts` đã pin `algorithms: ['HS256']`.
- `verifyRefreshToken()` đã kiểm tra `audience: refresh`.

### Flow login

1. Client gọi `POST /api/v1/auth/login`.
2. Backend xác thực email/password bằng bcrypt.
3. Backend tạo access token bằng `signAccessToken({ userId })`.
4. Backend tạo refresh token bằng `signRefreshToken({ userId })`.
5. Refresh token được hash bằng `hashRefreshToken()` trước khi lưu vào MongoDB, token gốc được set vào cookie `httpOnly`.
6. Access token được trả trong response JSON.

### Flow refresh

1. Client gọi `POST /api/v1/auth/refresh-token`.
2. Backend lấy refresh token từ cookie `refreshToken`, nếu không có thì lấy từ body.
3. Backend verify refresh token bằng `JWT_REFRESH_SECRET`, `issuer`, `audience: refresh` và `algorithms: ['HS256']`.
4. Backend hash token rồi tìm digest trong MongoDB, kiểm tra chưa revoke và chưa hết hạn.
5. Nếu không thấy digest, backend thử plaintext token legacy và migrate record đó sang digest nếu hợp lệ.
6. Nếu hợp lệ, backend trả access token mới.

### Nhận xét

- JWT là token được ký, không phải token được mã hóa. Payload có thể decode để đọc nhưng không thể sửa hợp lệ nếu không biết secret.
- Tách `JWT_SECRET` và `JWT_REFRESH_SECRET` là đúng.
- `algorithms: ['HS256']` đã được pin trong cả `verifyAccessToken()` và `verifyRefreshToken()`.
- `audience: 'refresh'` đã được verify để khớp với lúc ký token.

## 3. Refresh token lưu trong MongoDB

### Hiện trạng

- Model: `backend/src/models/refresh-token.model.ts`.
- Field `token` lưu HMAC digest của refresh token và có `unique: true`.
- Login/OAuth tạo refresh token rồi upsert digest vào MongoDB.
- Refresh token service tìm document theo digest, kiểm tra `isRevoked` và `expiresAt`.
- Logout một thiết bị tìm theo digest hoặc plaintext legacy rồi set `isRevoked = true`.
- Plaintext token legacy được migrate sang digest khi user refresh/logout hợp lệ.

### Rủi ro

Với token mới, nếu MongoDB bị leak, attacker không thể dùng trực tiếp giá trị trong field `token` để refresh session. Rủi ro còn lại chủ yếu nằm ở plaintext token legacy chưa được migrate hoặc token thật bị lộ từ client/cookie.

### Trạng thái cải thiện

- Đã lưu digest thay vì token plaintext cho token mới.
- Đã dùng HMAC-SHA256 qua `hashRefreshToken()` với `TOKEN_HASH_SECRET`.
- Khi client gửi refresh token, backend tính digest rồi query theo digest.
- Refresh/logout có migration-safe fallback cho plaintext token cũ.
- Cleanup token hết hạn và logout all vẫn xử lý theo user/revoke flag, không phụ thuộc plaintext token.

## 4. OTP và reset token

### Hiện trạng

- OTP được tạo bằng `crypto.randomInt()` trong `backend/src/utils/generate-otp.util.ts`.
- OTP mặc định 6 chữ số.
- OTP/reset token được hash bằng HMAC-SHA256 qua `hashOtp()` và `hashResetToken()`.
- Redis lưu hash, TTL, attempt counter và dữ liệu pending.
- Các flow chính gồm đăng ký, quên mật khẩu, đổi mật khẩu và đổi email.

### Nhận xét

- `crypto.randomInt()` là lựa chọn tốt để tạo OTP.
- TTL và giới hạn số lần thử giúp chống online brute force.
- OTP/reset token không còn dùng SHA-256 trần; HMAC cần `TOKEN_HASH_SECRET`, giảm rủi ro brute force offline nếu Redis dump bị lộ.

## 5. AES-256-GCM cho dữ liệu tạm trong Redis

### Hiện trạng

- Helper mã hóa/giải mã nằm ở `backend/src/utils/encryption.util.ts`.
- Flow đổi mật khẩu khi đã đăng nhập mã hóa mật khẩu mới rồi lưu tạm trong Redis cho tới khi user xác nhận OTP.
- `encrypt()` dùng:
  - salt random `64` bytes,
  - PBKDF2-SHA256 `600000` iterations,
  - key length `32` bytes,
  - IV random `16` bytes,
  - `aes-256-gcm`,
  - output dạng `salt + iv + authTag + ciphertext`.
- Secret đầu vào để derive key hiện là `Env.ENCRYPTION_SECRET`.

### Nhận xét

- `AES-256-GCM` là lựa chọn phù hợp vì vừa mã hóa vừa kiểm tra toàn vẹn dữ liệu.
- PBKDF2 với `600000` iterations là cấu hình mạnh cho key derivation.
- Secret boundary đã tách khỏi `JWT_SECRET`. Nếu rotate JWT secret, dữ liệu mã hóa tạm trong Redis không bị phụ thuộc ngoài ý muốn.

## 6. Redux Persist

### Hiện trạng

- File chính: `client/src/app/store.ts`.
- Auth persist blacklist các field nhạy cảm như `accessToken`, `expiresAt`, `isInitialized`.
- Root persist cũng blacklist `auth` và RTK Query cache ở cấp root.
- `redux-persist-transform-encrypt` có trong dependency nhưng phần dùng đang bị comment.

### Nhận xét

- Không mã hóa Redux Persist không phải vấn đề lớn nếu không persist access token hoặc dữ liệu nhạy cảm.
- Mã hóa localStorage bằng secret nằm trong frontend không bảo vệ tốt trước XSS, vì attacker chạy được JS thì thường cũng đọc được secret.
- Trọng tâm nên là không lưu token nhạy cảm trong localStorage, giữ refresh token trong `httpOnly` cookie và giảm dữ liệu auth persist.

## Ưu tiên cải thiện

1. Đã dùng `ENCRYPTION_SECRET` riêng cho `AES-256-GCM`/PBKDF2, không dùng `JWT_SECRET`.
2. Đã lưu refresh token dạng HMAC/digest thay vì plaintext.
3. Đã pin `algorithms: ['HS256']` trong `verifyAccessToken()` và `verifyRefreshToken()`.
4. Đã thêm `audience: 'refresh'` khi verify refresh token.
5. Đã đổi OTP/reset token từ SHA-256 trần sang HMAC-SHA256.
6. Còn nên benchmark bcrypt và cân nhắc tăng `saltRounds` từ `10` lên `12`.

## Kết luận

Dự án đang dùng đúng nhóm công cụ chính: bcrypt cho mật khẩu, JWT cho token, AES-GCM cho dữ liệu cần giải mã lại, OTP có TTL và attempt limit. Các điểm ưu tiên về cô lập secret và lưu dữ liệu nhạy cảm đã được xử lý trong batch crypto/CodeRabbit gần đây:

- Secret mã hóa đã tách sang `ENCRYPTION_SECRET`.
- Refresh token mới đã lưu HMAC digest thay vì plaintext.
- OTP/reset token đã dùng HMAC-SHA256 với `TOKEN_HASH_SECRET`.
- JWT verify đã pin thuật toán và kiểm tra audience refresh nhất quán hơn.

Điểm còn lại nên xem xét riêng là benchmark bcrypt để quyết định có tăng `saltRounds` từ `10` lên `12` hay không.
