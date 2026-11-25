> Luồng hiện tại: [Khởi động không cần thao tác](docs/ZERO_INTERACTION_STARTUP.md). Hướng dẫn nhập khu/mã truy cập trong tài liệu cũ đã được thay thế.

# PAW — Giám sát môi trường trước tưới

**Bản đồ người dùng hiện hành: `/map`.** `/` và `/field-map` chuyển về cùng màn hình này. Chỉ dùng MapLibre GL JS + MapCN và một bộ ảnh vệ tinh được lưu tại máy chủ PAW. Không còn engine Google, Leaflet hoặc sơ đồ giả trong giao diện/bundle.

Khi thiếu ảnh hiển thị đúng: **“Chưa cài đặt dữ liệu ảnh vệ tinh khu vực”**. Không có ảnh khu đất thật được cung cấp trong repository. Người quản trị nhập GeoTIFF/MBTiles và chọn bộ ảnh trong cấu hình backend; người dùng chỉ xem số đo/GPS/heatmap.

Xem [hướng dẫn thay file trên Windows, không push GitHub](docs/USER_MAP_UPDATE.md) và [báo cáo thay đổi](docs/USER_MAP_REPORT.md). Các báo cáo T0–T8B/OFFLINE_MAP cũ được giữ như lịch sử; phần lựa chọn nhiều nền trong đó đã được thay thế.

Các domain model, repository, simulator, phép đo, lịch sử và cảnh báo hiện có được giữ nguyên. Bản đồ thật dùng kết nối FastAPI riêng có xác thực, từ chối farm mô phỏng. Các trang lịch sử/cảnh báo cũ vẫn giữ cơ chế DEMO/LIVE sẵn có và nhãn nguồn rõ ràng; không tự suy đoán dữ liệu LIVE.

## Chạy trên Windows PowerShell

Cài **Node.js 24 LTS từ 24.15.0 trở lên**, kèm npm, từ https://nodejs.org.
Mở lại PowerShell rồi chạy:

```powershell
Set-Location 'C:\duong-dan\du-an\paw-frontend'
node --version
npm --version
npm ci
npm run dev
```

Mở URL Vite in ra, thường là http://127.0.0.1:5173. Nhấn `Ctrl+C` để dừng.
Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` thay cho `npm`; không cần đổi
execution policy toàn máy. Không cần Python, .NET, Docker, PostgreSQL hoặc API key
để chạy DEMO. Không có font, map tile hoặc CDN nào bắt buộc khi sử dụng ứng dụng.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Bundle ở `dist/`; preview thường tại http://127.0.0.1:4173.
`npm run test:watch` hỗ trợ phát triển. `npm run format` định dạng mã nguồn;
`npm run format:check` kiểm tra định dạng.

## Kiểm thử trình duyệt

```powershell
npx playwright install chromium
npm run test:e2e
npx playwright show-report
```

Playwright tự bật/tắt dev server trên cổng **5173**, nên dừng server đang chạy
trước khi chạy E2E. Có các cấu hình 1920×1080, 1366×768, 390×844 và 360×800. Mobile là giả lập
Chromium, không thay thế nghiệm thu thiết bị thật. Google được mock trong unit
tests; tile OSM được stub trong E2E, không cần Internet/Billing cho assertions.

Ảnh chụp được lưu trong `docs/screenshots/`; report và trace ở
`playwright-report/`, `test-results/` (đã gitignore). Trong cloud hiện tại browser
được cài tại `/tmp/paw-playwright-browsers`; cần đặt `PLAYWRIGHT_BROWSERS_PATH`
trỏ tới đó nếu chạy lại trong cùng môi trường. Windows không cần biến này.

Để xem trên điện thoại cùng LAN:

```powershell
npm run dev -- --host 0.0.0.0
```

Mở `http://<IPv4-may-tinh>:<cong-Vite>`; Windows Firewall có thể cần cho phép
Node.js trên mạng riêng. Mặc định server chỉ lắng nghe loopback.

## Cách sử dụng hiện hành

- Mở `/map`; `/` và `/field-map` chuyển về cùng trang. Chỉ có một mục bản đồ trong menu.
- Nhập khu quan trắc và mã truy cập viewer/operator được cấp. URL máy chủ do quản trị viên đặt qua VITE_PAW_API_URL hoặc cùng origin FastAPI phục vụ build.
- Khi có ảnh nội bộ đang dùng: kéo/zoom, nhấn marker hoặc chọn điểm lịch sử, đọc số đo/GPS/thời gian. Chọn chỉ tiêu và độ sâu, bật/tắt heatmap hoặc chỉnh độ đậm.
- Không có bộ chọn loại nền hay danh sách/import ảnh trong giao diện. Thiếu ảnh hiện đúng thông báo yêu cầu, không vẽ sơ đồ thay thế.
- `/history`, `/alerts`, `/settings` giữ các chức năng và cơ chế nguồn dữ liệu có sẵn. `/dev/simulation` chỉ dành cho development; dữ liệu đó không được đưa vào bản đồ thật.
- Sidebar có thể mở/ghim, mobile dùng menu có Escape/focus. Không cần Google API key.

## Dữ liệu và nghiệp vụ

- DEMO có đồng hồ cố định **14:40, 02/11/2026 (UTC+7)** để kết quả refresh và
  kiểm thử nhất quán. Số đo thông thường lúc 14:32; không giả làm thời gian thực.
- A-04 có nhiệt độ ngoài ngưỡng; B-02 mất kết nối; C-03 quá hạn; C-04 chưa cấu
  hình; B-04 thiếu pH đất; C-01 dùng trạm không khí chung được ghi rõ nguồn.
- Bốn chỉ số: nhiệt độ không khí (°C), độ ẩm không khí (%RH), độ ẩm đất (%) khi
  đã hiệu chuẩn, pH đất. Không dùng pH nước PAW thay pH đất. Số đo đất chưa hiệu
  chuẩn dùng `raw` và không tô màu như một tỷ lệ hợp lệ.
- Số đo gần nhất giữ `measurement_phase: UNKNOWN`. Chỉ các mẫu lịch sử DEMO
  riêng có ID và thời điểm đợt tưới mô phỏng mới được ghi `PRE_PAW`.
- Dữ liệu quá hạn dựa trên chu kỳ 600 giây + dung sai 300 giây; trạng thái gateway
  tách khỏi giá trị. Số đo cũ không được tô là bình thường chỉ vì nằm trong ngưỡng.
- Heatmap IDW p=2 từ tâm vùng giả lập, có đường đồng mức và nhãn DEMO; không GPS thật. Hình nền cũng là
  SVG minh họa, không đặt nút lên ảnh tham chiếu. Không nội suy từ số đo thiếu,
  quá hạn, offline, chưa hiệu chuẩn hoặc trạm không khí chung.
- Không có điều khiển bơm, tưới tự động, dự đoán năng suất hoặc khuyến nghị lượng tưới.

## Kiến trúc

```text
src/
  app/                            # providers, preferences, routing
  components/layout/              # header, sidebar, drawer
  features/
    farm-map/                     # SVG rendering và tương tác
    environmental-layers/         # metric config, trạng thái, legend
    area-details/                 # panel số đo
    telemetry-history/            # lịch sử, lazy-loaded Recharts
  data/mock/                      # geometry tách khỏi sensor fixtures
  hooks/                          # TanStack Query hooks
  services/
    api/                          # HTTP client, payload unknown
    adapters/                     # mock và ranh giới LIVE có khóa hợp đồng
    repositories.ts               # interface chung
    repositoryFactory.ts          # chọn nguồn, không fallback
  types/                          # domain model độc lập UI
  pages/                          # map, history, alerts, settings
  lib/                            # định dạng thời gian/đơn vị
  styles/                         # tokens, Tailwind, responsive CSS
tests/                            # Vitest + Testing Library
e2e/                              # Playwright + axe
```

UI đọc qua query hooks → repository → adapters; không import fixtures trực tiếp
vào component. Đổi nguồn tạo query key riêng, không reuse data giữa DEMO/LIVE.

## Cấu hình API và các việc còn thiếu

```powershell
Copy-Item .env.example .env.local
```

`VITE_DATA_MODE=DEMO` là mặc định. `VITE_API_BASE_URL` dành cho URL backend thực
khi được cung cấp; khởi động lại Vite sau khi đổi biến. Biến `VITE_*` công khai
trong bundle: không lưu token, mật khẩu hoặc gateway ingest token.

Hiện base URL chỉ phục vụ kiểm tra HTTP/JSON `/health` trong Cài đặt. Thành công
ở `/health` **không chứng minh** schema, số đo hoặc lịch sử LIVE hoạt động.
`VerifiedReadContract` là điểm tích hợp tương lai, không có mapper schema giả.
Cần kiểm tra OpenAPI, query parameters, auth/CORS/HTTPS, node→plot, đơn vị,
calibration và PRE_PAW, sau đó mới nối client/contract vào repository factory.
Xem [T6_API_INTEGRATION](docs/T6_API_INTEGRATION.md).

Để triển khai production: hoàn tất hợp đồng LIVE và integration tests, nghiệm thu
Windows/thiết bị thật, phục vụ `dist/` qua HTTPS, cấu hình SPA fallback về
`index.html`, xác minh reverse proxy/base path và quy trình rollback artifact.
Vite dev/preview không phải máy chủ production. Chưa thực hiện T8/T9 hay deploy.

## Hồ sơ bàn giao

Xem [bản cập nhật heatmap desktop/mobile](docs/HEATMAP_UPDATE.md) cho yêu cầu mới nhất.
Các báo cáo T2–T7 bên dưới ghi nhận lần triển khai ban đầu; phần không heatmap
và thiếu ảnh mobile trong các báo cáo cũ đã được thay thế bởi cập nhật này.

- [T2 — Design system](docs/T2_DESIGN_SYSTEM.md)
- [T3 — Bản đồ tương tác](docs/T3_INTERACTIVE_MAP.md)
- [T4 — Lớp dữ liệu](docs/T4_DATA_LAYERS.md)
- [T5 — Chi tiết và lịch sử](docs/T5_AREA_DETAILS.md)
- [T6 — Tích hợp API còn phụ thuộc](docs/T6_API_INTEGRATION.md)
- [T7 — Kết quả QA và danh sách file](docs/T7_FINAL_VALIDATION.md)

T0/T1 được giữ lại làm lịch sử. Workspace vẫn chưa có Git repo hợp lệ nên chưa
thể commit theo giai đoạn; không chạy `git init` hoặc push, không sửa backend/WPF.

## Bố cục tập trung bản đồ

Bản đồ dùng toàn bộ chiều ngang và phần lớn chiều cao còn lại. Công cụ, chú giải
và chi tiết là các tab nổi: rê chuột để mở, rời tab để thu lại; ghim nếu muốn giữ.
Chạm hoặc dùng Tab + Enter để mở; nút Thu gọn hoặc Escape để đóng. Khi chọn vùng,
chi tiết tự mở. Nội dung có focus hoặc đã ghim không tự biến mất khi rời chuột.
Sidebar tiếp tục hỗ trợ mở khi hover và ghim. Các tab không đẩy hoặc thu nhỏ bản đồ.

## T8A — Điều khiển dữ liệu mô phỏng

T8A thay công việc tích hợp backend hiện tại. Chạy `npm run dev`, mở
`/dev/simulation` (chỉ development), chọn DEMO rồi bấm **Bắt đầu**. Có tám
scenario, tốc độ 1×/60×/600×/3600×, tạm dừng/tiếp tục/đặt lại và tạo phiên
PRE_PAW mô phỏng. Mọi màn hình đọc cùng engine qua mock repository khi đã start.
Trước khi start vẫn là fixture xem trước; reload trang sẽ mất phiên chạy.

Xem [kiến trúc, cách chạy và kiểm thử simulator](docs/T8A_SENSOR_SIMULATOR.md).
Không cần backend hoặc phần cứng; không có điều khiển tưới thật.
