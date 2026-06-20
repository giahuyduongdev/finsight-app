# Report Lifecycle Sync - Requirements

## Trang thai

Draft de review.

## Muc tieu

Dong bo lifecycle cua report qua socket realtime, de trang `/reports` o cac tab/device cua cung user tu cap nhat khi report list hoac status thay doi ma khong can reload.

Feature nay khac voi `report-settings-sync`: settings sync chi dong bo bat/tat monthly report, con lifecycle sync dong bo lich su report va trang thai report.

## Pham vi v1

V1 gom cac flow hien co:

- Worker tao report history sau khi job report chay xong.
- Worker tao report `FAILED` khi gui email loi.
- Worker tao report `NO_ACTIVITY` khi khong co du lieu.
- API resend report thanh cong va update report status thanh `SENT`.

## Ngoai pham vi

- Khong sua logic generate report, resend report, cron, queue.
- Khong sua report settings.
- Khong them realtime cho auth/session.
- Khong them report detail page.
- Khong thay doi pagination contract cua `GET /reports`.

## Event de xuat

Dung mot event chung cho v1:

```ts
report:list-updated
```

Ly do:

- Frontend hien tai chi can refetch report list.
- Giam so event phai maintain.
- Van co `reason` trong payload de debug/toast neu can.
- Client chi can dang ky mot listener socket, sau do dua vao `source/status/reason` de quyet dinh invalidate va toast.

Neu sau nay can UI chi tiet hon, co the tach thanh:

- `report:generated`
- `report:resent`
- `report:status-updated`

## Payload de xuat

```ts
type ReportListUpdatedSocketPayload = {
  userId: string;
  reason: 'generated' | 'resent' | 'status-updated';
  reportId?: string;
  status?: 'SENT' | 'FAILED' | 'NO_ACTIVITY' | 'PENDING';
  period?: string;
  source: 'api' | 'worker';
  updatedAt: string;
};
```

## Requirement chuc nang

### R1. Emit khi resend report thanh cong

Sau khi `POST /reports/resend/:reportId` thanh cong va report status duoc update, backend emit `report:list-updated` den room cua user hien tai.

Payload:

- `reason: 'resent'`
- `source: 'api'`
- `reportId`
- `status: 'SENT'`

### R2. Emit khi worker tao report history thanh cong

Sau khi worker commit transaction tao report history va update report setting thanh cong, backend emit `report:list-updated` den room cua user.

Payload:

- `reason: 'generated'`
- `source: 'worker'`
- `reportId` neu lay duoc tu document vua tao
- `status`: `SENT`, `FAILED`, hoac `NO_ACTIVITY`
- `period` neu co

### R3. Emit failure khong lam fail main flow

Neu socket emit loi:

- API resend van tra success neu business flow da thanh cong.
- Worker job khong fail chi vi socket emit fail.
- Backend log warning/error co `userId`, `reason`, `reportId/status` neu co.

### R4. Frontend invalidate report cache

Client lang nghe `report:list-updated` trong `useAppSockets`.

Khi nhan event:

- invalidate/refetch RTK Query tag `report`
- khong update table bang payload socket truc tiep
- de `GET /reports` la source of truth

### R5. Toast chi cho background worker

Da chot:

- `source: 'api'`: khong toast socket vi tab goi API da co UI/toast rieng.
- `source: 'worker'`: co toast, vi report duoc tao tu background job va user co the khong thao tac truc tiep.

Toast text de xuat:

- `SENT`: `Monthly report generated`
- `FAILED`: `Monthly report failed`
- `NO_ACTIVITY`: `No activity found for this report period`

### R6. Worker email failure van emit sau khi persist FAILED

Khi worker gui email loi nhung da persist report record voi status `FAILED`:

- emit `report:list-updated` voi `source: 'worker'`, `status: 'FAILED'`
- client refetch report list va show toast failure
- worker van throw error theo behavior hien tai de BullMQ mark failed/retry/log

Socket emit failure khong duoc che mat email error goc.

## Acceptance criteria

- Tab A resend report thanh cong, tab B dang o `/reports` tu refetch report list khong reload.
- Worker tao report moi, tab dang o `/reports` tu refetch report list khong reload.
- Event chi gui den user room cua report owner.
- User khac khong nhan event.
- Socket emit failure khong lam fail API/worker.
- Worker email failure da persist report `FAILED` thi UI nhan event va refetch, trong khi job van fail/retry theo logic hien tai.
- Backend tests cover resend emit, worker emit, emit failure.
- Frontend test hoac manual verification cover listener invalidate `report`.

## Edge cases

- Worker tao report trong transaction xong moi emit, tranh tab refetch qua som ma chua thay data.
- Resend API update status xong moi emit.
- Event den khi query `/reports` khong subscribed: invalidate tag khong gay loi, khi user vao page sau se fetch binh thuong.
- Multiple report events gan nhau: chap nhan refetch nhieu lan trong v1.
- Socket disconnected: reload/refetch binh thuong van sua duoc state.
