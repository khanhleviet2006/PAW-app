# PAW — Thay file giao diện bản đồ trên Windows, không dùng GitHub/Docker/WSL

Gói cập nhật hợp nhất bản đồ thành **`/map`**, chỉ dùng MapLibre GL JS + MapCN + ảnh vệ tinh đã lưu trên máy chủ PAW. `/` và `/field-map` tự chuyển về `/map`. Không còn menu chọn nền, Google, OpenStreetMap hoặc sơ đồ giả.

Nếu chưa có ảnh, thông báo đúng là **“Chưa cài đặt dữ liệu ảnh vệ tinh khu vực”**. Ảnh đồi chè đính kèm chỉ là tham chiếu giao diện; gói này không dùng ảnh đó như ảnh có GPS và không có ảnh vệ tinh thật của khu đất.

## 1. Chọn đúng thư mục

Giải nén ZIP thành một thư mục riêng, ví dụ `C:\PAW\CapNhatBanDo`. Trong đó có:

- `payload\frontend\`: các file cần thêm/thay trong **thư mục có package.json** của frontend. Nếu dự án của bạn giống GitHub, đó là `PAW-Frontend\paw-frontend`, không phải thư mục ngoài cùng.
- `payload\backend\`: các file cần thêm/thay trong thư mục có **app\main.py** của backend.
- `manifest.json`: danh sách thêm/thay/xóa và checksum của từng file.
- `FILE_CHANGES.md`: danh sách đọc được, gồm các renderer cũ phải xóa.
- `apply_update.py`: công cụ thay file cục bộ, có kiểm tra và backup; chỉ dùng thư viện chuẩn Python, không có lệnh mạng/Git.

Gói dựa trên frontend commit `6b4e1f9` và backend commit `7408525` đã bàn giao trước đó. Nếu bạn đã sửa code riêng, công cụ sẽ báo xung đột để tránh ghi đè thay đổi của bạn. Dữ liệu `.env`, database, `data/imagery`, GeoTIFF/MBTiles, node_modules và .venv không nằm trong gói và không bị công cụ sửa.

## 2. Cách khuyên dùng — kiểm tra rồi thay file có backup

Dừng Vite và FastAPI bằng `Ctrl+C`. Mở PowerShell trong thư mục đã giải nén:

```powershell
Set-Location 'C:\PAW\CapNhatBanDo'
py -3.12 apply_update.py --frontend-dir 'C:\PAW\PAW-Frontend\paw-frontend' --backend-dir 'C:\PAW\PAW-Backend'
```

Lệnh này **chỉ kiểm tra**, chưa sửa file. Nếu `py -3.12` không có, dùng Python 3.12+ đã cài, ví dụ `python apply_update.py ...`.

Nếu hiện `Validation passed`, áp dụng:

```powershell
py -3.12 apply_update.py --frontend-dir 'C:\PAW\PAW-Frontend\paw-frontend' --backend-dir 'C:\PAW\PAW-Backend' --apply
```

Script backup toàn bộ file bị ảnh hưởng vào `PAW-backup-<thoi-gian>` trước khi sửa, kiểm tra checksum payload, thay file bằng thao tác atomic và xóa các file engine cũ có trong manifest. Script không chạy build, không thay schema, không push GitHub. Nếu ghi file lỗi giữa chừng, nó thử khôi phục từ backup.

Nếu báo `STOP: local files differ`, **không dùng cách ép ghi đè**. Mở các file được báo trong VS Code, so sánh với payload rồi ghép phần bạn đã sửa với phần cập nhật. Có thể dùng chức năng Select for Compare / Compare with Selected. Gói chấp nhận line ending CRLF/LF của Windows; khác nội dung thực mới bị chặn.

Chạy lại cùng lệnh sau khi đã cập nhật đầy đủ sẽ báo `Already updated` và không sửa thêm.

## 3. Cách thay thủ công nếu không dùng script

1. Sao lưu hai thư mục dự án của bạn.
2. Chép **nội dung** `payload\frontend\` vào thư mục có package.json, giữ nguyên cây thư mục `src`, `tests`, `docs`...
3. Chép **nội dung** `payload\backend\` vào thư mục backend có `app\main.py`.
4. Xóa đúng các file ghi là **DELETE** trong FILE_CHANGES.md. Chỉ copy mà không xóa sẽ để lại các file import thư viện Google/Leaflet đã gỡ và có thể gây lỗi TypeScript.
5. Không xóa toàn bộ `src`, dự án, database hoặc ảnh; không chép `.env.example` đè lên `.env` hiện tại.

Nếu chỉ sửa phần giao diện, vẫn phải áp dụng endpoint `/imagery/active` và cấu hình mới ở backend vì frontend mới dùng hợp đồng này.

## 4. Cài lại dependencies và build frontend

```powershell
Set-Location 'C:\PAW\PAW-Frontend\paw-frontend'
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

`npm ci` loại các dependencies Google/Leaflet cũ. Nếu PowerShell chặn npm.ps1, dùng `npm.cmd`. Cài dependencies lần đầu cần Internet hoặc npm cache đã chuẩn bị; **khi vận hành**, toàn bộ bundle/worker/ảnh được đọc từ máy chủ PAW trong LAN. Có cache đầy đủ có thể dùng `npm ci --offline`.

Không cần Google Maps API key. Có thể xóa dòng VITE_GOOGLE_MAPS_API_KEY trong `.env.local` nếu trước đây đã đặt, nhưng không chia sẻ file đó.

Frontend dùng `VITE_PAW_API_URL` nếu API khác origin; nếu FastAPI phục vụ cả build frontend thì không cần đặt. Tùy chọn `VITE_PAW_FARM_ID` điền sẵn mã khu vực; tuyệt đối không đặt mã truy cập trong biến VITE.

## 5. Chọn ảnh đang dùng — chỉ quản trị viên

Giữ nguyên thư mục ảnh đã có. Trong `.env` backend (thêm dòng, không thay toàn bộ file):

```dotenv
PAW_IMAGERY_DIR=C:/PAW/data/imagery
PAW_FRONTEND_DIST=C:/PAW/PAW-Frontend/paw-frontend/dist
PAW_ACTIVE_IMAGERY_IDS={"FARM-ID":"farm-2026-v1"}
```

Đổi FARM-ID và dataset ID theo dữ liệu của bạn. Dataset ID là tên file MBTiles bỏ phần `.mbtiles`. Nếu farm có đúng một bộ ảnh hợp lệ, server có thể dùng bộ duy nhất đó. Khi có nhiều bộ ảnh, quản trị viên phải chỉ định; hệ thống không tự lấy bộ đầu tiên. Nếu ID được cấu hình bị thiếu hoặc sai farm, không thay bằng bộ khác.

Nếu chưa có ảnh, quản trị viên dùng công cụ nhập GeoTIFF cũ được giữ nguyên:

```powershell
Set-Location 'C:\PAW\PAW-Backend'
.\.venv\Scripts\python.exe -m pip install -r requirements-imagery.txt
.\.venv\Scripts\python.exe -m app.import_imagery --help
```

Dùng file GeoTIFF thực, CRS/bands phù hợp và giấy phép cho phép lưu/phục vụ offline. Xem docs/OFFLINE_MAP.md để nhập. Không có nút nhập hoặc lựa chọn ảnh trong giao diện người dùng.

## 6. Chạy backend không dùng Docker/WSL

Backend không có migration mới và không cần thay database. Giữ cấu hình PostgreSQL hiện có. Chạy từ thư mục backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.asgi:app --host 0.0.0.0 --port 8000
```

Mở `http://<IP-may-chu-PAW>:8000/map` từ máy tính/điện thoại cùng LAN. Windows Firewall cần cho phép cổng trên mạng riêng. Nhập mã khu quan trắc và mã truy cập viewer/operator đã cấp. Không đưa admin/gateway key cho người sử dụng.

Nếu muốn thử nhanh bằng Vite, chạy `npm run dev`; nếu API ở cổng khác thì đặt chính xác VITE_PAW_API_URL và PAW_CORS_ORIGINS rồi khởi động lại Vite/FastAPI.

## 7. Kiểm tra sau khi thay file

- `/`, `/map`, `/field-map` đều đến một màn hình, chỉ một mục bản đồ trong menu.
- Không có “Loại bản đồ”, Google/OSM/Farm Schematic, danh sách ảnh hoặc công cụ nhập ảnh.
- Chưa cài ảnh → đúng thông báo yêu cầu, không có bản đồ/nền giả.
- Có ảnh → kéo/zoom, marker/popup, chọn thông số/độ sâu, bật/tắt heatmap.
- Chuyển cột và nhận số đo mới → thêm điểm mới, giữ vị trí và số đo cũ, không reset camera/map.
- Ngắt WAN nhưng giữ LAN → vẫn mở và dùng bản đồ từ server PAW. Mất luôn LAN/server không phải chế độ offline Internet này.
- History/alerts/simulator và logic đo hiện có vẫn giữ; các trang lịch sử/cảnh báo cũ giữ nguyên cơ chế nguồn dữ liệu đã có, không tự đổi DEMO thành LIVE.

## 8. Khôi phục

Dừng các server trước. Khi bạn muốn quay lại đúng source trước cập nhật:

```powershell
py -3.12 apply_update.py --frontend-dir 'C:\PAW\PAW-Frontend\paw-frontend' --backend-dir 'C:\PAW\PAW-Backend' --restore 'C:\PAW\CapNhatBanDo\PAW-backup-<thoi-gian>'
```

Lệnh restore thay lại các file source được backup và xóa các file source mới của gói; nếu bạn đã sửa code thêm sau cập nhật, hãy sao lưu các chỉnh sửa đó trước. Chạy lại `npm ci` và `npm run build`, khởi động lại backend. Script không thay `.env`/dữ liệu, nên các dòng cấu hình quản trị thêm thủ công cần được xem lại riêng nếu khôi phục.
