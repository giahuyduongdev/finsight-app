# Report Settings Sync - Design

## Context hien tai

Report settings dang duoc update qua:

- `backend/src/controllers/report.controller.ts`
- `backend/src/services/report.service.ts`
- `backend/src/routes/v1/report.routes.ts`
- `backend/src/validators/report.validator.ts`

Client report API hien tai:

- `client/src/features/report/reportAPI.ts`
- tag cache: `report`
- mutation `updateReportSetting` dang invalidate `report`

Socket app hook hien tai:

- `client/src/hooks/use-app-sockets.ts`

## Luong xu ly de xuat

1. Client tab A goi `PATCH /reports/settings`.
2. Backend validate body bang `updateReportSettingSchema`.
3. Service update report setting trong database.
4. Controller map response nhu hien tai.
5. Controller emit `report:settings-updated` den user room.
6. Tab A nhan HTTP response va invalidate `report` qua mutation hien co.
7. Tab B/device khac nhan socket event.
8. Tab B invalidate/refetch `report`.
9. UI doc tu query cache moi.

## Socket contract

Event name:

```ts
report:settings-updated
```

Payload:

```ts
type ReportSettingsUpdatedSocketPayload = {
  userId: string;
  changedFields: Array<'isEnabled' | 'frequency' | 'nextReportDate'>;
  reportSetting: {
    _id: string;
    userId: string;
    frequency: string;
    isEnabled: boolean;
    lastSentDate: string | null;
    nextReportDate: string | null;
  };
  updatedAt: string;
};
```

V1:

```ts
{
  userId: '<current-user-id>',
  changedFields: ['isEnabled'],
  reportSetting: {
    _id: '<setting-id>',
    userId: '<current-user-id>',
    frequency: 'MONTHLY',
    isEnabled: true,
    lastSentDate: null,
    nextReportDate: '<ISO timestamp or null>'
  },
  updatedAt: '<ISO timestamp>'
}
```

## Backend design

### Emit location

Emit trong `updateReportSettingController` sau khi:

- lay duoc `updatedSettings`
- map response thanh cong
- truoc khi return response HTTP

### Derive changed fields

V1 lay changed fields tu request body da validate:

```ts
const changedFields = Object.keys(req.body).filter((field) =>
  ['isEnabled', 'frequency', 'nextReportDate'].includes(field)
);
```

Trong code thuc te co the type-safe hon bang union type, nhung khong can abstraction lon.

### Emit failure handling

Socket emit loi khong duoc lam fail HTTP request.

Behavior:

- catch error
- log warning/error voi `userId`, `changedFields`
- tiep tuc tra response success

## Frontend design

### Listener location

Them listener vao `client/src/hooks/use-app-sockets.ts`.

### Cache behavior

Khi nhan `report:settings-updated`:

```ts
dispatch(updateCredentials({ reportSetting: payload.reportSetting }));
dispatch(apiClient.util.invalidateTags(['report']));
```

Ly do can update Redux: `ScheduleReportForm` hien tai doc `reportSetting` tu `state.auth`, khong doc tu `reportAPI`. Neu chi invalidate `report`, drawer dang mo o tab khac van giu state cu.

### UI behavior

- Khong hien toast mac dinh.
- Cap nhat Redux `auth.reportSetting` tu payload socket.
- Van invalidate `report` de report query/table khong stale.

## Gui report setting payload co gioi han

Payload chi gui report setting da duoc API response public hoa, khong gui thong tin nhay cam. Cach nay phu hop voi frontend hien tai vi Redux `auth.reportSetting` la source cua drawer settings.

Neu sau nay tach report setting thanh RTK Query endpoint rieng, co the quay lai metadata-only event va de client refetch endpoint do.

## Testing plan

Backend:

- Mock `getIO()`.
- Goi `updateReportSettingController`.
- Verify service update duoc goi.
- Verify emit `report:settings-updated` vao dung room user.
- Verify emit failure khong lam controller throw.

Frontend:

- Unit/integration neu setup san co: socket event dispatch invalidate `report`.
- Manual check 2 tab:
  - Tab A update report setting.
  - Tab B tu cap nhat report UI/cache.

## Quyet dinh trong v1

- V1 chi sync `isEnabled`.
- Khong sync report generated/resend trong feature nay.
- Khong them toast notification.
- Khong them source request id de loai event cua current tab, vi mutation invalidation da idempotent va don gian hon.
