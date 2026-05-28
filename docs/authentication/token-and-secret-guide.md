# Hướng dẫn về Token và Secret

Tài liệu này giải thích các loại token và secret backend Finsight đang dùng, đặc biệt là `TOKEN_HASH_SECRET`.

## Tóm tắt nhanh

| Tên | Bản chất | Dùng để làm gì |
| --- | --- | --- |
| `JWT_SECRET` | Secret để ký JWT | Ký và xác minh access token |
| `JWT_REFRESH_SECRET` | Secret để ký JWT riêng | Ký và xác minh refresh token |
| `TOKEN_HASH_SECRET` | Secret cho HMAC hash | Hash OTP, password reset token và refresh token trước khi lưu hoặc so sánh |
| `ENCRYPTION_SECRET` | Secret cho mã hóa | Mã hóa và giải mã dữ liệu tạm cần đọc lại được |

## 1. Token là gì?

Token là một chuỗi dùng để chứng minh một hành động hoặc một phiên đăng nhập là hợp lệ.

Trong project này có một số loại token/mã quan trọng:

- Access token: dùng để gọi API cần đăng nhập.
- Refresh token: dùng để xin access token mới khi access token hết hạn.
- OTP: mã xác thực gửi qua email.
- Password reset token: token dùng trong flow quên/reset mật khẩu.

Các token này không được xử lý giống nhau. Mỗi loại có mục đích riêng và secret riêng.

## 2. Access token dùng `JWT_SECRET`

Access token là JWT ngắn hạn. Backend ký access token bằng `JWT_SECRET`.

Flow đơn giản:

```text
user đăng nhập thành công
  -> backend tạo access token
  -> ký token bằng JWT_SECRET
  -> client dùng access token để gọi API
```

Khi client gọi API:

```text
client gửi access token
  -> backend xác minh bằng JWT_SECRET
  -> nếu hợp lệ thì cho qua
```

Access token không dùng `TOKEN_HASH_SECRET` trong flow hiện tại.

File liên quan:

- `backend/src/utils/jwt.util.ts`
- `backend/src/config/passport.config.ts`

## 3. Refresh token dùng cả `JWT_REFRESH_SECRET` và `TOKEN_HASH_SECRET`

Refresh token có hai việc khác nhau:

1. Ký và xác minh token có hợp lệ không.
2. Lưu token vào database để quản lý phiên đăng nhập, revoke, logout.

Hai việc này dùng hai secret khác nhau.

### 3.1. `JWT_REFRESH_SECRET` để ký và xác minh

Refresh token cũng là JWT, nhưng được ký bằng `JWT_REFRESH_SECRET`, không dùng chung `JWT_SECRET`.

```text
backend tạo refresh token
  -> ký bằng JWT_REFRESH_SECRET
```

Khi refresh:

```text
client gửi refresh token
  -> backend xác minh bằng JWT_REFRESH_SECRET
```

### 3.2. `TOKEN_HASH_SECRET` để hash trước khi lưu DB

Backend không nên lưu refresh token gốc vào MongoDB. Nếu database bị lộ, attacker có thể lấy token đó để chiếm phiên đăng nhập.

Vì vậy backend hash refresh token trước khi lưu:

```text
refresh token gốc + TOKEN_HASH_SECRET
  -> HMAC-SHA256
  -> token hash
  -> lưu token hash vào MongoDB
```

Khi client gửi refresh token lên:

```text
client gửi refresh token gốc
  -> backend hash lại bằng TOKEN_HASH_SECRET
  -> so sánh hash mới với hash trong MongoDB
```

Nghĩa là:

- Client/browser giữ refresh token gốc.
- Database chỉ giữ bản hash.
- Backend cần `TOKEN_HASH_SECRET` để tính lại hash khi cần so sánh.

File liên quan:

- `backend/src/repositories/refresh-token.repository.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/utils/secure-hash.util.ts`

## 4. OTP dùng `TOKEN_HASH_SECRET`

OTP là mã ngắn, thường chỉ có 6 chữ số. Vì OTP ngắn nên nếu lưu plaintext hoặc hash thường, khi Redis/DB bị lộ thì có rủi ro bị brute force.

Backend hiện tại hash OTP bằng HMAC-SHA256 với `TOKEN_HASH_SECRET`.

Flow tạo OTP:

```text
backend tạo OTP, ví dụ 123456
  -> gửi 123456 qua email cho user
  -> hash 123456 bằng TOKEN_HASH_SECRET
  -> lưu hash vào Redis
```

Flow xác minh OTP:

```text
user nhập 123456
  -> backend hash 123456 bằng TOKEN_HASH_SECRET
  -> so sánh với hash đang lưu trong Redis
```

Backend không cần lưu OTP gốc.

File liên quan:

- `backend/src/services/auth.service.ts`
- `backend/src/utils/secure-hash.util.ts`

## 5. Password reset token dùng `TOKEN_HASH_SECRET`

Password reset token cũng là token nhạy cảm. Nếu token gốc bị lộ, người khác có thể reset mật khẩu.

Vì vậy backend hash reset token trước khi lưu hoặc so sánh:

```text
reset token gốc + TOKEN_HASH_SECRET
  -> HMAC-SHA256
  -> reset token hash
```

Khi user gửi reset token về, backend hash lại token đầu vào rồi so sánh với hash đã lưu.

File liên quan:

- `backend/src/services/auth.service.ts`
- `backend/src/utils/secure-hash.util.ts`

## 6. `TOKEN_HASH_SECRET` không phải mỗi token một cái

`TOKEN_HASH_SECRET` là một secret chung của server.

Ví dụ:

```text
TOKEN_HASH_SECRET=server-secret

otp 123456       + server-secret -> hash A
refresh token X  + server-secret -> hash B
reset token Y    + server-secret -> hash C
```

Tất cả cùng dùng một `TOKEN_HASH_SECRET`, nhưng đầu vào khác nhau nên hash đầu ra khác nhau.

Không cần tạo `TOKEN_HASH_SECRET` riêng cho từng user hoặc từng token.

## 7. Vì sao backend bị crash khi thiếu `TOKEN_HASH_SECRET`?

Backend load env ở:

```text
backend/src/config/env.config.ts
```

Trong đó có dòng:

```ts
TOKEN_HASH_SECRET: getEnv('TOKEN_HASH_SECRET')
```

`getEnv()` sẽ throw error nếu biến bắt buộc không tồn tại.

Vậy khi `backend/.env` thiếu `TOKEN_HASH_SECRET`, app dừng lại ngay lúc start:

```text
Error: Enviroment variable TOKEN_HASH_SECRET is not set
```

Đây là lỗi cấu hình runtime, không phải lỗi TypeScript hay ESLint. Vì vậy `type-check` và `lint` vẫn pass.

## 8. Nên đặt giá trị như thế nào?

Local development có thể dùng một chuỗi dài bất kỳ, miễn là không để trống:

```env
TOKEN_HASH_SECRET=dev-token-hash-secret-change-me-local-only
```

Production nên dùng chuỗi random mạnh, không commit lên git:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Giá trị sinh ra sẽ có dạng:

```text
4f7c... một chuỗi hex dài
```

Dùng giá trị đó trong biến môi trường production.

## 9. Khác nhau giữa hash và mã hóa?

Hash là một chiều:

```text
token gốc -> hash
hash -> không giải ngược về token gốc
```

Mã hóa là hai chiều:

```text
dữ liệu gốc -> ciphertext
ciphertext -> giải mã về dữ liệu gốc nếu có secret
```

Trong project này:

- `TOKEN_HASH_SECRET` dùng cho hash một chiều bằng HMAC-SHA256.
- `ENCRYPTION_SECRET` dùng cho mã hóa/giải mã dữ liệu tạm cần đọc lại.

Vì refresh token, OTP và reset token chỉ cần so sánh, backend không cần đọc lại token gốc. Do đó dùng hash là đúng.

## 10. Bảng mapping cần nhớ

| Dữ liệu | Secret dùng | Lưu ở đâu | Ghi chú |
| --- | --- | --- | --- |
| Access token | `JWT_SECRET` | Client memory/response | Dùng để gọi API |
| Refresh token JWT | `JWT_REFRESH_SECRET` | HttpOnly cookie ở client | Dùng để xin access token mới |
| Refresh token hash | `TOKEN_HASH_SECRET` | MongoDB | DB lưu hash, không lưu token gốc |
| OTP hash | `TOKEN_HASH_SECRET` | Redis | So sánh OTP user nhập |
| Password reset token hash | `TOKEN_HASH_SECRET` | Redis hoặc storage tạm theo flow | So sánh reset token user gửi về |
| Dữ liệu tạm cần giải mã | `ENCRYPTION_SECRET` | Redis | Dùng AES-GCM để giải mã lại |

## Kết luận

`TOKEN_HASH_SECRET` là secret nội bộ của backend để tạo HMAC hash cho các token/mã nhạy cảm mà backend chỉ cần so sánh, không cần đọc lại giá trị gốc.

Trong code hiện tại, nó được dùng cho:

- OTP: `hashOtp()`
- Password reset token: `hashResetToken()`
- Refresh token: `hashRefreshToken()`

Nó không thay thế `JWT_SECRET` hay `JWT_REFRESH_SECRET`. Access token và refresh token vẫn cần JWT secret để ký/xác minh JWT. Riêng refresh token còn được hash bằng `TOKEN_HASH_SECRET` trước khi lưu vào database.
