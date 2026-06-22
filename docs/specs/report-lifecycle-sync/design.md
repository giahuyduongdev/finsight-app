# Report Lifecycle Sync - Design

## Context hien tai

Backend:

- `backend/src/controllers/report.controller.ts`
- `backend/src/services/report.service.ts`
- `backend/src/workers/report.worker.ts`
- `backend/src/models/report.model.ts`

Frontend:

- `client/src/features/report/reportAPI.ts`
- `client/src/hooks/use-app-sockets.ts`
- `client/src/pages/reports/_component/report-table.tsx`

Report list hien tai duoc lay qua `getAllReports`, tag cache la `report`.

## Cach tiep can de xuat

Dung mot event chung:

```ts
report:list-updated
```

Payload co `reason` va `source` de phan biet event den tu API hay worker.

Ly do chon mot event chung:

- Frontend action trong v1 giong nhau: invalidate `report`.
- It phan nhanh hon trong socket hook.
- Van show toast duoc bang cach doc `source`, `status`, `reason`.
- Sau nay neu UI can rich notification thi tach event van duoc.

## Backend design

### Shared helper

Nen tao helper nho de emit lifecycle event, co the nam gan report controller/worker hoac tach thanh util trong backend report domain neu dung chung cho controller va worker.

Shape:

```ts
type ReportListUpdatedPayload = {
  userId: string;
  reason: 'generated' | 'resent' | 'status-updated';
  reportId?: string;
  status?: 'SENT' | 'FAILED' | 'NO_ACTIVITY' | 'PENDING';
  period?: string;
  source: 'api' | 'worker';
  updatedAt: string;
};
```

Helper behavior:

- `getIO().to(userId).emit('report:list-updated', payload)`
- catch socket error
- log warning
- khong throw

### Resend API emit point

Trong `resendReportController`:

1. Validate `reportId`.
2. Goi `reportService.resendReport(userId, reportId)`.
3. Sau khi service success, emit:

```ts
{
  userId,
  reason: 'resent',
  reportId,
  status: 'SENT',
  source: 'api',
  updatedAt
}
```

Neu service sau nay tra ve updated report thi payload co the bo sung `period`.

### Worker emit point

Trong `report.worker.ts`, chi emit sau khi transaction tao report history va update report setting da commit thanh cong.

Can luu document report vua tao vao bien de lay:

- `_id`
- `status`
- `period`

Sau transaction success, emit:

```ts
{
  userId,
  reason: 'generated',
  reportId,
  status,
  period,
  source: 'worker',
  updatedAt
}
```

Voi branch email failed:

Da chot:

- cap nhat attempt metadata tren cung delivery record va throw de BullMQ retry
- khong emit terminal event khi con retry
- permanent failure hoac final attempt moi update `FAILED`, advance schedule va emit `report:list-updated`
- socket emit failure khong duoc che mat email error goc

## Frontend design

### Listener

Them listener trong `useAppSockets`:

```ts
socket.on('report:list-updated', handleReportListUpdated);
```

Handler:

```ts
dispatch(apiClient.util.invalidateTags(['report']));
```

Neu `payload.source === 'worker'`, co the hien toast theo status.

Da chot show toast cho worker event:

```ts
if (payload.source === 'worker') {
  if (payload.status === 'SENT') toast.success('Monthly report generated');
  if (payload.status === 'FAILED') toast.error('Monthly report failed');
  if (payload.status === 'NO_ACTIVITY') {
    toast.info('No activity found for this report period');
  }
}
```

Socket event tu `source: 'api'` khong show toast vi API caller da co UI feedback rieng.

### Cleanup

Trong cleanup effect:

```ts
socket.off('report:list-updated', handleReportListUpdated);
```

## Error handling

- API/worker khong fail vi socket emit fail.
- Log phai co du thong tin de trace user/event.
- Client neu payload thieu field van invalidate `report`.

## Test strategy

### Backend unit tests

Controller resend:

- success emit `report:list-updated` vao dung user room.
- emit payload dung `reason/source/reportId/status`.
- socket emit loi van tra HTTP success.

Worker:

- generate success tao report `SENT` va emit sau persistence.
- no activity tao report `NO_ACTIVITY` va emit.
- email attempt failure khong emit; permanent/final failure update mot delivery record va emit mot lan.
- socket emit loi khong lam thay doi ket qua job/business error.

### Frontend tests

Hook socket:

- nhan `report:list-updated` thi dispatch invalidate `report`.
- payload `source: 'worker'` show toast theo `status`.
- payload `source: 'api'` khong show toast.
- cleanup listener khi unmount.

### Manual verification

- Mo 2 tab `/reports`.
- Tab A resend report.
- Tab B tu cap nhat list/status khong reload.
- Chay worker report job.
- Tab dang mo `/reports` tu thay report moi.
