# Tóm Tắt Requirements: Socket Profile Sync

Trạng thái: Draft.

## Mục Tiêu Ngắn Gọn

Khi user cập nhật Account Settings ở một tab hoặc thiết bị, các tab/thiết bị khác đang mở app sẽ nhận biết phần dữ liệu nào đã thay đổi và tự refresh đúng phần cache thông qua socket hiện có.

## Feature Này Thêm Gì

Thêm một socket event mới cho profile/account settings:

```txt
user:profile-updated
```

Event này dành cho thay đổi profile và settings của user, không dành cho thay đổi transaction.

Các field sync ở phiên bản đầu:

- `name`
- `profilePicture`
- `timezone`
- `preferredCurrency`

Các field có thể thêm sau:

- report settings, nếu sau này được lưu chung trong cùng flow Account Settings
- locale hoặc formatting preferences, nếu sau này app có thêm

## Khi Field Thay Đổi Thì Làm Gì

Nếu `timezone` thay đổi:

- refresh user/account cache
- refresh analytics
- refresh transaction lists có phụ thuộc date range và timezone
- refresh reports có phụ thuộc timezone boundary

Nếu `preferredCurrency` thay đổi:

- refresh user/account cache
- refresh analytics
- refresh reports

Nếu `name` hoặc `profilePicture` thay đổi:

- refresh user/account cache
- cập nhật account/navbar UI sau khi refetch

## Quan Hệ Với Transaction Socket Events

Feature này không thay thế các transaction socket events hiện có.

Transaction events hiện có:

- `transaction:created`
- `transaction:updated`
- `transaction:deleted`
- `transaction:bulk-deleted`

Các event đó vẫn tiếp tục xử lý khi transaction thật sự được tạo, sửa, xóa hoặc bulk delete.

Event mới `user:profile-updated` xử lý các thay đổi profile/settings có thể ảnh hưởng dữ liệu phát sinh từ transaction. Ví dụ: đổi timezone không sửa transaction nào, nhưng có thể làm kết quả date range thay đổi. Vì vậy khi nhận profile event có field `timezone`, frontend cần invalidate transaction queries liên quan.

## Data Flow Đơn Giản

1. User cập nhật Account Settings ở Tab A.
2. Backend lưu thay đổi.
3. Backend emit `user:profile-updated` vào socket room của user đó.
4. Tab B nhận event.
5. Tab B invalidate các RTK Query tags bị ảnh hưởng.
6. Các query đang active refetch dữ liệu mới từ API.

## Payload Đề Xuất

```ts
{
  userId: string,
  changedFields: ['timezone', 'preferredCurrency'],
  updatedAt: string
}
```

Payload nên nhỏ và chỉ mô tả field nào thay đổi. Không gửi password, tokens, OAuth IDs, hoặc full user document qua socket.

## Acceptance Criteria

- Đổi timezone ở một tab sẽ refresh analytics, reports, và transaction date-range data ở tab khác.
- Đổi preferred currency ở một tab sẽ refresh analytics và reports ở tab khác.
- Đổi name/profile picture ở một tab sẽ refresh account UI ở tab khác.
- Các transaction socket events hiện có vẫn hoạt động như cũ.
- Nếu miss socket event, state không bị sai vĩnh viễn vì HTTP refetch vẫn là nguồn dữ liệu chính xác.

## Quyết Định Đã Chốt

- Report settings không đi chung `user:profile-updated` ở v1. Nếu cần realtime riêng cho report settings, tạo event riêng sau.
- Frontend dùng current-user refetch path qua `GET /users/me` để tab khác cập nhật auth user/profile.
- Tab vừa thực hiện update không cần bỏ qua event của chính nó ở v1. Refetch nhẹ là chấp nhận được để giữ event contract đơn giản.
