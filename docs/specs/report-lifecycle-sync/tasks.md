# Report Lifecycle Sync - Tasks

## Implementation tasks

- [ ] Backend: tao helper emit `report:list-updated` dung chung cho controller va worker.
- [ ] Backend: emit event sau khi `resendReportController` success.
- [ ] Backend: emit event sau khi worker tao report `SENT` thanh cong.
- [ ] Backend: emit event sau khi worker tao report `NO_ACTIVITY`.
- [ ] Backend: emit event sau khi worker persist report `FAILED` do email failure.
- [ ] Backend: catch/log socket emit failure, khong lam fail API/worker.
- [ ] Backend: dam bao email failure goc van throw/retry sau khi emit `FAILED`.
- [ ] Backend: them unit test cho resend API emit success.
- [ ] Backend: them unit test cho resend API emit failure khong fail response.
- [ ] Backend: them worker test cho `SENT`, `NO_ACTIVITY`, `FAILED`.
- [ ] Frontend: them listener `report:list-updated` trong `use-app-sockets.ts`.
- [ ] Frontend: invalidate RTK Query tag `report` khi nhan event.
- [ ] Frontend: show toast cho event co `source: 'worker'` theo `status`.
- [ ] Frontend: khong show socket toast cho event co `source: 'api'`.
- [ ] Frontend: cleanup listener khi unmount.
- [ ] Verification: chay backend unit tests lien quan.
- [ ] Verification: chay client type-check/lint.
- [ ] Manual verification: 2 tab `/reports`, resend report tu tab A, tab B tu refresh.
- [ ] Manual verification: worker tao report moi, tab `/reports` tu refresh.

## Thu tu lam de xuat

1. Tao backend socket helper cho report lifecycle.
2. Gan emit vao resend controller.
3. Gan emit vao report worker sau persistence.
4. Them backend tests.
5. Them frontend listener invalidate `report`.
6. Chay verification.
7. Manual test multi-tab va worker flow.

## Khong lam trong feature nay

- Khong sua report settings sync.
- Khong sua cron schedule.
- Khong sua generate report AI/email logic.
- Khong them endpoint moi.
- Khong thay doi shape response cua `GET /reports`.

## Quyet dinh da chot

- Dung mot event chung: `report:list-updated`.
- Co hien toast cho worker event.
- Voi email failure, emit event `FAILED` sau khi persist record, roi van de BullMQ mark job failed/retry theo behavior hien tai.
- Khong debounce frontend invalidate trong v1.
