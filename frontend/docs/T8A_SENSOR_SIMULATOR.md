# T8A — Frontend Sensor Data Simulator

Ngày 03/11/2026 (UTC+7). Yêu cầu T8A thay công việc tích hợp backend ở T8. Không
xây backend, không nối FastAPI/PostgreSQL, không đổi ingest/ACK. Báo cáo T8 cũ
được giữ như tài liệu lịch sử; không phải điều kiện để chạy simulator.

## Kiểm tra và tái sử dụng

Đã đọc types/domain, fixtures + geometry, mockRepository, FarmRepository,
repositoryFactory, useFarmData/useHistoryData, WorkspacePage/Leaflet heatmap,
AreaDetails, TelemetryHistory, HistoryPage và AlertsPage trước khi sửa.
Giữ nguyên React/TypeScript strict, TanStack Query, repository interface và UI
map/history/alerts. Không tạo model sensor/plot/measurement song song.

## Kiến trúc

```text
SimulationEngine (pure TypeScript, seed + clock + scenarios + history)
   ↓
SimulationRuntime (một instance, điều khiển + đồng hồ browser)
   ↓
mockRepository implements FarmRepository
   ↓
TanStack Query hooks → map/heatmap, details, history, alerts
```

`SimulationBridge` đăng ký runtime một lần trong app, chạy timer 1 giây và
invalidate query farm/history **chỉ mode DEMO** sau mỗi thay đổi. Cleanup timer
và subscription khi unmount, phù hợp StrictMode. Query keys được giữ ổn định,
không tạo cache key mới vô hạn mỗi tick. LIVE vẫn fail closed, không nhận dữ
liệu engine hoặc tự fallback. Development panel không nằm trong sidebar nông dân.

Khi chưa bấm Bắt đầu, mock repository vẫn trả fixture DEMO tĩnh cũ (giữ màn xem
trước/regression). Khi start, tất cả getFarm/getHistory chuyển sang cùng engine;
không ghép lịch sử fixture cũ vào lịch sử engine. Sau Reset engine vẫn là nguồn
đang chọn nhưng dừng; bấm Tiếp tục để chạy. Tải lại trang làm mất phiên in-memory
và quay về màn xem trước. Không ghi localStorage hoặc tự lưu dữ liệu xuống backend.

## Engine và thời gian

- `SimulationEngine({ seed, intervalSeconds, startAt })`; mặc định seed 42,
  chu kỳ 600 giây, mốc `2026-11-03T00:00:00Z` (07:00 UTC+7).
- 12 ID A-01…C-04 từ geometry có sẵn. NORMAL có 4 sensor/metric mỗi vùng
  (48 sensor); khác màn fixture tĩnh cũ có 43 sensor và lỗi dựng sẵn.
- LCG seeded random, random walk có bước nhỏ, clamp trong miền mô phỏng;
  đọc snapshot/history hoặc React render không tiêu thụ random và không tạo mẫu.
- `advance(realMs)` đẩy đồng hồ logic theo speed; chỉ sinh mẫu khi tới mốc chu kỳ.
  Pause đóng băng đồng hồ, resume không tính thời gian pause. Seed + cấu hình +
  cùng chuỗi lệnh/advance cho kết quả tái lập; thời gian bấm nút thực khác nhau
  thì timeline khác nhau là bình thường.
- Tốc độ UI 1×, 60×, 600×, 3600×. 600× tương đương một mẫu mỗi giây thực ở chu kỳ
  600 giây. Runtime dùng performance.now, chốt thời gian trước pause/đổi speed;
  bắt kịp tối đa 10 giây thực mỗi pulse sau khi tab ngủ để tránh khóa browser.
  Engine không nhận advance hơn 10.000 chu kỳ một lần; có thể chia bước dài.
- Lịch sử bắt đầu bằng một mẫu khởi tạo, sau đó tăng theo đồng hồ; không bịa
  24h/7d/30d trước thời điểm start. Bộ lọc chỉ trả mẫu thực sự đã mô phỏng trong
  khoảng chọn. Giữ 30 ngày ở cadence mặc định; tối đa 10.000 mẫu mỗi sensor
  nếu cấu hình cadence nhỏ hơn. Không bảo đảm đủ 30 ngày ở mọi cadence tùy chỉnh.
- Đổi scenario là sự kiện thử nghiệm có tác dụng tức thì, có thể gây bước nhảy
  sang miền sự cố. Có thể tạo mẫu đánh giá tại thời điểm đổi scenario; không
  đổi lịch các mốc chu kỳ. Mẫu trùng timestamp được thay thế, không nhân đôi.
  Giữa các chu kỳ cùng scenario, biến thiên được giới hạn và liên tục theo bước.
- `exportState()` cho dữ liệu JSON-serializable: info, FarmData, history và
  diagnostics; Map/listener/timer không nằm trong payload. Chưa có import/restore
  state hoặc API gửi payload; các phần đó không được yêu cầu.

Giới hạn vật lý mô phỏng: nhiệt độ 10–45°C, RH 30–95%RH, đất 0–80%, pH 3–9.
Miền NORMAL hẹp hơn: 23–28°C, 60–80%RH, 30–45%, pH 6–7. Không coi các miền
này là quy trình nông học đã kiểm chứng. Sensor DEMO đất được đánh dấu hiệu chuẩn
chỉ để thử đơn vị %, không đại diện cho hiệu chuẩn phần cứng.

## Scenario xác định

Mọi sự cố tác động A-03; các vùng còn lại giữ NORMAL.

| Scenario             | Kết quả                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| NORMAL               | 12 vùng đủ 4 chỉ số, online và nằm trong ngưỡng DEMO mặc định                                   |
| LOW_SOIL_MOISTURE    | Độ ẩm đất A-03 trong 5–15%, ngoài ngưỡng minh họa                                               |
| HIGH_AIR_TEMPERATURE | Nhiệt độ A-03 trong 36–44°C, cảnh báo                                                           |
| ABNORMAL_SOIL_PH     | pH đất A-03 trong 3–4,5, cảnh báo                                                               |
| SENSOR_OFFLINE       | A-03 offline, dừng sinh mẫu ở vùng đó, giữ số hợp lệ cũ và timestamp                            |
| STALE_DATA           | Gateway delayed; A-03 không sinh mẫu mới trong khi đồng hồ tiếp tục; timestamp cũ, màu quá hạn  |
| MISSING_SENSOR       | Loại sensor pH A-03 khỏi assignment/registry và snapshot hiện tại; không điền giá trị           |
| INVALID_MEASUREMENT  | Thử pH 999, loại trước khi ghi history; có diagnostics và invalidMetrics; không đưa vào heatmap |

Khi thiếu sensor, lịch sử hợp lệ từ trước khi tháo sensor không bị xóa. Khi có
mẫu không hợp lệ, snapshot giữ **số đo hợp lệ gần nhất**, kèm lý do mẫu mới bị
loại và thời điểm đo cũ; không gán timestamp mới cho số cũ. Map ghi lỗi số đo,
heatmap loại vùng đó, panel/alerts nêu lý do. Diagnostics giữ tối đa 100 mẫu lỗi.
JSON không có NaN/Infinity giả làm giá trị đo. NORMAL/reset khôi phục sensor
và bỏ cờ invalid; dữ liệu cũ không bị biến thành dữ liệu mới từ API.

## PRE_PAW

Mẫu mới mặc định UNKNOWN. Nút **Tạo phiên đo trước tưới DEMO** tạo ID phiên và
mốc đợt tưới giả lập sau hai chu kỳ; duy nhất chu kỳ kế tiếp có PRE_PAW với
irrigationEventId/At. Thời điểm mẫu đi trước event; chu kỳ sau quay lại UNKNOWN.
Đổi scenario không tự tiêu thụ/gắn nhãn phiên đang chờ. Mẫu bị loại không được
đưa vào lịch sử PRE_PAW. Panel ghi giai đoạn theo từng số đo, không tự kết luận
một vùng đủ điều kiện tưới. Không có lệnh điều khiển bơm hoặc tưới thật.

## Chạy trên Windows

Node 24 LTS >=24.15. PowerShell trong thư mục `paw-frontend`:

```powershell
npm ci
npm run dev
```

Mở URL Vite in ra và thêm `/dev/simulation`, ví dụ
`http://127.0.0.1:5173/dev/simulation`.

1. Giữ chế độ DEMO. Nếu đang LIVE, đổi về DEMO trong Cài đặt; không tự fallback.
2. Chọn scenario và speed, bấm Bắt đầu. Xem đồng hồ và nhãn DỮ LIỆU MÔ PHỎNG.
3. Dùng các liên kết trong panel đến map A-03/history/alerts. Không reload trang
   nếu muốn giữ phiên. Ở 600×, mỗi giây thực xấp xỉ một chu kỳ đo.
4. Tạm dừng để đối chiếu số đo giữa map, chi tiết và history. Tiếp tục để chạy.
5. Đặt lại trả về seed/mốc đầu/NORMAL, xóa history/diagnostics và tạm dừng.
   Chọn scenario rồi Tiếp tục. Có thể tạo phiên PRE_PAW khi đã kích hoạt engine.

Route chỉ có khi `import.meta.env.DEV`; build production không cung cấp panel.
Không cần biến môi trường, tài khoản API, database hoặc phần cứng. OSM là dịch
vụ tile độc lập; lỗi/chặn tile không chặn engine, nhưng vẫn có thể làm nền map
trống như đã ghi ở T4. Module simulation không gọi fetch hoặc API backend.

## File tạo / sửa

Mới:

- `src/simulation/engine.ts`, `runtime.ts`, `SimulationBridge.tsx`.
- `src/pages/SimulationPage.tsx`.
- `tests/simulation.test.ts`, `tests/simulation-repository.test.ts`.
- `e2e/simulation.spec.ts` và tài liệu này.
- Ảnh panel development `docs/screenshots/simulator-*.png` do E2E tạo.

Sửa:

- `types/domain.ts`: metadata clockMode và invalidMetrics tùy chọn.
- `services/adapters/mockRepository.ts`: chọn fixture preview hoặc engine dùng chung.
- `app/AppRoutes.tsx`: bridge và route development.
- `WorkspacePage`, `AreaDetails`, `AlertsPage`, status selector: clock, phase và lỗi mẫu.
- `styles/global.css`: panel diagnostics và sửa sidebar bị dịch link khi hover,
  lỗi phát hiện trong luồng E2E simulation → history → alerts.
- README: cách chạy T8A. Không thêm dependency, không sửa interface repository,
  không đổi hooks lấy dữ liệu, API client hoặc LIVE adapter.

## Kiểm thử và giới hạn

Unit/domain/repository: seed, random bounds/drift, 12 ID, 4 metric, cadence,
speed, pause/resume, reset, 8 scenario, missing/stale/offline/invalid, read-copy
isolation, snapshot/history, PRE_PAW có event, JSON và LIVE không dùng simulation.

Các test trước vẫn giữ nguyên. Một lượt chạy unit đồng thời browser bị timeout
ở lazy-load map trong jsdom; chạy tuần tự đã đạt 54/54 tests, không tăng timeout
hoặc vô hiệu hóa strict/test để vượt lỗi. Typecheck/lint/build cũng đạt.

E2E simulation kiểm tra start/pause/resume/reset, scenario, nguồn DEMO trong
panel, map → detail → history đối chiếu cùng giá trị và alerts A-03. Kết hợp
E2E geographic cũ ở 1920×1080, 1366×768, 390×844, 360×800. **Kết quả cuối: 8/8 E2E đạt**. Không tuyên bố đã thử thiết bị thật.

Chưa persistence, seed editor trên UI, import state hoặc backend. Seed/cadence/
startAt có thể cấu hình qua constructor TypeScript và đã kiểm thử. Chưa push
T8A lên GitHub, không deploy; giữ audit T8 cũ làm lịch sử thay vì xóa tài liệu.
