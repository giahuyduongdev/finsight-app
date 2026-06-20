# Analytics Cache Hygiene - Tóm Tắt Yêu Cầu

## Feature này làm gì?

Feature này cleanup Redis analytics cache khi user đổi:

- `timezone`
- `preferredCurrency`

Không thêm socket mới. Frontend đã có `user:profile-updated` để refetch analytics/report.

## Vì sao cần làm?

Analytics cache key hiện có dạng:

```text
analytics:<type>:<userId>:<range>:<timezone>:<preferredCurrency>:<from>:<to>
```

Khi user đổi timezone/currency, key mới khác key cũ nên dữ liệu thường vẫn đúng. Nhưng key cũ vẫn nằm trong Redis tới khi hết TTL, gây cache rác và khó debug.

## Làm ở đâu?

Backend `user.controller.ts`, sau khi update profile thành công.

Nếu request có `timezone` hoặc `preferredCurrency`, gọi:

```ts
invalidateUserAnalyticsCache(userId)
```

## Không làm gì?

- Không thêm socket event mới.
- Không đổi frontend.
- Không đổi analytics cache key format.
- Không đổi TTL.
- Không flush toàn bộ Redis.

## Cần test gì?

- Update `timezone` thì invalidate analytics cache.
- Update `preferredCurrency` thì invalidate analytics cache.
- Update cả hai thì chỉ invalidate một lần.
- Update `name` hoặc `profilePicture` thì không invalidate.
- Redis invalidation lỗi thì profile update vẫn success.

