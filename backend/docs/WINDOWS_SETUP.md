# Hướng dẫn cài/chạy backend trên Windows

## 1. Tải và cài

README có các lệnh PowerShell đầy đủ. Nếu chưa cài Git, vào GitHub repository → Code → Download ZIP, giải nén rồi mở PowerShell trong thư mục có `pyproject.toml`. Không cần nạp backend vào board.

Chạy `scripts/setup_env.py` một lần. File `.env` chứa admin token và mật khẩu PostgreSQL ngẫu nhiên. Muốn xem token phục vụ Swagger trên máy riêng, mở bằng Notepad; không chụp/chia sẻ màn hình chứa khóa. Không dùng `Get-Content .env` trong log chia sẻ.

Sau khi `alembic upgrade head`, mở server. Health chỉ báo tiến trình; ready kiểm tra bảng database có thể truy vấn. Nếu ready 503, kiểm tra URL DB và migrations.

## 2. Cấp key và thao tác qua Swagger

1. Mở `http://127.0.0.1:8000/docs`.
2. Nhấn **Authorize**, nhập admin token trong `.env` (chỉ token, không thêm chữ Bearer vào ô HTTPBearer).
3. `POST /v1/farms`: id ổn định, name, source `sensor` cho dữ liệu thật hoặc `simulation` cho thử nghiệm.
4. `POST /v1/farms/{farm_id}/keys`: tạo riêng viewer/operator/gateway. Lưu token được trả **một lần** vào nơi an toàn; DB không lưu plaintext.
5. Operator: khai báo polygon GPS vùng đất, node, sensors. Tất cả ID là duy nhất trong hệ thống; không tái sử dụng sensor ID của node khác.
6. Gateway: gửi heartbeat/GPS bằng ingest, nhận `position_id`.
7. Operator: `POST /v1/nodes/{node_id}/deployments` với `position_id`, và `plot_id` nếu cần xác nhận vùng. Lưu deployment ID vào quy trình gateway/thiết bị theo hợp đồng đã thống nhất.
8. Gateway gửi readings kèm deployment ID. Chờ ổn định, xem map snapshot và alerts.
9. Trước di chuyển, operator gọi withdraw. Khi cắm lại, gửi GPS mới rồi xác nhận deployment mới. Nếu GPS báo đã di chuyển, heatmap sẽ chờ xác nhận; không bỏ qua cảnh báo này.

Không dùng Swagger đăng nhập admin trên thiết bị dùng chung. Với simulator, các bước trên được script thực hiện trên farm mô phỏng, keys lưu trong `.simulation.secrets.json` đã gitignore.

## 3. Chạy nhanh bài nghiệm thu

- `simulate.py seed` → 12 vùng/12 node/72 sensors, không đọc phần cứng.
- `simulate.py run --period 10` → sau thời gian ổn định có latest/heat points.
- `simulate.py watch` ở terminal riêng → thấy cursor/heat point count thay đổi qua SSE.
- Chạy move sang B-02 → A giữ lịch sử, node có deployment mới, số đo cũ không xuất hiện ở B.
- Chạy scenario invalid → số đo pH ngoài giới hạn được lưu nhưng không có trong heat points.
- Dừng gửi node → sau timeout hiện stale/offline; monitor lưu lịch sử.

Để rút ngắn **chỉ trên database mô phỏng mới**, trước khi seed có thể đặt `.env` `PAW_STABILIZATION_SECONDS=0`, restart server và seed `--interval-seconds 10`. Offline vẫn dùng `max(PAW_OFFLINE_AFTER_SECONDS, 30 giây)`; nếu thử nhanh, đặt offline timeout 30 giây. Không áp các giá trị này cho dữ liệu thật khi chưa xác minh chu kỳ và thời gian ổn định.

## 4. Dùng PostgreSQL không qua Docker

Tạo một database trống và tài khoản có quyền trong database đó. Đặt trong `.env`:

```dotenv
PAW_DATABASE_URL=postgresql+psycopg://<user>:<url-encoded-password>@127.0.0.1:5432/<database>
```

Chạy `python -m alembic upgrade head`, rồi API/monitor. Backup trước khi áp migration lên database đã có dữ liệu. Schema này là backend mới; không trỏ thẳng vào database cũ PAW mà chưa audit.

Đổi từ SQLite sang PostgreSQL chỉ đổi kết nối, không tự chuyển dữ liệu SQLite. Nếu đã có dữ liệu cần giữ, cần kế hoạch export/import riêng.

## 5. Lỗi thường gặp

| Lỗi | Cách kiểm tra |
| --- | --- |
| `py` không tồn tại | Cài Python từ python.org, bật PATH và mở lại PowerShell |
| PowerShell chặn Activate.ps1 | Dùng đầy đủ đường dẫn `.venv\Scripts\python.exe` như README |
| Thiếu `PAW_ADMIN_TOKEN` | Chạy setup_env.py hoặc kiểm tra .env tại thư mục đang chạy |
| Cổng đang dùng | Chọn `--port 8002`; truyền `--base-url http://127.0.0.1:8002` cho simulator |
| 401/403 | Đúng key, vai trò và farm; gateway không được đọc bản đồ, admin không dùng ingest |
| 409 event ID | Giữ nguyên body khi retry; ID giống nhưng nội dung khác bị từ chối |
| 422 thời gian/GPS | Dùng ISO 8601 với UTC offset, fix mới, accuracy đúng và tọa độ lon/lat đúng thứ tự |
| Heat points rỗng | Chưa xác nhận cắm, chưa ổn định, raw/chưa hiệu chuẩn, offline/stale, ngoài vùng hoặc đang chờ xác nhận di chuyển |
| SSE chưa tới browser | Kiểm tra Authorization, origin CORS, proxy buffering/timeout và token revoke |
| Docker build SSL lỗi trong mạng công ty | Cấu hình CA tin cậy đúng cho mạng/proxy; không tắt xác minh TLS |

Backend không yêu cầu Google Maps API key. Xem Google Maps thật cần key browser được giới hạn referrer trong frontend và adapter GPS theo tài liệu tích hợp.
