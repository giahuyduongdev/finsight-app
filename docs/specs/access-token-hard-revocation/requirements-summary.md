# Access Token Hard Revocation - Tóm Tắt Yêu Cầu

## Feature này làm gì?

Feature này làm cho toàn bộ access token cũ của một user bị backend từ chối ngay sau một sự kiện thu hồi toàn bộ phiên.

Các sự kiện áp dụng:

- Logout all devices
- Đổi mật khẩu thành công
- Reset mật khẩu thành công
- Đổi email thành công

Feature không phụ thuộc vào socket. Dù thiết bị khác đang offline hoặc không nhận được socket, access token cũ vẫn không gọi API được.

## Vấn đề hiện tại

Ví dụ:

- Laptop có access token A
- Điện thoại có access token B
- Laptop bấm logout all

Hiện tại backend:

- blacklist token A
- revoke toàn bộ refresh token
- gửi socket yêu cầu điện thoại logout

Nhưng backend không biết token B để blacklist trực tiếp. Nếu điện thoại không nhận socket, token B có thể tiếp tục gọi API cho đến khi hết hạn.

## Cơ chế mới

Mỗi user có một số `tokenVersion`.

Ví dụ ban đầu:

```text
User tokenVersion = 0
Token A tokenVersion = 0
Token B tokenVersion = 0
```

Khi logout all:

```text
User tokenVersion = 1
```

Backend so sánh version trên mỗi request:

- Token A: `0` khác `1` nên bị từ chối
- Token B: `0` khác `1` nên bị từ chối
- Token mới sau khi login: `1` bằng `1` nên được chấp nhận

## Những gì sẽ thay đổi

Backend:

- thêm `tokenVersion` vào User
- thêm `tokenVersion` vào access JWT
- kiểm tra version khi authenticate
- tăng version khi thu hồi toàn bộ session
- tiếp tục revoke refresh token
- tiếp tục blacklist token hiện tại khi logout thường
- tiếp tục gửi socket để UI logout realtime

Frontend:

- không cần thay đổi cơ chế bảo mật
- vẫn xử lý socket để logout và hiện thông báo nhanh
- nếu socket bị mất, request API kế tiếp sẽ nhận `401`

## Logout thường có bị ảnh hưởng không?

Không.

Logout thường:

- chỉ logout session hiện tại
- blacklist access token hiện tại
- revoke refresh token hiện tại
- sync các tab cùng browser
- không tăng `tokenVersion`
- không logout thiết bị khác

Logout all mới tăng `tokenVersion` và vô hiệu hóa token trên mọi thiết bị.

## Redis được dùng như thế nào?

MongoDB là nguồn dữ liệu chính thức của `tokenVersion`.

Redis chỉ nên là cache để giảm số lần đọc MongoDB. Không được để cache cũ làm access token cũ được chấp nhận.

Phương án an toàn nhất cho phiên bản đầu:

- kiểm tra version từ MongoDB trên mỗi authenticated request
- đo hiệu năng
- chỉ thêm Redis cache sau khi có cơ chế chống stale cache rõ ràng

## Các vấn đề cần chốt trước khi làm

### 1. Xử lý access token cũ chưa có `tokenVersion`

**Khuyến nghị:** từ chối token không có version và yêu cầu user đăng nhập lại sau khi deploy.

Ưu điểm:

- bảo mật rõ ràng
- không có giai đoạn token cũ tiếp tục hoạt động

Nhược điểm:

- toàn bộ user đang đăng nhập sẽ phải login lại một lần

Phương án nhẹ hơn là coi token thiếu version bằng `0` trong tối đa 15 phút, nhưng trong thời gian đó hard revocation chưa hoàn toàn chặt.

### 2. Có dùng Redis cache ngay ở phiên bản đầu không?

**Khuyến nghị:** chưa dùng Redis cache cho bước kiểm tra version ở v1.

Lý do:

- cache stale có thể làm token cũ vẫn được chấp nhận
- MongoDB check mỗi request đơn giản và đúng về bảo mật
- cần đo hiệu năng thực tế trước khi thêm độ phức tạp cache

Nếu bắt buộc dùng Redis ngay, phải chốt cơ chế cache coherence và fail-closed trước khi code.

### 3. Khi Redis và MongoDB cùng lỗi thì trả gì?

**Khuyến nghị:** không cho request đi tiếp.

- version mismatch đã xác nhận: trả `401`
- không kiểm tra được do hạ tầng lỗi: trả `503`
- tuyệt đối không fail open

### 4. Có trả `tokenVersion` về frontend không?

**Khuyến nghị:** không.

`tokenVersion` chỉ dùng nội bộ backend:

- không đưa vào user DTO
- không lưu Redux
- không gửi socket
- không ghi raw version hoặc token vào log

## Các quyết định đã chốt

- Dùng account-level `tokenVersion`
- MongoDB là source of truth
- Logout all, đổi/reset mật khẩu và đổi email sẽ tăng version
- Logout thường không tăng version
- Vẫn giữ blacklist hiện tại
- Vẫn revoke refresh token
- Vẫn giữ socket realtime
- Không làm màn hình quản lý thiết bị trong feature này

## Kết quả mong đợi

Sau khi feature hoàn tất:

- logout all vô hiệu hóa ngay access token trên mọi thiết bị
- đổi/reset mật khẩu vô hiệu hóa ngay token cũ
- đổi email vô hiệu hóa ngay token cũ
- thiết bị offline không thể tiếp tục dùng token cũ
- socket chỉ còn phục vụ realtime UX, không còn là lớp bảo mật chính

