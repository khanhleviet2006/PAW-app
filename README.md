# PAW — Ứng dụng quan trắc đồi chè

Một lần clone cung cấp cả giao diện React, TypeScript, Vite trong `frontend/` và API FastAPI, migrations Alembic trong `backend/`. Khi vận hành, FastAPI phục vụ cả giao diện và API ở cùng địa chỉ. MapLibre/MapCN hiển thị ảnh vệ tinh đã cài nội bộ, điểm GPS, thông số và heatmap. Mã được hợp nhất từ PAW-Frontend `e303219` và PAW-Backend `c7cecf4`.

## Cài lần đầu trên Windows (quản trị viên)

Cài Git, Python 3.12 64-bit, Node.js 24.15 trở lên thuộc dòng 24 và PostgreSQL. Trong PowerShell:

```powershell
git clone https://github.com/khanhleviet2006/PAW-app.git
cd PAW-app
cd frontend
npm ci
npm run build
cd ..\backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-imagery.txt
.\.venv\Scripts\python.exe scripts/setup_env.py
notepad .env
```

Trình cài tạo admin token ngẫu nhiên trong `backend/.env`. Giữ token ở máy chủ. Để dùng PostgreSQL, tạo một database thuộc sở hữu tài khoản ứng dụng hoặc dùng kết nối PAW đã có. Ví dụ sau dành cho người xem ngay trên máy chủ. Thay tên tài khoản, mật khẩu (URL-encode ký tự đặc biệt), database và mã trang trại bằng giá trị triển khai:

```dotenv
PAW_DATABASE_URL=postgresql+psycopg://paw:MAT_KHAU@127.0.0.1:5432/paw
PAW_FRONTEND_DIST=../frontend/dist
PAW_VIEWER_FARM_ID=DOI-CHE
PAW_VIEWER_NETWORKS=["127.0.0.1/32"]
PAW_VIEWER_ORIGINS=["http://127.0.0.1:8000"]
```

Có thể giữ URL SQLite sẵn trong mẫu để chạy thử trên máy riêng. Khi cập nhật hệ thống đang dùng, sao lưu database và giữ cấu hình, khóa, thư mục ảnh hiện tại. Chạy lệnh sau từ `backend` sau khi kiểm tra đúng URL:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
..\Start-PAW.cmd
```

Mở [trang kiểm tra database](http://127.0.0.1:8000/ready). Nếu database mới, vào [API nội bộ](http://127.0.0.1:8000/docs) trên máy chủ, chọn **Authorize**, nhập giá trị PAW_ADMIN_TOKEN. Dùng POST /v1/farms với JSON bên dưới, thay mã và tên đúng khu đất. Bỏ qua bước tạo nếu khu nguồn sensor đã tồn tại. Khai báo node, đầu dò và quyền thiết bị theo [hướng dẫn backend](backend/README.md).

```json
{"id":"DOI-CHE","name":"Đồi chè","source":"sensor"}
```

Để hiện ảnh thật, nhập GeoTIFF có tọa độ và quyền sử dụng offline hoặc cài bộ MBTiles theo [quy trình ảnh](backend/docs/OFFLINE_MAP.md). Chọn ảnh cho đúng farm theo [hướng dẫn cấp quyền xem và bàn giao](backend/docs/ZERO_INTERACTION_STARTUP.md). Trong repository này thư mục build là `frontend/dist`. Thư mục lưu ảnh mặc định là `backend/data/imagery`.

Để mở từ điện thoại trong LAN, quản trị viên thêm IP thiết bị được phép vào PAW_VIEWER_NETWORKS, đặt PAW_VIEWER_ORIGINS chứa địa chỉ LAN chính xác cả cổng và giới hạn firewall cho các máy được phép. Đặt `$env:PAW_BIND_HOST="0.0.0.0"` trong PowerShell trước khi chạy launcher. Khởi động lại khi thay cấu hình. Nếu cần lưu lịch sử cảnh báo khi không có người mở trang, chạy thêm `.\.venv\Scripts\python.exe -m app.monitor --interval 15` từ backend trong cửa sổ riêng.

## Sử dụng hằng ngày

1. Khởi động máy chủ bằng `Start-PAW.cmd` ở gốc dự án. Mở [bản đồ trên máy chủ](http://127.0.0.1:8000/map) hoặc địa chỉ LAN đã bàn giao trên điện thoại.
2. Kéo, zoom và nhấn điểm GPS để xem số đo. Trong **Thông số hiển thị**, chọn chỉ số/độ sâu và bật hoặc tắt heatmap.
3. Khi nhận số đo ở vị trí mới, bản đồ bổ sung điểm và giữ lịch sử. Khi mất mạng, trang đang mở giữ các điểm đã tải và tự đồng bộ lại. Nếu thiếu ảnh, trang hiện “Chưa cài đặt dữ liệu ảnh vệ tinh khu vực”.
4. Nếu chưa được cấp quyền, quản trị viên kiểm tra mã farm, IP và origin. Nếu máy chủ không khởi động, kiểm tra thư mục dist, cấu hình database và migration. Dừng máy chủ bằng Ctrl+C.

## Kiểm thử từ bản clone

Trong frontend chạy `npm run lint`, `npm test`, `npm run build`. Để chạy E2E, chạy `npx playwright install chromium` rồi `npm run test:e2e`. Trong backend cài `requirements-dev.txt` vào venv, rồi chạy `.\.venv\Scripts\python.exe -m pytest -q`. SQLite thử nghiệm được tạo riêng. Nếu đặt TEST_DATABASE_URL, chỉ trỏ tới database thử chuyên dụng có tên chứa paw_test vì fixture tạo lại các bảng. Xem cách chạy E2E tích hợp với dữ liệu và ảnh thử trong [hướng dẫn offline](backend/docs/ZERO_INTERACTION_STARTUP.md).

Kết quả kiểm tra bản hợp nhất ngày 25/11/2026: production build và lint đạt, 59 bài frontend đạt, 42 bài backend đạt trên từng database SQLite và PostgreSQL. Alembic nâng cấp được database PostgreSQL mới. Có 12 bài E2E điều hướng và 4 bài tích hợp FastAPI với Chromium trên kích thước desktop/mobile đạt. Bài tích hợp chạy bản build thật, kiểm tra GPS, heatmap, tự nối lại, giữ điểm cũ và trường hợp thiếu ảnh. Kiểm thử dùng dữ liệu tạm trên Linux; bước nhấp launcher trên Windows và phần cứng tại hiện trường cần nghiệm thu khi bàn giao.
