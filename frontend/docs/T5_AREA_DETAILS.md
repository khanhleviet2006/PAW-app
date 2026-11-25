# T5 — Chi tiết vùng và giám sát trước PAW

`AreaDetails` hiển thị tên/mã vùng, diện tích nếu có, số cảm biến, tổng trạng thái,
bốn số đo, đơn vị, thời gian đo từng chỉ số, nguồn, thời điểm đo/nhận gần nhất.
Thiếu sensor hiện “Chưa có cảm biến”, không điền số. Nguồn trạm chung tại C-01
được ghi rõ là trạm không khí chung mô phỏng. Timestamps ISO; hiển thị UTC+7.

Panel desktop có đóng/mở, mobile có thu gọn/mở rộng/đóng. Có lịch sử ngay trong
panel hoặc đường dẫn `/history?plot=...`. Recharts tải lazy để trang bản đồ không
phải tải biểu đồ ngay. Chọn chỉ số, 24 giờ / 7 ngày / 30 ngày và giai đoạn; bảng
24 mẫu cuối bổ sung cách đọc không phụ thuộc biểu đồ. Trục thời gian dùng mốc
thật trong dữ liệu mô phỏng, không phải vị trí chỉ số mảng.

Model có `measurement_phase: PRE_PAW | UNKNOWN`, `irrigationEventId`,
`irrigationEventAt`, `observedAt`, `receivedAt` tách biệt. Snapshot gần nhất luôn
UNKNOWN. Lịch sử DEMO riêng sinh xác định theo giờ tuyệt đối; một số mẫu có đợt
tưới DEMO sau thời điểm quan trắc 20 phút mới được ghi PRE_PAW. Chọn “trước tưới”
không làm đổi nhãn của các mẫu UNKNOWN.

Không có lịch sử trước tưới LIVE: giao diện nói rõ chưa hỗ trợ và adapter bị
khóa khi chưa xác minh hợp đồng. Không có điều khiển bơm hoặc khuyến nghị tưới.

Kiểm tra tăng dần: 19 tests đạt sau T5; unit history xác minh từng khoảng thời
gian, timestamp/ID đợt tưới và dữ liệu thiếu. T7 xác minh biểu đồ/bảng trong browser.
