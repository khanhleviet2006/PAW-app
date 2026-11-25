# T4 — Leaflet / GeoJSON, desktop và mobile

Bàn giao 03/11/2026 (UTC+7), theo yêu cầu mới nhất. T4 này thay thế heatmap nội
suy trong UI hiện hành. Component SVG/IDW và kiểm thử cũ được giữ làm lịch sử,
không được import vào trang bản đồ hiện tại.

## Đã thực hiện

- React Leaflet + Leaflet, 12 polygon GeoJSON sinh từ hình học DEMO hiện có.
  Tọa độ giả lập gần Đà Lạt, không phải ranh giới đất hoặc vị trí sensor khảo sát.
- Chọn click/tap/Enter/Space, highlight, nhãn số đo, tooltip, zoom/pan, fit toàn
  vườn; invalidateSize khi viewport thay đổi. Cụm cảm biến hiển thị chấm có
  tooltip số lượng và nhãn vị trí giả lập; chưa có tọa độ từng thiết bị.
- OSM HTTPS và attribution copyright luôn hiện. URL, attribution, maxZoom tại
  `src/features/geo-map/config.ts`, có thể thay nhà cung cấp có quyền sử dụng.
  Không tải hàng loạt, prefetch, lưu offline hoặc ép cache bỏ qua chính sách OSM.
- Bốn metric có palette khác nhau và ngưỡng riêng, thêm lớp trạng thái tổng hợp.
  Offline/quá hạn/thiếu dữ liệu giữ màu riêng; không nội suy, không bịa số đo.
- Bản đồ full chiều ngang workspace, panel overlay. Chọn vùng cập nhật tab chi
  tiết; click mở. Dock có pin, giữ nội dung đang focus. Sidebar mở khi hover và
  focus; ghim vẫn phủ bản đồ, không thay margin nội dung.
- Mobile ba mức: tên/trạng thái, số đo chính, nội dung đầy đủ gồm lịch sử.
  Vuốt tay nắm lên/xuống tăng/giảm mức, nút nhấn thay mức, có đóng và bàn phím.
  DEMO và nguồn/thời gian/UNKNOWN trước PAW được giữ nguyên; không điều khiển tưới.

## Kiểm tra và giới hạn

- Typecheck strict, lint và 36 tests trong 12 file đạt; build đạt.
- E2E mới 4/4 trên 1920×1080, 1366×768, 390×844, 360×800: GeoJSON selection,
  lớp không mất lựa chọn, no-sensor, OSM attribution, fit/zoom, sheet bằng chạm
  giả lập CDP, không tràn ngang, không pageerror. Requests ngoài app chỉ tới
  `tile.openstreetmap.org`, không backend cảm biến.
- Các E2E SVG trước đây được chuyển vào `e2e/legacy/` (không chạy mặc định vì
  kỳ vọng heatmap không còn phù hợp); unit regression/domain/API vẫn chạy.
- Browser Chromium giả lập, chưa Windows hoặc thiết bị thật. jsdom cần shim
  createSVGRect/ResizeObserver vì không có layout; browser kiểm tra map thật.
- **Nền tile chưa xác minh hiển thị thành công:** OSM từ chối môi trường cloud,
  phản hồi có `x-blocked: Access denied` và liên kết chính sách OSM. UI báo lỗi
  tile, polygon vẫn dùng được. Không né chặn, không đổi host/giả mạo client.
  Cần thử mạng trình duyệt triển khai thật hoặc chọn provider phù hợp chính sách.
- Chưa có tọa độ khảo sát/sensor GPS thật, cụm marker dùng tâm vùng DEMO dịch
  nhẹ để tránh nhãn che. Chưa nghiệm thu GIS hoặc khoảng cách/diện tích thật.
- Không sửa backend/database/WPF, không API thật, không deploy hoặc push thay
  đổi này. Dừng tại T4.

## File thay đổi

Mới: `src/features/geo-map/config.ts`, `src/features/geo-map/FarmMap.tsx`,
`tests/geo-map.test.ts`, `e2e/geographic.spec.ts`, tài liệu này và ảnh
`docs/screenshots/t4-*.png`.

Sửa: package/lockfile, `WorkspacePage`, `AppShell`, `AreaDetails`, config/status/
Legend môi trường, CSS, Playwright config, setup và workspace tests, README.
Các component layer polygon, marker, controls nằm trong module FarmMap để
tránh tạo logic trùng; GeoJSON/config, domain, fixtures và repository vẫn tách.

## Windows

Node 24 LTS >=24.15; trong PowerShell tại `paw-frontend`:

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Cần Internet để tải tile; DEMO không cần API/backend/key. Nếu PowerShell chặn
npm.ps1 thì dùng npm.cmd. Trên Windows không cần PLAYWRIGHT_BROWSERS_PATH.
Lần sau cần tọa độ farm/sensor đã xác minh và kiểm tra nhà cung cấp tile trên
mạng triển khai, không tự động chuyển sang tích hợp backend.
