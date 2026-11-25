> Luồng hiện tại: [Khởi động không cần thao tác](docs/ZERO_INTERACTION_STARTUP.md). Hướng dẫn nhập khu/mã truy cập trong tài liệu cũ đã được thay thế.

# PAW Backend — Node cảm biến di động GPS

Backend FastAPI + SQLAlchemy cho cột cảm biến có thể rút/cắm ở nhiều vị trí. Có PostgreSQL, SQLite để thử nhanh, Alembic migrations, API có xác thực, snapshot bản đồ, SSE, lịch sử đo và cảnh báo. Đây là backend mới; chưa thay firmware hoặc ingest/ACK của hệ thống cũ.

## Bản đồ GPS offline mới

Đã bổ sung API điểm đo lịch sử, catalog/tile ảnh nội bộ và tùy chọn phục vụ Vite build. Xem [hướng dẫn MapLibre + MapCN + GeoTIFF offline](docs/OFFLINE_MAP.md). Chưa có ảnh vệ tinh được cung cấp để nhập vào máy chủ.

## Bản đồ người dùng thống nhất — 19/11/2026

Bản đồ tại `/map`; `/` và `/field-map` chuyển về cùng trang. Quản trị viên chọn một bộ ảnh lưu nội bộ bằng PAW_ACTIVE_IMAGERY_IDS, không có công cụ chọn nền/import trong giao diện người dùng. Xem [hướng dẫn thay file trên Windows](docs/USER_MAP_UPDATE.md) và [báo cáo](docs/USER_MAP_REPORT.md). Không cần Docker hoặc WSL; giữ nguyên kết nối PostgreSQL hiện tại.

## Chạy trên Windows — cách đơn giản

Cài Python **3.12 hoặc 3.13** từ python.org, chọn “Add Python to PATH”. Mở PowerShell trong thư mục muốn lưu dự án:

```powershell
git clone https://github.com/khanhleviet2006/PAW-Backend.git
Set-Location PAW-Backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe scripts/setup_env.py
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.asgi:app --host 127.0.0.1 --port 8000
```

Không cần activate venv hoặc đổi ExecutionPolicy. Nếu dùng Python 3.13, thay `py -3.12` bằng `py -3.13`. Mọi lệnh chạy từ gốc repository.

- Kiểm tra: http://127.0.0.1:8000/health và http://127.0.0.1:8000/ready.
- Swagger: http://127.0.0.1:8000/docs.
- Dừng server: `Ctrl+C`. Nếu cổng 8000 đang được dùng, chọn cổng khác và truyền `--base-url` tương ứng cho simulator.
- `.env` được tạo **một lần** với khóa ngẫu nhiên; không commit/chia sẻ `.env` hoặc `*.secrets.json`.
- Cách này dùng SQLite `paw.db` tại máy bạn. Chạy migration trước, API không tự tạo bảng hoặc tự seed dữ liệu.

Mở PowerShell thứ hai để lưu cảnh báo offline/quá hạn ngay cả khi không có gói tin mới:

```powershell
Set-Location 'C:\duong-dan\PAW-Backend'
.\.venv\Scripts\python.exe -m app.monitor --interval 15
```

SSE vẫn tính trạng thái theo thời gian khi đang mở; monitor chịu trách nhiệm ghi lịch sử cảnh báo hết hạn khi không có người xem.

## Chạy thử 12 node — chưa cần phần cứng

Giữ server đang chạy, mở PowerShell khác:

```powershell
.\.venv\Scripts\python.exe scripts/simulate.py seed
.\.venv\Scripts\python.exe scripts/simulate.py run --period 10
```

`seed` tạo trang trại **DỮ LIỆU MÔ PHỎNG**, 12 vùng A-01…C-04, 12 node, mỗi node 6 cảm biến: nhiệt độ/độ ẩm không khí và độ ẩm/pH đất ở 20 cm, 40 cm. GPS tại đây là dữ liệu minh họa, không phải trang trại thật. Source mô phỏng không thể ghi vào farm nguồn `sensor`.

Mặc định đầu dò chờ ổn định 120 giây, chu kỳ đo khai báo 600 giây. `--period 10` chỉ gửi gói mô phỏng thường hơn; không thay đổi đồng hồ server hoặc giả làm dữ liệu thật. Có thể dùng `--interval-seconds 10` khi seed một database thử mới để kiểm tra timeout nhanh; mặc định vẫn là 600 giây.

Xem cập nhật SSE trong terminal khác, không gọi GET liên tục từ client:

```powershell
.\.venv\Scripts\python.exe scripts/simulate.py watch
```

Chuyển/rút node mô phỏng:

```powershell
.\.venv\Scripts\python.exe scripts/simulate.py move --node sim-A-01 --plot B-02
.\.venv\Scripts\python.exe scripts/simulate.py withdraw --node sim-A-01
```

Các scenario: `NORMAL`, `LOW_SOIL_MOISTURE`, `HIGH_AIR_TEMPERATURE`, `ABNORMAL_SOIL_PH`, `INVALID_MEASUREMENT`, `SENSOR_OFFLINE`, `STALE_DATA`, `MISSING_SENSOR`:

```powershell
.\.venv\Scripts\python.exe scripts/simulate.py run --period 10 --scenario LOW_SOIL_MOISTURE
```

Scenario mặc định tác động `sim-A-01`, có thể đổi `--node`. Offline: ngừng gửi toàn bộ gói của node đó, phải chờ server xác định mất liên lạc. Stale: tiếp tục heartbeat nhưng ngừng số đo. Missing: ngừng gửi đầu dò soil20; nếu đã có mẫu, nó sẽ quá hạn trước, không xóa lịch sử để giả mất cảm biến. Không có API làm giả trạng thái offline hoặc tăng đồng hồ server. Bộ test dùng đồng hồ riêng để kiểm tra các trạng thái này tức thời.

`seed` không ghi đè farm/keys đã có. Nếu bị ngắt giữa chừng, giữ credentials, xem trạng thái qua API rồi bổ sung các đối tượng còn thiếu; không xóa database thật để chạy lại.

## PostgreSQL + Docker Desktop

Cài Docker Desktop, bật Linux containers. Sau khi đã tạo `.env` bằng `setup_env.py`:

```powershell
docker compose up --build -d
docker compose ps
```

Stack gồm PostgreSQL 16, một tác vụ migration chạy trước API, API và monitor. PostgreSQL không mở cổng ra máy host. API chỉ bind `127.0.0.1:8000`. Volume giữ dữ liệu khi restart.

```powershell
docker compose logs --tail 50 api monitor
docker compose down
```

Không thêm `-v` khi dừng nếu muốn giữ dữ liệu. Host simulator vẫn dùng được với stack Docker sau khi cài Python dependencies. Chọn một cách chạy server tại một thời điểm để tránh trùng cổng. Backup PostgreSQL và nghiệm thu migrations trước khi dùng với dữ liệu thật.

## API chính

| Nhóm | Endpoint |
| --- | --- |
| Tạo farm, vùng đất, node | `POST /v1/farms`, `/v1/farms/{farm_id}/plots`, `/v1/farms/{farm_id}/nodes` |
| Khai báo sensor | `POST /v1/nodes/{node_id}/sensors` |
| Cấp/thu hồi key | `POST /v1/farms/{farm_id}/keys`, `DELETE /v1/farms/{farm_id}/keys/{key_id}` |
| Gateway gửi dữ liệu | `POST /v1/gateway/ingest` |
| Xác nhận cắm/rút | `POST /v1/nodes/{node_id}/deployments`, `/v1/nodes/{node_id}/withdraw` |
| GPS và lịch sử lần cắm | `GET /v1/nodes/{node_id}/positions`, `/v1/nodes/{node_id}/deployments` |
| Bản đồ và cập nhật | `GET /v1/farms/{farm_id}/map`, `/v1/farms/{farm_id}/events` |
| Lịch sử đo | `GET /v1/farms/{farm_id}/measurements` |
| Cảnh báo hiện tại/lưu trữ | `GET /v1/farms/{farm_id}/alerts`, `/v1/farms/{farm_id}/alert-history` |
| Xác nhận đã xem cảnh báo | `POST /v1/farms/{farm_id}/alerts/{alert_id}/acknowledge` |
| Ngưỡng giám sát | `PATCH /v1/farms/{farm_id}/thresholds` |
| Phiên trước tưới | `POST /v1/farms/{farm_id}/measurement-sessions` |

API trừ health/ready/docs cần `Authorization: Bearer <token>`. Dùng admin token trong `.env` để cấp key có phạm vi một farm: **viewer** chỉ đọc, **operator** quản lý node/vùng/phiên, **gateway** chỉ ingest. Không đưa admin/gateway token vào frontend. Key chỉ được trả một lần, database lưu SHA-256 của token ngẫu nhiên.

[Hướng dẫn vận hành Windows](docs/WINDOWS_SETUP.md) · [Kiến trúc và ERD](docs/ARCHITECTURE.md) · [Gateway và nạp firmware](docs/GATEWAY_AND_FIRMWARE.md) · [Hợp đồng frontend](docs/FRONTEND_INTEGRATION.md) · [OpenAPI](docs/openapi.json) · [Kết quả kiểm thử](docs/VALIDATION.md).

## Kiểm thử

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m alembic check
```

Linux/macOS: thay `.\.venv\Scripts\python.exe` bằng `.venv/bin/python`. Có `uv.lock` nếu dùng uv: `uv sync --frozen`, `uv run pytest`. Không chạy tests trên database thật; cấu hình PostgreSQL test phải có tên chứa `paw_test`, test sẽ tạo/xóa các bảng trong database đó.

## Tình trạng tích hợp hiện hành

Frontend có một màn hình `/map` dùng MapLibre + MapCN, đọc GPS/lịch sử/SSE và một bộ ảnh active từ backend. Hai đường dẫn `/` và `/field-map` chuyển về cùng màn hình. Quản trị viên cấu hình ảnh qua PAW_ACTIVE_IMAGERY_IDS; người dùng không có công cụ nhập hoặc đổi nền.

Giữ nguyên domain, dữ liệu, ingest/ACK và các chức năng history/alerts/simulator hiện có. Chưa có ảnh vệ tinh khu đất hoặc thiết bị thật để nghiệm thu ngoài thực địa. Backend chạy trực tiếp bằng Python và kết nối PostgreSQL sẵn có; cập nhật này không yêu cầu Docker/WSL hay migration mới. Xem docs/USER_MAP_UPDATE.md để thay file cục bộ có backup, không dùng GitHub.

Chưa có firmware STM32 hoặc thông số board/module để tạo `.bin/.hex` và lệnh nạp đúng. Backend chạy trên máy tính/server, không nạp vào STM32.
