# Auth Session Sync - Tóm Tắt Yêu Cầu

## Feature này làm gì?

Feature này đồng bộ các sự kiện kết thúc phiên đăng nhập qua socket realtime.

Ví dụ:

- Tab A bấm logout all.
- Tab B của cùng user tự logout ngay, không cần reload.
- User đổi password/email thành công thì các tab đang mở cũng tự logout.
- User reset password ở flow quên mật khẩu thì các tab đang login cũng nên tự logout nếu backend xác định được user.

Ngoài socket logout-all, feature này còn sync logout thường giữa các tab cùng browser.

Ví dụ:

- Tab A bấm logout thường ở navbar.
- Tab B cùng Chrome profile tự logout theo.
- Thiết bị khác không bị logout.

## Event đề xuất

Dùng một event chung:

```ts
auth:session-revoked
```

Payload chỉ chứa thông tin an toàn:

- `userId`
- `reason`: `logout-all`, `password-changed`, `email-changed`, `password-reset`
- `scope: all-sessions`
- `message`
- `redirectTo: /`
- `revokedAt`

Không gửi token, OTP, password, old email, new email.

## Frontend làm gì khi nhận event?

- Clear Redux auth state.
- Reset RTK Query cache.
- Show toast ngắn.
- Redirect về `/`.

## Logout thường khác gì logout all?

Logout thường:

- gọi `/auth/logout`
- chỉ revoke session hiện tại
- broadcast local để các tab cùng browser logout theo
- không ảnh hưởng thiết bị khác

Logout all devices:

- gọi `/auth/logout-all`
- backend revoke toàn bộ refresh token
- socket `auth:session-revoked` làm mọi tab/device logout

## Backend emit ở đâu?

Emit sau khi flow revoke session thành công:

- logout all
- change password verify OTP
- change email verify OTP
- reset password nếu có `userId`

Nếu socket emit lỗi thì chỉ log, không làm fail API vì session revocation đã là việc chính.

## Điểm quan trọng cần chốt

Socket sync không phải security boundary.

Nếu chỉ làm feature này, các tab có socket sẽ logout realtime. Nhưng access token đã phát ra trước đó có thể vẫn còn hợp lệ tới khi hết hạn, nếu backend chưa có cơ chế `tokenVersion/sessionVersion`.

Có 2 hướng:

1. Làm realtime UX sync trước.
   - Nhanh, ít đụng auth core.
   - Phù hợp với feature hiện tại.

2. Làm hard revoke access token toàn bộ session.
   - Cần thêm `tokenVersion/sessionVersion` vào JWT và middleware.
   - Bảo mật mạnh hơn nhưng là một auth refactor riêng.

Khuyến nghị: feature này làm hướng 1 trước. Nếu muốn chặn access token cũ ngay lập tức ở server thì tách thành feature riêng.
