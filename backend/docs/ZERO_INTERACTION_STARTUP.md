# PAW — Khởi động không cần thao tác

Mở `/map` tự đọc `/v1/viewer-bootstrap`, tải ảnh/số đo/lịch sử và SSE.
Không có biểu mẫu, token, đăng nhập, chọn khu hoặc chọn nền trong giao diện bản đồ.

## Cấu hình trước bàn giao — quản trị viên, Windows PowerShell

Giữ nguyên `PAW_DATABASE_URL` đang dùng cho PostgreSQL, admin token, gateway key,
ảnh MBTiles và dữ liệu. Không chạy reset/seed/migration cho thay đổi này.
Trong `.env` **backend**, đặt giá trị thật phù hợp hệ thống (ví dụ IP dưới đây chỉ để minh họa):

```dotenv
PAW_VIEWER_FARM_ID=MA-KHU-DA-TON-TAI
PAW_VIEWER_NETWORKS=["192.168.1.50/32"]
PAW_VIEWER_ORIGINS=["http://192.168.1.10:8000"]
PAW_FRONTEND_DIST=C:/PAW/PAW-Frontend/paw-frontend/dist
```

- Farm phải tồn tại với `source=sensor`; không tự tạo khu hay số đo mô phỏng.
- IP `/32` là máy người dùng được cấp quyền xem. Thêm từng máy/điện thoại hoặc subnet
  riêng đã kiểm soát. Mọi máy trong mạng được cho phép có cùng quyền đọc khu đã cấu hình.
- Origins phải là scheme/host/port chính xác của máy chủ và frontend được bàn giao.
  Không dùng wildcard hay mở toàn Internet. Firewall/VPN thuộc triển khai.
- Không có quyền đọc không xác thực khi các giá trị này chưa được thiết lập.
- Cơ chế cấp quyền bằng mạng phù hợp LAN được kiểm soát; nếu cần phân quyền từng người,
  dùng reverse proxy xác thực thiết bị/SSO khi triển khai. Không mở grant cho mạng công cộng.

Build frontend trong thư mục có `package.json`:

```powershell
npm ci
npm run build
```

Sau đó chạy backend bằng Python đã cài dependencies, ví dụ trong thư mục backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --no-proxy-headers
```

Truy cập `http://192.168.1.10:8000`. Khởi động lại dịch vụ sau thay cấu hình.
Không cần Docker/WSL. Không đưa `.env` lên GitHub. Không đặt token vào `VITE_*`.
Frontend mặc định dùng cùng origin, không cần người dùng nhập địa chỉ.
Khi phát triển với Vite riêng, admin đặt `VITE_PAW_API_URL`, `PAW_CORS_ORIGINS`
và các origin/IP được phép trong backend trước khi chạy.

**Reverse proxy:** grant kiểm tra IP socket và Host/Origin, không tin các header
X-Forwarded-For/Host. Tắt proxy headers trong Uvicorn. Không cho phép IP của proxy
nếu proxy còn phục vụ client ngoài mạng đã cấp quyền; proxy phải chặn/kiểm tra quyền
trước khi chuyển tiếp. Không expose cổng backend trực tiếp ra Internet.

## Bảo mật và hành vi

Grant chỉ hoạt động với GET, có vai trò viewer và phạm vi một farm. Bearer không hợp lệ
không được fallback sang grant. POST/PATCH/DELETE, key management và gateway ingest
vẫn cần token và vai trò cũ. SSE kiểm tra grant ở mỗi vòng để dừng khi quyền bị thu hồi.
Không thay DB schema, logic ingest hoặc ACK.

Ảnh được cài và chọn bởi quản trị viên theo quy trình ảnh offline hiện có.
Chưa có ảnh: “Chưa cài đặt dữ liệu ảnh vệ tinh khu vực”, không fallback nền giả/Google.
Chưa cấp quyền: thông báo liên hệ quản trị viên, tự thử lại, không biểu mẫu đăng nhập.

Startup/REST lỗi tự thử lại, có timeout 15 giây. SSE có watchdog heartbeat 45 giây,
retry tăng dần đến 15 giây. Khi mất kết nối, giữ snapshot, lịch sử, heatmap đã tải
trong bộ nhớ và hiển thị thời gian dữ liệu cũ; không coi là cập nhật trực tiếp.
Kết nối lại lấy snapshot SSE và đồng bộ toàn bộ lịch sử để bù điểm bị bỏ lỡ.
GPS mới và heatmap cập nhật bằng setData; không tạo lại map, không tải lại raster
vì có số đo mới. Đóng/reload trang khi server mất sẽ không có cache bền vững;
ứng dụng chờ máy chủ phục hồi, không tự dựng dữ liệu.

## Kiểm thử

Các bài test chỉ dùng database và pixel fixture tạm, không dùng database thật hoặc
thiết bị người dùng. Ảnh chụp có nhãn Test pixels không phải ảnh vệ tinh thực tế.
Xem báo cáo kết quả bàn giao trong câu trả lời và các test `test_viewer_startup.py`,
`workspace.test.tsx`, `e2e-offline/field-offline.spec.ts`.

## Chạy lại kiểm thử offline

Cần Node/Chromium Playwright và Python dependencies imagery/dev đã cài.
Mỗi lượt chạy dùng thư mục database test mới và một `PAW_E2E_PROJECT` (ví dụ
`desktop-1366` hoặc `mobile-360`). Chạy fixture server `tests/offline_e2e_server.py`
với `PAW_E2E_DIR`, `PAW_E2E_FRONTEND_DIST`, `PAW_E2E_PROJECT`. Sau đó đặt
`PAW_E2E_CREDENTIALS` trỏ tới credentials.json trong thư mục test và chạy frontend:

```text
npx playwright test -c playwright.offline.config.ts --project=desktop-1366
```

Dừng server, tạo thư mục fixture mới và chọn project tương ứng khi đổi viewport.
Không build lại dist trong lúc fixture server đang phục vụ build đó.
Artifact offline được ghi riêng vào `test-results-offline/` để không xung đột E2E thường.

## Kết quả xác minh — 19/11/2026 (UTC+7)
- Frontend: 59/59 unit/integration; TypeScript/build, ESLint, Prettier đạt.
- Backend: 42/42 tests SQLite; Ruff và format đạt.
- E2E thường: 12/12, desktop 1920/1366 và mobile 390/360.
- E2E offline: 4/4, desktop 1366 và mobile 360, production build trên FastAPI thật.
- Đã kiểm tra startup tự retry, không biểu mẫu, không request ngoài LAN, marker/popup/zoom/heatmap; số đo mới không tạo map/canvas hoặc nạp lại tile; dữ liệu trong lúc mất mạng được đồng bộ lại và giữ các điểm cũ.
- Cảnh báo còn lại: chunk MapLibre lớn hơn 500 kB; Starlette/httpx deprecation trong backend tests.
- Không thử PostgreSQL/thiết bị thật, Windows thật hoặc ảnh vệ tinh thật của khu đất. Không dùng Docker/WSL; không đổi schema/database thật, ingest hay ACK.
- Thay đổi đang ở workspace; chưa commit/push trong lần này.

## File thay đổi

### paw-frontend

- `paw-frontend/.env.example`
- `paw-frontend/.gitignore`
- `paw-frontend/README.md`
- `paw-frontend/docs/ZERO_INTERACTION_STARTUP.md`
- `paw-frontend/docs/screenshots/enduser-map-test-desktop-1366.png`
- `paw-frontend/docs/screenshots/enduser-map-test-mobile-360.png`
- `paw-frontend/docs/screenshots/enduser-no-imagery-desktop-1366.png`
- `paw-frontend/docs/screenshots/enduser-no-imagery-mobile-360.png`
- `paw-frontend/e2e-offline/field-offline.spec.ts`
- `paw-frontend/e2e/map-providers.spec.ts`
- `paw-frontend/playwright.offline.config.ts`
- `paw-frontend/src/features/field-map/FieldMap.tsx`
- `paw-frontend/src/features/field-map/repository.ts`
- `paw-frontend/src/features/field-map/types.ts`
- `paw-frontend/src/pages/FieldMapPage.tsx`
- `paw-frontend/src/pages/SettingsPage.tsx`
- `paw-frontend/tests/workspace.test.tsx`

### paw-backend

- `.env.example`
- `README.md`
- `app/auth.py`
- `app/config.py`
- `app/main.py`
- `docs/ZERO_INTERACTION_STARTUP.md`
- `docs/openapi.json`
- `tests/offline_e2e_server.py`
- `tests/test_viewer_startup.py`
