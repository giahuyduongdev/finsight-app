# Realtime Sync Roadmap

Status: Draft.

## Mục Tiêu

Tổng hợp các realtime sync feature còn thiếu để làm từng phần nhỏ, dễ review và dễ verify.

Không gom tất cả vào một feature lớn vì mỗi nhóm có scope, rủi ro và cách verify khác nhau.

## Đã Có

### Transaction Sync

Events hiện có:

- `transaction:created`
- `transaction:updated`
- `transaction:deleted`
- `transaction:bulk-deleted`

Mục đích:

- Refresh transaction list.
- Refresh analytics khi transaction thay đổi.

Trạng thái: đã có.

### Bulk Import Sync

Events hiện có:

- `bulk-import:progress`
- `bulk-import:completed`
- `bulk-import:failed`

Mục đích:

- Hiển thị tiến độ import.
- Refresh transaction/analytics khi import hoàn tất.

Trạng thái: đã có.

### Recurring Transaction Sync

Event hiện có:

- `recurring-transaction:processed`

Mục đích:

- Báo user khi recurring transactions được xử lý.
- Refresh transaction/analytics sau khi worker chạy xong.

Trạng thái: đã có.

### Receipt Scan Sync

Events hiện có:

- `receipt:scan-completed`
- `receipt:scan-failed`

Mục đích:

- Trả kết quả scan receipt từ backend/worker về frontend.

Trạng thái: đã có.

### Currency Rates Sync

Event hiện có:

- `currency:rates_updated`

Mục đích:

- Cập nhật rates realtime trên rates page/converter.

Trạng thái: đã có.

### User Profile Sync

Event mới:

- `user:profile-updated`

Fields sync:

- `name`
- `profilePicture`
- `timezone`
- `preferredCurrency`

Mục đích:

- Đồng bộ Account Settings giữa nhiều tab/thiết bị.
- Refresh user, analytics, transactions, reports khi timezone/currency đổi.

Trạng thái: đã implement, cần manual verify multi-tab.

## Cần Làm Tiếp

## 1. Report Settings Sync

Đề xuất làm trước.

Event đề xuất:

- `report:settings-updated`

Khi nào emit:

- Sau khi user cập nhật report settings thành công.

Dữ liệu cần sync:

- report frequency
- report enabled/disabled state
- report schedule fields nếu có

Frontend cần làm:

- Listen event trong `useAppSockets`.
- Invalidate/refetch `report`.
- Nếu setting ảnh hưởng dashboard/report preview, invalidate thêm `analytics` khi cần.

Không nên gộp vào:

- `user:profile-updated`

Lý do:

- Report settings là domain riêng, không phải profile field trực tiếp.

Verification:

- Mở hai tab.
- Tab A đổi report settings.
- Tab B tự refresh report settings/list without reload.

## 2. Report Lifecycle Sync

Làm sau Report Settings Sync.

Event đề xuất:

- `report:list-updated`

Hoặc nếu cần rõ hơn:

- `report:generated`
- `report:resent`
- `report:status-updated`

Khi nào emit:

- Worker generate report xong.
- Resend report thành công.
- Report status thay đổi.

Frontend cần làm:

- Invalidate/refetch `report`.
- Show toast nếu event đến từ background worker.

Verification:

- Report page đang mở.
- Backend/worker tạo report mới.
- Report list tự cập nhật.

## 3. Auth/Security Session Sync

Làm riêng, không gộp vào profile/report sync.

Events có thể cần:

- `auth:session-revoked`
- `auth:logout-all`
- `auth:email-updated`

Các flow liên quan:

- change password
- change email
- logout all devices
- token/session revoked

Cần chốt trước khi làm:

- Khi đổi password có logout tất cả tab không?
- Khi đổi email có redirect tất cả tab về login không?
- Khi logout-all ở một tab thì tab khác nhận event và logout ngay hay chỉ khi request tiếp theo fail?

Lý do làm riêng:

- Đây là security-sensitive flow.
- Cần review auth/session/token policy rõ ràng.

Verification:

- Mở hai tab.
- Thực hiện change password/logout-all ở Tab A.
- Tab B phản ứng theo policy đã chốt.

## 4. Analytics Cache Hygiene

Đây là backend cache cleanup, không nhất thiết là socket feature.

Vấn đề:

- Khi timezone hoặc preferredCurrency đổi, analytics cache key cũ có thể còn trong Redis tới TTL/cleanup.
- Dữ liệu trả về vẫn đúng nếu key mới khác key cũ, nhưng Redis có thể còn cache rác.

Đề xuất:

- Khi `timezone` hoặc `preferredCurrency` thay đổi trong user profile update, gọi invalidate analytics cache cho user.

Frontend:

- Không cần event mới.
- Đã có `user:profile-updated` để invalidate/refetch queries.

Verification:

- Update timezone/currency.
- Redis analytics keys cũ của user được xóa.
- Analytics vẫn trả dữ liệu đúng sau update.

## Thứ Tự Đề Xuất

1. Report Settings Sync
2. Report Lifecycle Sync
3. Analytics Cache Hygiene
4. Auth/Security Session Sync

## Feature Không Nên Gom Chung

Không nên làm một feature duy nhất kiểu `full-realtime-sync`.

Lý do:

- Quá nhiều domain khác nhau.
- Dễ khó test multi-tab.
- Auth/security cần policy riêng.
- Worker/report lifecycle có timing khác với profile/settings sync.

## Next Feature Nên Làm

Tên feature đề xuất:

```text
report-settings-sync
```

Lý do:

- Nhỏ nhất.
- Nối tiếp trực tiếp từ `user:profile-updated`.
- Ít rủi ro security hơn auth/session sync.
- Dễ manual verify bằng hai tab.
