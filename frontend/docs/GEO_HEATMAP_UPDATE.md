# Heatmap liên tục trên Leaflet — 03/11/2026

Yêu cầu mới nhất thay tô từng polygon bằng heatmap chuyển màu liên tục như ảnh.
Giữ bản đồ Leaflet, OSM attribution, zoom/pan, chọn vùng, marker và panel hiện có.

`GeographicHeatmap.tsx` đặt SVGOverlay theo bounds từ cùng phép biến đổi GeoJSON;
bề mặt IDW p=2 và contour marching squares dùng lại module đã kiểm thử. Pane
350 nằm dưới viền polygon và nhãn, không chặn click. Polygon có số đo hợp lệ
được đặt fillOpacity=0: màu thực sự xuyên qua ranh giới, không gradient riêng
trong từng ô. Lớp trạng thái vẫn dùng màu phân loại khi người dùng chủ động chọn.

Không nội suy từ offline, stale, thiếu sensor, trạm dùng chung hoặc đất chưa hiệu
chuẩn; clip không phủ các vùng đó. Nhãn và panel dùng số đo gốc. IDW tại tâm vùng
là minh họa DEMO, không phải kết quả khảo sát hoặc khuyến nghị tưới.

Miền màu tách khỏi ngưỡng cảnh báo: nhiệt độ 23–28°C, độ ẩm KK 50–90%RH,
đất 20–60%, pH 5,5–7,5. Legend có ≤/≥ cho giá trị bão hòa ở hai đầu dải.
Ngưỡng cảnh báo trong Cài đặt không bị thay đổi. Map module tải lazy để tách
Leaflet khỏi app chunk; không tăng giới hạn warning để che kích thước bundle.

File mới: `src/features/geo-map/GeographicHeatmap.tsx`.
Sửa: geo-map/FarmMap, WorkspacePage, environment config/Legend, README,
E2E geographic và ảnh `docs/screenshots/t4-*.png`.

Kiểm tra: typecheck, lint, 36 tests và build; 4 E2E ở 1920×1080, 1366×768,
390×844, 360×800. E2E xác minh bề mặt hiện, polygon có fill-opacity 0, đổi lớp
thay màu và không mất lựa chọn; offline/thiếu pH bị loại khỏi mask; thao tác
panel, fit/zoom, bottom sheet và requests chỉ ngoài app tới dịch vụ tile OSM.

Giới hạn: nền OSM còn bị từ chối trên mạng cloud. Chưa thử thiết bị thật, chưa
kết nối API hoặc push thay đổi lên GitHub. Báo cáo T4 trước đây là lịch sử.
