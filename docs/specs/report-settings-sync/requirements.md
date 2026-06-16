# Report Settings Sync - Requirements

## Trang thai

Draft de review.

## Muc tieu

Dong bo thay doi report settings cua user qua socket realtime, de khi user cap nhat setting o mot tab/device thi cac tab/device khac cua cung user tu refresh du lieu lien quan ma khong can reload trang.

## Pham vi v1

Backend hien tai chi cho phep cap nhat report setting qua:

- `PATCH /reports/settings`
- Body hop le hien tai: `isEnabled`

Vi vay v1 chi sync truong:

- `isEnabled`

Nhung truong co trong model/response nhu `frequency`, `nextReportDate`, `lastSentDate` chi duoc chuan bi trong thiet ke theo huong mo rong, chua bat buoc implement neu API update chua ho tro.

## Ngoai pham vi

- Khong sync lifecycle cua report generated/sent/resend.
- Khong thay doi logic cron/job tao report.
- Khong thay doi auth/session/socket room.
- Khong thay doi profile sync da lam truoc do.
- Khong them UI moi cho report settings neu UI hien tai chua co.

## Actor

- User dang dang nhap tren nhieu tab.
- User dang dang nhap tren nhieu device.

## Requirement chuc nang

### R1. Emit socket sau khi update thanh cong

Khi `PATCH /reports/settings` update database thanh cong, backend phai emit event realtime cho dung user do.

Event du kien:

```ts
report:settings-updated
```

### R2. Chi emit vao user room

Event chi duoc gui den room cua user hien tai, khong broadcast global.

### R3. Payload chua report setting moi nhat

Drawer report settings hien tai doc tu Redux `auth.reportSetting`, khong doc truc tiep tu RTK Query `report`. Vi vay payload can gui kem report setting moi nhat de tab/device khac cap nhat Redux ngay lap tuc.

Payload de xuat:

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

V1 thuc te chi can gui:

```ts
{
  changedFields: ['isEnabled'],
  reportSetting: '<latest report setting response data>'
}
```

### R4. Client lang nghe va invalidate report cache

Client phai lang nghe `report:settings-updated` trong app socket hook hien tai.

Khi nhan event hop le:

- update Redux `auth.reportSetting` bang `reportSetting` trong payload
- invalidate/refetch RTK Query tag `report`
- khong can hien toast mac dinh vi day la sync nen im lang
- UI lien quan den reports/report settings phai cap nhat theo cache moi

### R5. Tab hien tai van cap nhat qua HTTP mutation

Tab goi `PATCH /reports/settings` van phai cap nhat nhu hien tai bang RTK Query mutation invalidation. Socket event dung chu yeu cho tab/device khac.

### R6. Mat socket event khong lam hong state lau dai

Neu socket disconnected hoac client bo lo event, du lieu van duoc sua dung lai khi:

- refetch query binh thuong
- reload page
- user quay lai route co query report

## Edge cases

- Update thanh cong nhung socket emit loi: API van tra success, backend log warning/error.
- Khong co field nao thay doi: co the khong emit hoac emit voi `changedFields` rong, tuy nhien de don gian v1 nen chi emit khi request body co field hop le.
- Client nhan event field khong biet: invalidate `report` de tranh stale cache.
- User toggle nhanh nhieu lan: cache refetch co the bi goi nhieu lan, nhung ket qua cuoi cung phai theo database.
- User khong co report setting: giu behavior hien tai cua service/controller, khong them logic moi neu khong can.

## Acceptance criteria

- Sau khi user update `isEnabled` o tab A, tab B cua cung account cap nhat report-related UI ma khong reload page.
- Backend chi emit sau khi service update thanh cong.
- Event khong gui sang user khac.
- Socket emit failure khong lam fail HTTP request.
- RTK Query cache `report` duoc invalidate/refetch khi client nhan event.
- Test backend cover event emit va emit failure.
