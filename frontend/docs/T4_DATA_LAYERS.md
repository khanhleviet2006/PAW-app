# T4 — Bốn lớp môi trường

Types tại `types/domain.ts`; config/ngưỡng tại
`features/environmental-layers/config.ts`, phân loại tại `status.ts`.

| Lớp                     | Đơn vị | Ngưỡng DEMO mặc định |
| ----------------------- | ------ | -------------------- |
| Nhiệt độ không khí      | °C     | 18–32                |
| Độ ẩm không khí         | %RH    | 45–90                |
| Độ ẩm đất đã hiệu chuẩn | %      | 20–60                |
| pH đất                  | pH     | 5,5–7,5              |

Đây là ngưỡng minh họa, không phải khuyến nghị nông học. Cài đặt cho phép đổi
min/max hữu hạn, min < max, áp dụng toàn ứng dụng trong phiên, có khôi phục mặc
định. Không ghi dữ liệu xuống backend hoặc thay đổi số đo khi đổi ngưỡng.

Mỗi polygon có màu phân khoảng giá trị; không gradient nội suy/heatmap. Ngoài
ngưỡng dùng màu cảnh báo. Offline ưu tiên trạng thái gateway; thiếu số đo hoặc
đất chưa hiệu chuẩn dùng màu trung tính. Quá hạn: tuổi số đo vượt chu kỳ dự kiến
600 giây + dung sai 300 giây, hoặc gateway delayed/unknown. Không suy ra offline
chỉ từ một giá trị sensor. Đồng hồ DEMO cố định để refresh không tự đổi trạng thái.

Nhãn/legend có ✓ bình thường, ! cảnh báo, × offline, ◷ quá hạn, — chưa dữ liệu.
Đổi lớp cập nhật màu/giá trị/legend mà giữ selectedPlotId. Filter áp dụng cho lớp
hiện tại. Độ ẩm đất chưa hiệu chuẩn định dạng raw và không tô như tỷ lệ hợp lệ.

Unit tests kiểm tra đủ năm trạng thái, đổi ngưỡng, dữ liệu cũ và raw. Component
và E2E xác minh đổi lớp, giữ selection, filter, nguồn thiếu cảm biến.
