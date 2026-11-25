# T3 — Bản đồ tương tác

- `data/mock/geometry.ts`: 12 polygon có ID cố định A-01…C-04 trong hệ tương đối
  1100×720, diện tích mô phỏng; không phải tọa độ GPS.
- `data/mock/fixtures.ts`: sensor/measurement tách khỏi geometry.
- `features/farm-map/FarmMap.tsx`: SVG polygon thật, không phải ảnh với nút chồng
  lên. Cây, đường và nhà kính cũng là hình SVG minh họa.
- Click/tap hoặc Enter/Space chọn vùng; đường viền và dấu ✓ chỉ rõ lựa chọn.
  Mã vùng/giá trị có nhãn tương phản, giữ kích thước đọc được theo viewport/zoom.
- Zoom giới hạn, pan bằng Pointer Events (chuột/cảm ứng), pointer capture khi kéo,
  ngưỡng kéo 5px để phân biệt với tap. Không kéo tiếp sau pointerup/pointercancel.
  Có fit toàn bộ; không yêu cầu pinch-to-zoom, dùng nút ±.
- Fullscreen là chế độ phủ viewport trong ứng dụng, Escape để thoát.
- Tìm theo mã/tên, cập nhật `?plot=` để có deep link tới vùng. Chú giải thu gọn
  được; vùng bị thanh nổi che vẫn chọn được qua tìm kiếm hoặc bàn phím.

Kiểm thử tăng dần: model nhất quán, ID, dữ liệu không đổi khi refresh; chọn bằng
chuột/bàn phím, zoom/fit không đổi selection. T7 bổ sung pan, touch giả lập và
kiểm tra kích thước màn hình thật của browser. Không dùng map tile/key/GPS.
