# Tóm tắt cơ chế mã hóa, hash và token trong Finsight

Tài liệu này tóm tắt các cơ chế bảo mật đang dùng trong dự án, nơi chúng xuất hiện, flow chính và các điểm nên cải thiện. Phạm vi tập trung vào password storage, JWT, refresh token, OTP/reset token, mã hóa dữ liệu tạm trong Redis và Redux Persist.

## Tổng quan nhanh

| Cơ chế | Dùng cho | File chính | Đánh giá |
| --- | --- | --- | --- |
| `bcrypt` | Hash mật khẩu user | `backend/src/utils/bcrypt.util.ts`, `backend/src/models/user.model.ts` | Đúng hướng cho password storage |
| JWT `HS256` | Access token, refresh token | `backend/src/utils/jwt.util.ts`, `backend/src/config/passport.config.ts` | Đang tách secret access/refresh; nên pin thuật toán ở mọi chỗ verify |
| Refresh token plaintext | Lưu phiên đăng nhập | `backend/src/models/refresh-token.model.ts`, `backend/src/services/auth.service.ts` | Rủi ro nếu DB leak; nên lưu hash/HMAC |
| `SHA-256` | Hash OTP và reset token | `backend/src/services/auth.service.ts` | Chấp nhận được cho flow ngắn hạn, nhưng OTP nên dùng HMAC |
| `AES-256-GCM` + `PBKDF2-SHA256` | Mã hóa mật khẩu mới tạm thời trong Redis | `backend/src/utils/encryption.util.ts` | Thuật toán tốt; không nên dùng chung `JWT_SECRET` |
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
- `verifyAccessToken()` và `verifyRefreshToken()` trong `backend/src/utils/jwt.util.ts` đang verify signature/issuer/audience nhưng chưa pin `algorithms`.
- `verifyRefreshToken()` hiện chưa kiểm tra `audience: refresh`, dù lúc ký refresh token đã set audience này.

### Flow login

1. Client gọi `POST /api/v1/auth/login`.
2. Backend xác thực email/password bằng bcrypt.
3. Backend tạo access token bằng `signAccessToken({ userId })`.
4. Backend tạo refresh token bằng `signRefreshToken({ userId })`.
5. Refresh token được lưu vào MongoDB và set vào cookie `httpOnly`.
6. Access token được trả trong response JSON.

### Flow refresh

1. Client gọi `POST /api/v1/auth/refresh-token`.
2. Backend lấy refresh token từ cookie `refreshToken`, nếu không có thì lấy từ body.
3. Backend verify refresh token bằng `JWT_REFRESH_SECRET`.
4. Backend tìm token trong MongoDB, kiểm tra chưa revoke và chưa hết hạn.
5. Nếu hợp lệ, backend trả access token mới.

### Nhận xét

- JWT là token được ký, không phải token được mã hóa. Payload có thể decode để đọc nhưng không thể sửa hợp lệ nếu không biết secret.
- Tách `JWT_SECRET` và `JWT_REFRESH_SECRET` là đúng.
- Nên pin `algorithms: ['HS256']` trong cả `verifyAccessToken()` và `verifyRefreshToken()`.
- Nên thêm `audience: 'refresh'` vào `verifyRefreshToken()` để khớp với lúc ký token.

## 3. Refresh token lưu trong MongoDB

### Hiện trạng

- Model: `backend/src/models/refresh-token.model.ts`.
- Field `token` đang lưu nguyên refresh token và có `unique: true`.
- Login/OAuth tạo refresh token rồi upsert vào MongoDB.
- Refresh token service tìm document theo `{ token, isRevoked: false }`.
- Logout một thiết bị cũng tìm theo token plaintext rồi set `isRevoked = true`.

### Rủi ro

Nếu MongoDB bị leak, attacker có thể dùng refresh token còn hạn để lấy access token mới. Vì refresh token thường sống lâu hơn access token, đây là rủi ro đáng ưu tiên.

### Cải thiện đề xuất

- Lưu `tokenHash` hoặc `tokenDigest` thay vì `token` plaintext.
- Dùng `HMAC-SHA256(refreshToken, REFRESH_TOKEN_HASH_SECRET)` để tránh brute force/offline matching nếu token format có thể đoán được.
- Khi client gửi refresh token, backend tính digest rồi query theo digest.
- Đổi các flow liên quan cùng lúc: login, OAuth callback, refresh, logout một thiết bị, logout all, cleanup token hết hạn.

## 4. OTP và reset token

### Hiện trạng

- OTP được tạo bằng `crypto.randomInt()` trong `backend/src/utils/generate-otp.util.ts`.
- OTP mặc định 6 chữ số.
- OTP/reset token được hash bằng `crypto.createHash('sha256').update(value).digest('hex')`.
- Redis lưu hash, TTL, attempt counter và dữ liệu pending.
- Các flow chính gồm đăng ký, quên mật khẩu, đổi mật khẩu và đổi email.

### Nhận xét

- `crypto.randomInt()` là lựa chọn tốt để tạo OTP.
- TTL và giới hạn số lần thử giúp chống online brute force.
- SHA-256 trần không có secret. Với OTP 6 số, nếu Redis dump bị lộ, attacker có thể brute force offline rất nhanh.
- Nên thay SHA-256 trần bằng `HMAC-SHA256(value, OTP_HASH_SECRET)` hoặc một secret dùng chung có tên rõ ràng hơn, ví dụ `TOKEN_HASH_SECRET`.

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
- Secret đầu vào để derive key hiện là `Env.JWT_SECRET`.

### Nhận xét

- `AES-256-GCM` là lựa chọn phù hợp vì vừa mã hóa vừa kiểm tra toàn vẹn dữ liệu.
- PBKDF2 với `600000` iterations là cấu hình mạnh cho key derivation.
- Điểm cần sửa là secret boundary: encryption không nên phụ thuộc `JWT_SECRET`.
- Nên dùng `ENCRYPTION_SECRET` riêng. Nếu rotate JWT secret, dữ liệu mã hóa tạm trong Redis không nên bị phụ thuộc ngoài ý muốn.

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

1. Dùng `ENCRYPTION_SECRET` riêng cho `AES-256-GCM`/PBKDF2, không dùng `JWT_SECRET`.
2. Lưu refresh token dạng HMAC/digest thay vì plaintext.
3. Pin `algorithms: ['HS256']` trong `verifyAccessToken()` và `verifyRefreshToken()`.
4. Thêm `audience: 'refresh'` khi verify refresh token.
5. Đổi OTP/reset token từ SHA-256 trần sang HMAC-SHA256.
6. Benchmark bcrypt và cân nhắc tăng `saltRounds` từ `10` lên `12`.

## Kết luận

Dự án đang dùng đúng nhóm công cụ chính: bcrypt cho mật khẩu, JWT cho token, AES-GCM cho dữ liệu cần giải mã lại, OTP có TTL và attempt limit. Các điểm cần ưu tiên không nằm ở việc đổi thuật toán lớn, mà ở cách cô lập secret và cách lưu dữ liệu nhạy cảm:

- Secret mã hóa đang dùng chung với `JWT_SECRET`.
- Refresh token đang lưu plaintext trong database.
- OTP/reset token đang dùng SHA-256 trần, dễ brute force offline nếu Redis bị lộ.
- JWT verify nên pin thuật toán và kiểm tra audience nhất quán hơn.
