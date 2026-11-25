# Báo cáo: một bản đồ PAW dành cho người sử dụng cuối

Ngày 19/11/2026 (UTC+7). Chỉnh sửa trực tiếp trong hai workspace; không commit/push GitHub. Không chạy Docker, WSL hoặc thay dữ liệu PostgreSQL.

## Kết quả

- `/map` là màn hình bản đồ duy nhất. `/` và `/field-map` chuyển về `/map`, menu còn một mục “Bản đồ quan trắc”.
- Gỡ UI “Loại bản đồ”, toàn bộ renderer Google/Leaflet/Farm Schematic và dependencies tương ứng. Vite build chỉ có renderer MapLibre, worker local; không có bundle Google/Leaflet hay nguồn tile ngoài PAW.
- Giao diện header tối, badge Offline, vùng ảnh lớn, thanh thông số gọn, zoom/fit, marker và popup cảm biến. Có tìm cột và danh sách điểm lịch sử; giữ chọn chỉ tiêu/độ sâu, bật/tắt/độ đậm heatmap.
- Người dùng không chọn bộ ảnh, không thấy import/GeoTIFF/MBTiles hoặc cấu hình máy chủ. Mã khu vực và mã truy cập được nhập ở đầu phiên; URL API do quản trị viên cấu hình. Không đưa token vào VITE, localStorage hoặc file mã nguồn.
- Server cung cấp **một ảnh đang dùng** qua `/v1/farms/{farm}/imagery/active`. Admin cấu hình `PAW_ACTIVE_IMAGERY_IDS`. Nếu có đúng một bộ ảnh, dùng bộ duy nhất. Có nhiều bộ nhưng chưa chọn, hoặc ID được chọn bị thiếu/sai farm → không chọn bừa bộ khác.
- Thiếu ảnh: hiển thị chính xác **“Chưa cài đặt dữ liệu ảnh vệ tinh khu vực”**, không tạo canvas/renderer hoặc sơ đồ thay thế. Số đo đã lưu vẫn giữ trong dữ liệu/lịch sử.
- Dữ liệu mới dùng SSE + setData/paint/layout; không khởi tạo map/raster lại, không reset camera. Mỗi số đo gắn với GPS deployment ban đầu, không di chuyển điểm cũ theo vị trí node mới.
- Các model/fixtures, mô phỏng, chất lượng/phân loại số đo, history, alerts, ingestion/ACK, FastAPI và PostgreSQL sẵn có được giữ. Màn hình lịch sử/cảnh báo cũ giữ cơ chế DEMO/LIVE sẵn có, không tự coi dữ liệu mô phỏng là LIVE.

## File chính

### Frontend

Sửa routes/shell tại `src/app/AppRoutes.tsx`, `src/components/layout/AppShell.tsx`; `WorkspacePage.tsx` chỉ còn compatibility export về màn hình thống nhất.

Sửa giao diện và luồng đọc tại `src/pages/FieldMapPage.tsx`, `src/features/field-map/FieldMap.tsx`, `repository.ts`, `src/components/mapcn/Map.tsx`, `src/styles/global.css`. Popup cập nhật anchor theo kích thước nội dung, không bị cắt khi mở thông tin; điểm từ danh sách đưa người dùng về vùng bản đồ.

Sửa package/lock/tsconfig, `.env.example`, README, nội dung liên kết ở `SimulationPage.tsx`, trạng thái rỗng ở `HistoryPage.tsx`. Không thay source data của cảm biến.

Xóa `src/features/map-providers/*`, `src/features/geo-map/*` và `src/features/farm-map/FarmMap.tsx`. Giữ các hàm xử lý heatmap, số đo và domain model còn dùng trong tests/mô phỏng. Xóa test dành riêng cho engine đã bỏ và thay tests UI/routing/E2E để kiểm tra các hành vi mới, không dùng skip để che lỗi.

### Backend

Sửa `app/config.py`, `app/imagery.py`, `.env.example`, sinh lại `docs/openapi.json`, bổ sung tài liệu quản trị và thay file. Catalog cũ vẫn có cho tương thích; không có UI người dùng quản lý catalog. Công cụ `app.import_imagery` được giữ nguyên, chạy bởi quản trị viên trên máy chủ.

Không đổi model, migration, database, ingest/ACK, timestamp hoặc GPS đã lưu. Endpoint mới chỉ đọc thông tin ảnh đã lưu.

Danh sách đầy đủ file thêm/thay/xóa và checksum được kèm trong `FILE_CHANGES.md` / `manifest.json` của gói cập nhật cục bộ.

## Kiểm thử

- TypeScript, ESLint, Prettier và production build: đạt. Build không còn chunk Google/Leaflet.
- Frontend: 57/57 unit/integration tests đạt, gồm kiểm tra đồng nhất routes, không còn chọn nền, thông báo thiếu ảnh, lớp dữ liệu/depth, giữ GPS cũ, popup/logout, history/alerts/mô phỏng.
- Backend: 39/39 tests SQLite đạt; gồm active image không fallback và phân quyền. `alembic check` không yêu cầu migration.
- E2E thường: 12/12 đạt trên desktop 1920/1366 và mobile 390/360; kiểm tra routes thống nhất, không gọi nguồn ngoài, lỗi xác thực không tạo bản đồ giả, và simulator/history/alerts còn hoạt động.
- E2E offline: 8/8 đạt, 21,4 giây, ở desktop 1920/1366 và mobile 390/360; gồm nhấn/chạm marker, zoom, popup không bị cắt, không ảnh và không request ngoài LAN.

E2E offline dùng production Vite build do FastAPI phục vụ trên loopback, chặn HTTP origin ngoài máy chủ thử. MapLibre/WebGL/worker chạy thật, kiểm tra chạm/nhấn marker, zoom, popup trong vùng bản đồ, cập nhật GPS qua SSE, canvas và camera giữ nguyên, số tile/REST bootstrap không tăng do gói đo. Bài thiếu ảnh kiểm tra đúng thông báo, không có canvas/nguồn thay thế và không có công cụ nhập/chọn ảnh.

Test fixtures GPS và pixel tổng hợp chỉ tồn tại trong thư mục/database thử, có nhãn TEST ONLY. Không đưa fixtures vào dữ liệu vận hành hoặc dùng chúng làm bằng chứng ảnh vệ tinh thật đã cài.

## Bàn giao và giới hạn

- Gói ZIP chia payload frontend/backend, checksum và hướng dẫn PowerShell. Công cụ chuẩn Python kiểm tra bản gốc (hỗ trợ LF/CRLF), backup trước khi sửa, chặn xung đột, có restore. Không có lệnh Git/network, không đổi .env/database/ảnh.
- Chưa có GeoTIFF/MBTiles thực của khu đất trong workspace; ảnh tham chiếu người dùng gửi không được dùng như ảnh có GPS. Để thấy đồi chè thật cần quản trị viên nhập bộ ảnh được phép lưu offline, đúng CRS/AOI và đặt active ID.
- Offline nghĩa là WAN mất nhưng LAN/máy chủ PAW vẫn hoạt động. Không dùng PWA để giả dữ liệu khi server cũng mất kết nối. Ngắt SSE làm dừng heatmap hiện tại; marker lịch sử giữ lại với thời gian đo.
- Chưa kết nối database PostgreSQL và thiết bị thật của người dùng; không chạy Docker/WSL. Không có migration mới hoặc thao tác ghi lên database thật.
- Có warning chunk MapLibre >500kB của Vite và deprecation warning Starlette/httpx trong test backend, không suppress hoặc tắt kiểm tra.
- Chưa chạy Windows thật; các script thay file được kiểm tra trên các bản sao source tạm trước bàn giao. Lịch sử reports T0–T8/OFFLINE_MAP được giữ như tài liệu các giai đoạn trước; bản này thay thế mô tả nhiều renderer ở các báo cáo đó.
