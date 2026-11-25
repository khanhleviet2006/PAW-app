# T2 — Design system và app shell

Đánh số theo master task T2–T7 mới nhất, không theo bảng nhiệm vụ cũ T0–T9.
Ngày bàn giao: 02/11/2026, UTC+7.

Dùng ảnh desktop đính kèm để tham chiếu màu xanh, header, icon rail, các lớp nổi
và panel bên phải. Chỉ nhận một ảnh desktop; không khẳng định đã đối chiếu ảnh
mobile chưa được cung cấp. Mobile được thiết kế theo mô tả trong master task.

Tokens tại `src/styles/global.css`: forest `#205b44`, canvas `#f4f6f2`, ink
`#253b32`, font Segoe UI/system, spacing 4/8/12/16/24/32px, radius control 11px,
panel 22px, shadow và transition 180ms. Có CSS Tailwind v4 qua Vite plugin.
Không phụ thuộc tải webfont hoặc dịch vụ bên ngoài.

Desktop: header, sidebar icon rail mặc định thu gọn, mở bằng hover/click, ghim
hoặc bỏ ghim; panel phải cuộn độc lập. Tablet 768px dùng chi tiết dưới bản đồ.
Mobile dưới 768px dùng drawer; sheet có đóng/thu gọn/mở rộng, lớp cuộn ngang.
Fullscreen phủ viewport, giữ focus và thoát bằng Escape; drawer giữ focus và
trả focus về nút mở khi đóng. Có skip link, focus ring, nhãn, trạng thái bằng
ký hiệu và chữ, hỗ trợ reduced motion. Các nút điều khiển chính tối thiểu 44px.

Kiểm tra tăng dần T2: typecheck, lint, 5 app-shell/routing tests đạt trước khi
triển khai map. QA tổng thể và ảnh chụp responsive tại T7. Không thay đổi backend.
