# Report Settings Sync - Tasks

## Implementation tasks

- [ ] Backend: them socket emit helper nho trong `report.controller.ts`.
- [ ] Backend: derive `changedFields` tu body hop le cua `PATCH /reports/settings`.
- [ ] Backend: emit `report:settings-updated` vao room cua current user sau khi update thanh cong.
- [ ] Backend: catch/log socket emit failure, khong lam fail HTTP response.
- [ ] Backend: them unit test cho emit thanh cong.
- [ ] Backend: them unit test cho emit failure van tra response success.
- [ ] Frontend: them type local cho `report:settings-updated` payload neu can.
- [ ] Frontend: lang nghe event trong `use-app-sockets.ts`.
- [ ] Frontend: update Redux `auth.reportSetting` tu socket payload khi nhan event.
- [ ] Frontend: invalidate/refetch RTK Query tag `report` khi nhan event.
- [ ] Frontend: dam bao cleanup listener khi socket disconnect/unmount.
- [ ] Verification: chay backend unit tests lien quan.
- [ ] Verification: chay client type-check/lint.
- [ ] Manual verification: mo 2 tab, update report setting o tab A, kiem tra tab B cap nhat khong reload.

## Thu tu lam de xuat

1. Backend emit event sau update settings.
2. Backend tests.
3. Frontend socket listener update `auth.reportSetting` va invalidate `report`.
4. Client type-check/lint.
5. Manual two-tab test.

## Khong lam trong task nay

- Khong sua report generation job.
- Khong sua resend report flow.
- Khong them field update moi cho report settings.
- Khong refactor toan bo report API/cache.
- Khong tao notification/toast visible cho user.

## Rủi ro can de y

- Neu report settings UI hien tai khong dung `reportAPI` tag `report`, socket invalidate co the khong lam UI cap nhat. Khi implement can trace component dang doc data tu dau.
- Neu socket room naming khac voi profile sync, phai dung lai dung helper/pattern san co.
- Neu mutation cua current tab da invalidate va socket cung invalidate tiep, co the refetch 2 lan. Chap nhan trong v1 vi don gian va dung.
