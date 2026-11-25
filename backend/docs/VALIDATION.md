# Kiểm tra bàn giao backend

Ngày: 14/11/2026. Linux/Python 3.12; API mới trong repository backend riêng, không sửa frontend hoặc hệ thống ingest/ACK cũ.

## Kết quả cuối

| Kiểm tra | Kết quả |
| --- | --- |
| Ruff lint/format | Đạt |
| Pytest SQLite | 32/32 đạt, không bỏ qua bài nào |
| Pytest PostgreSQL 16 | 32/32 đạt, 17,61 giây; coverage app 88% |
| SSE | Kiểm thử HTTP TCP thật, không chỉ mock |
| Alembic SQLite | upgrade head và check đạt |
| Alembic PostgreSQL | Trên DB thử riêng: upgrade → check → downgrade base → upgrade đạt |
| OpenAPI | Sinh từ API hiện tại, response chính có schema Pydantic, endpoint/security được test |
| Python compileall | Đạt |
| Docker | Image build đạt với CA mount tạm riêng cho cloud; container non-root UID 10001, ready OK, POST tạo farm 201 và PostgreSQL lưu đúng; monitor --once chạy được |
| Docker Compose | config --quiet đạt; chưa chạy nguyên stack Compose trên Windows |
| Simulator end-to-end | Seed 12 plots/12 nodes/72 sensors; NORMAL có dữ liệu; move A→B giữ 6 mẫu lịch sử mỗi vị trí; INVALID_MEASUREMENT còn 70/72 điểm đủ điều kiện; withdraw node còn 66 điểm |

Smoke simulator dùng SQLite tạm riêng và stabilization=0 chỉ để kiểm tra pipeline; mặc định dự án vẫn 120 giây. Không dùng dữ liệu mô phỏng làm bằng chứng cảm biến thật hoạt động. Lượt unit/integration cuối không có bài thất bại; có một deprecation warning của dependency test như ghi bên dưới.

## Phạm vi kiểm thử

- Xác thực Bearer, role/farm isolation, revoke key; gateway chỉ ingest và đọc deployment của node thuộc farm.
- GPS range, polygon ring/topology, fix accuracy/age, ngoài vùng; jitter và latch chuyển vị trí cần xác nhận.
- Một deployment active/node, chuyển A→B giữ lịch sử A, GPS buffered cũ không di chuyển node mới.
- Batch idempotency, event ID xung đột, rollback toàn bộ batch và ACK sau commit.
- Stabilization, raw/calibration, invalid measurements, hai độ sâu độc lập.
- UNKNOWN/PRE_PAW theo session có thật và đúng khoảng thời gian.
- Heartbeat mới không làm mẫu cũ thành mới; gói heartbeat cũ không làm node online; stale/offline không vào heat_points.
- History keyset pagination, filters/timezones, snapshot so với lịch sử.
- Alerts hiện tại, log lifecycle, acknowledge/resolve và monitor khi không có telemetry.
- SSE TCP thật: snapshot ban đầu, cập nhật sau ingest, trạng thái theo thời gian, key revoke và đóng kết nối.
- Gateway spool giữ gói sau lỗi/ACK sai, chỉ xóa sau matching ACK; retry không đổi payload.

## Các vấn đề môi trường đã gặp

- Cache uv mặc định read-only: dùng cache `/tmp/paw-uv-cache` trong cloud; không thay cấu hình Windows.
- Cổng 8001 đã có dịch vụ khác: không dừng dịch vụ đó; smoke API chạy ở 18080.
- Docker build chuẩn tại cloud gặp proxy CA không có trong image Python. Đã thử lại bằng Dockerfile tạm và BuildKit secret mount CA, giữ xác minh TLS. Dockerfile trong repository vẫn dành cho môi trường thông thường; không commit CA hoặc cấu hình proxy riêng của phiên.
- Starlette hiện cảnh báo deprecation khi TestClient dùng httpx. Không tắt warning hoặc bỏ tests; runtime SSE được kiểm tra thêm bằng uvicorn/httpx TCP. Cần đánh giá adapter test httpx2 trong lần nâng dependencies tiếp theo.

## Chưa được nghiệm thu

- Firmware STM32, module GPS/LoRa, giải mã frame, sequence/ACK phần cứng và phát hiện cắm/rút tự động.
- Windows thật/Docker Desktop thật; lệnh Windows được cung cấp nhưng tests chạy trên Linux.
- Google Maps thực và LIVE frontend: cần adapter node di động/filter depth/overlay geographic theo tài liệu tích hợp.
- Production: HTTPS, đăng nhập người dùng, credential lifecycle, retention, backup/restore, tải lớn và triển khai. Chưa tự triển khai hoặc kích hoạt dịch vụ trả phí.
