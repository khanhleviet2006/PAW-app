# Cập nhật heatmap desktop và mobile

Ngày 02/11/2026 (UTC+7). Người dùng đã cung cấp ảnh mobile và yêu cầu cả desktop
lẫn mobile hiển thị heatmap. Yêu cầu này thay thế phạm vi không heatmap của lần
triển khai trước; cả hai ảnh đã được dùng làm tham chiếu. Báo cáo T2–T7 cũ giữ
lại làm lịch sử, phần mô tả không nội suy/thiếu ảnh mobile không còn hiện hành.

## Thay đổi

- Dải tím → xanh dương → xanh ngọc → xanh lá → vàng, legend liên tục theo chỉ số.
- IDW p=2 từ tâm polygon **mô phỏng**, lưới 20 đơn vị tương đối, làm mượt SVG
  Gaussian 8 đơn vị; đường đồng mức tính bằng marching squares, bước 24 đơn vị.
  Không phải vị trí cảm biến/GPS thật, không phải phương pháp đã hiệu chuẩn để
  ra quyết định tưới. Label và panel luôn dùng số đo fixture gốc, không lấy giá
  trị nội suy làm số đo. Không ghi dữ liệu mới xuống repository.
- Chỉ dùng điểm có số đo hữu hạn, còn hạn, online, đủ hiệu chuẩn. Không dùng
  trạm không khí chung làm điểm đo tại luống. Offline/stale/thiếu sensor giữ
  màu trạng thái riêng; heatmap được clip vào các polygon hợp lệ. Không nội
  suy trên vùng thiếu dữ liệu. Tối thiểu 3 điểm mới vẽ bề mặt.
- Cảnh báo ngoài ngưỡng vẫn có dấu ! và chữ trong panel; màu heatmap biểu diễn
  giá trị, không thay thế cảnh báo. Giá trị ngoài miền min/max bão hòa ở hai đầu
  dải màu. Thay ngưỡng trong Cài đặt thay miền màu. Lọc vùng không làm đổi các
  điểm neo, chỉ thay vùng hiển thị để không làm đổi nội suy khi lọc.
- Nền tán cây SVG mới, ranh giới polygon và nhãn chọn vùng nổi; tooltip số đo
  được chọn trên desktop. Không dùng ảnh tham chiếu làm lớp tương tác giả.
- Mobile: header tên khu vườn, nhãn DEMO, thanh lớp cuộn ngang, bản đồ cao hơn,
  controls trái/legend phải; bottom sheet thu gọn vẫn có bốn chỉ số và thời gian
  đo gần nhất. Nút mở rộng cho thông tin nguồn/trạng thái/lịch sử đầy đủ.
- Sơ đồ tương đối ở khung hẹp được fit độc lập theo hai trục để tận dụng diện
  tích màn hình; nhãn giữ tỷ lệ chữ, pan quy đổi riêng từng trục. Không sử dụng
  hình này để đo khoảng cách hoặc diện tích địa lý.

## File liên quan

Mới: `src/features/farm-map/heatmap.ts`, `HeatmapLayer.tsx`,
`tests/heatmap.test.ts`, tài liệu này.

Cập nhật: `FarmMap.tsx`, `Legend.tsx`, `WorkspacePage.tsx`,
`src/styles/global.css`, `e2e/workspace.spec.ts`, README và ảnh chụp tại
`docs/screenshots/`. Không thêm dependency; không sửa backend hoặc mở khóa LIVE.

## Kiểm tra

Typecheck, ESLint, 32 tests trong 10 file và production build đạt. E2E kiểm tra
năm viewport 375/768/1024/1366/1440, đổi lớp làm đổi bề mặt, clip loại vùng
không có số đo hợp lệ, chọn vùng, zoom/pan chuột/cảm ứng, sheet/sidebar,
DEMO/LIVE, lịch sử và axe: **20/20 E2E đạt ở lượt cuối**, không có axe violation
trong các màn hình đã quét. `npm run format:check` cũng đạt. Ảnh cập nhật tại
`docs/screenshots/mobile-375.png` và `desktop-1440.png` (kèm các viewport khác).

Không kết nối backend, không thử thiết bị thật; tất cả heatmap vẫn là DEMO.
LIVE vẫn chờ OpenAPI, URL và hợp đồng dữ liệu đã xác minh.
