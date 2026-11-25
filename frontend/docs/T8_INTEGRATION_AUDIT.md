# T8 — Audit và kế hoạch tích hợp Frontend–Backend PAW

Ngày kiểm toán: 03/11/2026, UTC+7. Phạm vi: đọc mã và lập kế hoạch; chỉ thêm tài
liệu này. Không hiện thực adapter, sửa frontend/backend/database, ingest hoặc
ACK; không triển khai production, không commit/push trong lần kiểm toán này.

## 1. Kết luận và mức độ bằng chứng

**Chưa đủ bằng chứng để kết nối LIVE. Không có API backend nào được xác minh.**
Frontend thực sự có trong `/workspace/paw-frontend`. Không tìm thấy backend
FastAPI/PostgreSQL, OpenAPI/Swagger, schema Python/SQL hoặc URL backend thực trong
workspace và tệp đính kèm. Các endpoint dưới đây mới là đường dẫn phía client,
không phải xác nhận rằng backend đã triển khai chúng.

Không dùng endpoint, tên trường hoặc payload do suy đoán để điền VerifiedReadContract.
Giữ LIVE bị khóa cho tới khi có hợp đồng và dữ liệu mẫu đã kiểm chứng. Hoàn thành
kiểm toán frontend trong phạm vi dữ liệu hiện có; phần backend còn chờ bằng chứng.

### Phương pháp kiểm tra

- Kiểm tra danh sách file workspace, tìm AGENTS.md, OpenAPI/Swagger, schema,
  Python, requirements/pyproject, SQL, compose và project WPF; bỏ dependency,
  build outputs, Git metadata và các thư mục credentials.
- Hai tệp văn bản trong `attachments/` là yêu cầu triển khai, không phải schema.
  Ba ZIP tại gốc workspace đều chứa 75 tệp frontend, không có Python, SQL hoặc
  OpenAPI/Swagger theo tên thành viên archive.
- Không có `.env` riêng trong frontend; `.env.example` chỉ có DEMO và URL ví dụ
  được comment. Runtime không đặt `VITE_API_BASE_URL`. Không đọc tệp bí mật.
- Git frontend hợp lệ, HEAD local `561d7d2`; worktree sạch trước kiểm toán.
  Các lần cập nhật GitHub trước đây dùng API và có SHA khác local; báo cáo này
  dựa trên **nội dung workspace hiện tại**, không suy ra remote đồng bộ từ HEAD.
- Không dò cổng/đoán địa chỉ server và không truy cập PostgreSQL. Chưa được cung
  cấp backend URL hoặc repository backend để kiểm tra OpenAPI qua mạng.

Để tiếp tục xác minh cần một trong: mã backend kèm chỉ dẫn chạy, file OpenAPI
JSON/YAML xuất từ đúng bản backend, hoặc URL đọc `/openapi.json` và quyền truy
cập phù hợp. Kèm payload đã loại bí mật cho thành công/rỗng/lỗi, quy tắc auth
đọc và danh mục node/sensor. Không gửi gateway ingest token vào frontend.

## 2. Các thành phần frontend đã hoàn thành và đã đọc

| Thành phần                   | Bằng chứng trong mã                                                             | Đánh giá tích hợp                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| HTTP client                  | `src/services/api/client.ts`                                                    | GET, encode node ID, timeout 10 giây, AbortSignal, lỗi HTTP/JSON/mạng; body là `unknown`        |
| Ranh giới adapter            | `src/services/adapters/liveRepository.ts`                                       | Có VerifiedReadContract, kiểm tra mode LIVE và node hợp lệ; chưa có mapper thực                 |
| Chọn repository              | `src/services/repositoryFactory.ts`                                             | DEMO → mock; LIVE → `createLiveRepository()` không client/contract, nên báo chưa tích hợp       |
| Interface dữ liệu            | `src/services/repositories.ts`                                                  | `getFarm`, `getHistory`; UI không cần gọi backend trực tiếp                                     |
| Query hooks                  | `src/hooks/useFarmData.ts`, `useHistoryData.ts`                                 | Key tách DEMO/LIVE; history có plot/metric/range/phase; chuyển signal                           |
| Cấu hình và kiểm tra kết nối | `.env.example`, `src/pages/SettingsPage.tsx`                                    | Base URL mới nối vào nút kiểm tra health, chưa nối LIVE repository                              |
| Mô hình miền                 | `src/types/domain.ts`                                                           | Plot, Sensor, Measurement, Snapshot, FarmData; tách observed/received, phase/event              |
| DEMO                         | `src/data/mock/*`, `mockRepository.ts`                                          | 12 vùng, dữ liệu/lịch sử xác định, đồng hồ cố định; không dùng làm payload LIVE                 |
| UI                           | WorkspacePage, AreaDetails, TelemetryHistory                                    | Map, panel, lịch sử và mobile đã có; chỉ cần cập nhật binding/nhãn liên quan tích hợp           |
| Bản đồ/heatmap               | `src/features/geo-map/config.ts`, `src/features/farm-map/heatmap.ts`            | GeoJSON dựng từ sơ đồ gần Đà Lạt; IDW dùng tâm vùng mô phỏng, chưa có cơ sở GIS LIVE            |
| Test hiện có                 | `tests/api.test.ts`, `mode.test.tsx`, `data-states.test.tsx`, `history.test.ts` | Kiểm tra bằng mock; chưa có fixture backend/schema xác minh hoặc read-contract integration test |

## 3. API backend được xác minh

**Số API đã xác minh với backend thực: 0.** OpenAPI version, backend build/version,
server URL, security scheme, response model và query parameters đều chưa có bằng
chứng. `openApiVersion` của interface hiện tại là một chuỗi do frontend cung cấp,
không phải chứng thư rằng mapper tương thích với backend.

| Route client đang dự kiến       | Method client | Backend/auth/schema/tham số | Việc cần xác minh                                                                                          |
| ------------------------------- | ------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/health`                       | GET           | Chưa xác minh               | Auth, HTTP code, JSON hay text, ý nghĩa readiness; 200 không chứng minh DB hoặc telemetry hoạt động        |
| `/v1/nodes/status`              | GET           | Chưa xác minh               | Array/envelope, node ID, gateway/node state, last-seen, chu kỳ, pagination, quyền truy cập                 |
| `/v1/nodes/{node_id}/latest`    | GET           | Chưa xác minh               | Wide hay long payload, latest theo metric hay cả packet, null, đơn vị, timestamps, lỗi unknown node        |
| `/v1/nodes/{node_id}/telemetry` | GET           | Chưa xác minh               | Tên/kiểu/ràng buộc tham số thời gian, metric, pagination/cursor, sort, aggregation, timezone, empty result |

Không khẳng định backend có hoặc thiếu API farm/plot, sensor registry, calibration,
ngưỡng hay đợt tưới. Đây là **các khả năng chưa xác minh**, phải tìm trong schema
và source thật trước khi đề xuất thêm endpoint. Chưa có cơ sở đổi DB hoặc ingest.

### Xác thực và HTTP hiện tại

Client chỉ gửi `Accept: application/json`, `credentials: omit`; chưa có header
Authorization hoặc cơ chế refresh/session. Chưa biết backend đọc yêu cầu auth gì.
Nếu auth cookie: client hiện không gửi cookie; cần quyết định credentials,
SameSite, CORS theo origin chính xác và bảo vệ CSRF cho thao tác có tác dụng.
Nếu bearer: cần luồng đăng nhập người dùng và vòng đời token phù hợp, xử lý
401/403/expiry; không sử dụng token ingest/gateway và không hardcode token qua
`VITE_*`. Nếu read API không auth trong LAN, cần xác minh đây là chính sách có
chủ đích và giới hạn truy cập, không suy ra từ health.

Cần kiểm tra preflight, origins dev/production thực, HTTPS/mixed content,
reverse-proxy prefix, redirect và giới hạn truy cập. Không bật CORS wildcard để
lách cấu hình. Client hiện ép JSON ngay cả với health nên health text/204 sẽ bị
báo lỗi; chỉ điều chỉnh sau khi thấy hợp đồng thật.

## 4. Bảng mapping frontend/backend

Cột backend ghi trạng thái xác minh, **không phải tên field API được bịa ra**.

| Đích frontend                             | Backend hiện biết                     | Quy tắc mapping cần chốt / cách xử lý thiếu                                                           |
| ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Farm.id/name`                            | Chưa có field xác minh                | Lấy từ API nếu có; nếu dùng cấu hình quản trị, ghi rõ nguồn và phiên bản                              |
| `Plot.id/name/farmId/areaHa`              | Chưa xác minh                         | Không lấy node ID làm plot ID mặc định; diện tích thiếu để trống                                      |
| `Plot.geometry` / `Farm.coordinateSystem` | Chỉ có geometry DEMO frontend         | Cần ranh giới thật hoặc cấu hình có provenance; chưa có thì không gắn nhãn bản đồ thật                |
| `Plot.sensorIds`                          | Chưa có sensor registry xác minh      | Tách node thiết bị khỏi sensor/channel đo; danh sách thiếu không tự sinh sensor giả                   |
| `Sensor.id/metric/plotIds`                | Chưa xác minh                         | Ánh xạ theo sensor/channel và loại phép đo; trạm chung có nguồn riêng                                 |
| `Sensor.expectedIntervalSeconds`          | 600 giây hiện là DEMO                 | Xác minh chu kỳ theo node/sensor, tolerance và gateway; không mặc định dữ liệu thực luôn 600 giây     |
| `Sensor.calibrated`                       | Chưa có chứng cứ calibration          | Không mặc định true; model cần thể hiện unknown nếu chưa biết                                         |
| `Measurement.sensorId/metric`             | Chưa xác minh wide/long payload       | Runtime parser → mapper theo registry; tên tương tự không đủ chứng minh cùng phép đo                  |
| `Measurement.value/unit`                  | Chưa xác minh                         | Chỉ số hữu hạn, null là thiếu; không null→0; quy đổi đơn vị cần quy tắc có kiểm chứng                 |
| `soil_moisture`                           | Chưa biết VWC/raw/điện áp/đơn vị      | Không ADC→% nếu thiếu hiệu chuẩn; giữ đơn vị gốc hoặc trạng thái chưa hỗ trợ                          |
| `soil_ph`                                 | Chưa biết sensor đo đất hay PAW water | Chỉ map khi môi trường đo được xác nhận; pH nước PAW không map thành pH đất                           |
| `observedAt`                              | Chưa biết thời điểm đo nào            | Phân biệt giờ thiết bị/gateway/server; yêu cầu timezone/epoch unit; không đoán giây hay mili giây     |
| `receivedAt`                              | Chưa xác minh                         | Optional; không copy observedAt hoặc dùng thời điểm fetch thay thế                                    |
| `source/sourceLabel`                      | Chưa xác minh                         | Sensor tại luống, trạm dùng chung, simulation phải tách; không map simulation thành sensor            |
| `measurement_phase`                       | Chưa xác minh API trước tưới          | Mặc định UNKNOWN khi không có bằng chứng; không suy PRE_PAW từ thời điểm cũ hoặc nút lọc              |
| `irrigationEventId/At`                    | Chưa xác minh                         | Chỉ gắn event thật và quan hệ thời gian được backend xác nhận; không dùng ID `demo-*`                 |
| `PlotSnapshot.connectivity`               | Chưa xác minh node/gateway state      | unknown khi thiếu; gateway online không tự chứng minh mọi sensor online                               |
| `measurements` của snapshot               | Chưa xác minh latest theo metric      | Partial record; không lấp trường chưa đo; giữ timestamp riêng từng phép đo                            |
| `FarmData.referenceTime`                  | Đồng hồ DEMO cố định hiện tại         | LIVE dùng clock thống nhất, xem xét server time/clock skew; cập nhật tuổi dữ liệu khi màn hình mở lâu |
| History `range/phase/metric`              | Chưa biết query và pagination         | Dịch sang params đã xác minh, UTC window; merge/sort/dedup chỉ theo định danh có căn cứ               |
| Cảnh báo                                  | Chỉ có ngưỡng minh họa frontend       | Phân biệt cảnh báo cấu hình demo với cảnh báo vận hành; không sinh quyết định tưới                    |
| Heatmap point                             | Tâm polygon mô phỏng                  | Cần vị trí sensor phù hợp, chất lượng/timestamp và điều kiện nội suy; không dùng tâm giả cho LIVE     |

## 5. Những điểm không tương thích và rủi ro cụ thể

Các điểm dưới đây được xác minh ở **mã frontend**; không khẳng định backend có
lỗi tương ứng khi chưa đọc backend.

1. **Factory chưa nối client/contract.** Đặt base URL hoặc đổi mode không mở LIVE.
   `/health` thành công cũng không mở được repository.
2. **Cardinality không đủ.** `nodeIdForPlot(plotId): string` chỉ trả một node.
   Một vùng có thể nhiều node/sensor, trạm chung có thể phục vụ nhiều vùng, và
   một node có nhiều metric. `nodeIds` phẳng không thể hiện quyền sở hữu metric,
   nguồn dùng chung hoặc thay node theo thời gian.
3. **Partial failure chưa được thiết kế.** getFarm dùng Promise.all cho status
   và latest mọi node; một node lỗi làm hỏng toàn farm. Cần phân biệt lỗi auth/
   schema nền tảng (fail toàn bộ) với node thiếu/offline hoặc lỗi riêng có thể
   trả dữ liệu một phần, luôn kèm trạng thái. Không âm thầm nuốt lỗi schema.
4. **Không có runtime validation.** Payload unknown là đúng ranh giới, nhưng
   VerifiedReadContract mới có chữ ký mapper. Kiểm tra version string và
   `data.mode === LIVE` không đủ kiểm tra dữ liệu, đơn vị, timestamp, tenant.
5. **Lịch sử còn thiếu điều phối.** Adapter chỉ fetch một node, một lần; chưa
   xử lý nhiều node, pagination, limit, thời điểm thay thiết bị, dedup hoặc
   capability trước tưới. Không truyền các tên params tự nghĩ ra vào telemetry.
6. **Clock/cache.** staleTime LIVE 30 giây chỉ đánh dấu cache stale, không phải
   polling. Không có refetchInterval/clock tick; referenceTime có thể đứng yên
   khi mở màn hình, khiến số đo mới hết hạn vẫn trông bình thường. Cần clock
   cập nhật độc lập, cadence và chính sách refetch/cancellation đã chốt.
7. **Cache scope.** Query key hiện tách mode nhưng chưa gồm API origin, farm,
   tài khoản/quyền và registry version; cần tránh reuse cache khi thay ngữ cảnh,
   logout hoặc đổi mapping. Không dùng dữ liệu cũ như fallback cho LIVE mới.
8. **Model GIS và calibration khóa DEMO.** Farm.coordinateSystem chỉ cho
   `relative-demo`; geometry thiếu CRS/provenance và Sensor không có GPS.
   `toLatLng` cố định gần Đà Lạt; marker/heatmap dùng tâm vùng giả lập. Không thể
   chỉ đổi mode và gọi đây là bản đồ/sensor thật. Boolean calibration không
   phân biệt unknown, có chứng nhận và hết hiệu lực.
9. **Một số UI còn nhãn cứng.** WorkspacePage có A-03 mặc định, DEMO và nhãn
   ranh giới giả lập; TelemetryHistory có caption/option trước tưới DEMO;
   AreaDetails luôn ghi chưa xác định trước tưới. Cần cập nhật nhỏ theo mode,
   capabilities và dữ liệu thật; không viết lại bố cục. Không tự đổi tất cả
   nhãn sang LIVE khi geometry/history vẫn mô phỏng.
10. **Đơn vị/precision.** formatMeasurement đổi nhãn soil chưa calibrated thành
    raw; không đủ để diễn tả mọi đơn vị sensor thật. Formatter làm tròn tối đa
    một chữ số, có thể không đủ pH. Parser phải chặn timestamp hỏng trước khi
    Intl.DateTimeFormat sử dụng; precision theo hợp đồng và loại cảm biến.
11. **Khả năng hỗ trợ không nên chỉ là boolean mode.** Backend có thể đọc latest
    nhưng chưa có event trước tưới, geometry hay history. Cần khả năng riêng và
    provenance riêng; tính năng chưa hỗ trợ không được lấp bằng mock trong LIVE.

## 6. Phương án VerifiedReadContract và LIVE repository (chỉ đề xuất)

### Pipeline đề nghị

`API read client → raw unknown → runtime validation theo OpenAPI thật → DTO đã
xác minh → registry node/sensor/plot → mapper miền → repository → Query hooks`.

- Lưu snapshot OpenAPI/version hoặc digest, backend build và ngày xác minh làm
  evidence của contract; version của OpenAPI specification khác version API
  nghiệp vụ. Không bật verified chỉ vì có chuỗi version bất kỳ.
- Chọn runtime validation hoặc type generation phù hợp sau khi biết schema
  thật; generated TypeScript types một mình không validate response runtime.
  Không thêm Zod/OpenAPI generator hoặc DTO trong lần audit này.
- Tạo read-contract cụ thể với parser status/latest/history, xử lý error/empty
  đúng hợp đồng. Fixture backend phải được loại bí mật và lưu provenance.
- Registry/mapping được kiểm tra trước khi gọi mạng; repository không import
  fixtures DEMO. Factory chỉ tạo client + contract khi config/registry hợp lệ.
  Query hooks giữ cùng interface UI, bổ sung cache scope/capabilities nếu cần.
- Clock LIVE dùng thời gian hiện tại hoặc server clock đã thống nhất; không
  lấy DEMO_NOW. Thiếu dữ liệu giữ undefined/unknown, không tạo số mặc định.
- Timeout/cancellation có sẵn được giữ. Chính sách retry cần có giới hạn cho
  network/429/5xx và tuân Retry-After; không retry vô hạn 401/403/schema mismatch.
- Với mỗi node gọi latest: cân nhắc giới hạn concurrency hoặc batch endpoint
  nếu backend thật đã có. Chưa có cơ sở thêm endpoint hoặc chỉnh ingest.
- Chưa có API farm/plot thì có thể dùng cấu hình quản trị đã xác nhận cho geometry
  và metadata, ghi rõ nguồn. Nếu chỉ có geometry DEMO thì phải tách nhãn và không
  bật heatmap LIVE từ tâm giả; không trộn phép đo thật vào fixture DEMO.
- Nếu contract thay đổi interface, thay trong services/types/hooks theo nhu cầu
  tối thiểu, cập nhật nhãn/capability UI tại các vị trí nêu trên. Không viết lại UI.

### Registry node → sensor/channel → vùng đất

Không dùng một bảng `nodeId → plotId` đơn giản làm giải pháp tổng quát. Đề nghị
cấu hình binding (đây là thiết kế frontend, **không phải response schema API**):

| Nội dung binding                                           | Mục đích                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Node ID thật + sensor/channel ID hoặc selector đã xác minh | Chọn đúng phép đo trong node, không đoán bằng tên vùng            |
| Metric và môi trường đo                                    | Phân biệt soil_ph với paw_water_ph và các phép đo khác            |
| Plot/farm ID và vai trò local/shared_station               | Giữ đúng nguồn, quyền truy cập và nhiều vùng dùng chung           |
| Hiệu lực từ/đến, registry version                          | Không gán lịch sử của node cũ sang vùng mới sau khi thay thiết bị |
| Calibration/unit transform có bằng chứng                   | Không chuyển raw sang % hoặc nhiệt độ sai đơn vị                  |
| Vị trí/CRS/provenance và chất lượng tọa độ                 | Điều kiện hiển thị marker và nội suy LIVE                         |

Validate ID tồn tại/duy nhất, metric binding không mâu thuẫn, interval không chồng
lấn trái phép, node thuộc đúng farm/quyền, polygon hợp lệ và đơn vị phù hợp.
Một vùng nhiều node: lấy lịch sử theo binding/metric có hiệu lực rồi merge có
căn cứ. Trạm chung được giữ sourceLabel riêng, không giả thành sensor tại luống.
Node không có binding bị cách ly với chẩn đoán, không tự gán vào vùng A-03 hoặc
vùng gần nhất. Hai sensor cùng metric cần quy tắc chọn/hiển thị đã chốt; không
âm thầm tính trung bình. Chỉ dùng cấu hình được người quản trị xác nhận, không
mặc định mapping A-01…C-04 chính là thiết bị thực.

## 7. Các thay đổi mã nguồn cần thực hiện sau audit

| Vị trí                                                          | Thay đổi dự kiến                                                                | Điều kiện trước khi làm                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `services/api/client.ts`                                        | Auth đọc, health content-type, params/error model theo hợp đồng                 | Backend/API security scheme xác minh        |
| `services/adapters/liveRepository.ts`                           | Contract cụ thể, parsing, nhiều binding, partial results, history orchestration | OpenAPI + fixture + quy tắc dữ liệu         |
| `services/repositoryFactory.ts`                                 | Nối base URL/client/contract/registry, giữ fail closed                          | Contract và config validate thành công      |
| Module registry/config mới trong services                       | Node/sensor/plot và hiệu lực; không chứa bí mật                                 | Danh mục node + cấu hình farm được xác nhận |
| `types/domain.ts`                                               | CRS/provenance, capability, calibration unknown, đơn vị, quality nếu cần        | Mapping chốt, không mirror schema chưa biết |
| `hooks/useFarmData.ts`, `useHistoryData.ts`                     | Cache scope, clock/refetch, windows, abort và pagination                        | Read policy, server limits và auth chốt     |
| geo-map config/FarmMap, heatmap selector                        | Dùng geometry/sensor positions thật, chặn nội suy không đủ căn cứ               | Ranh giới/CRS và vị trí đã xác minh         |
| WorkspacePage, AreaDetails, TelemetryHistory, AppShell/Settings | Nhãn nguồn, vùng mặc định hợp lệ, PRE_PAW/capabilities                          | Nguồn dữ liệu/capabilities xác định         |
| Formatter/status                                                | Clock, đơn vị/precision/calibration/quality                                     | Quy tắc nghiệp vụ được xác nhận             |
| `tests/`, `e2e/`, fixture hợp đồng                              | Các kiểm thử ở mục 9                                                            | Evidence backend đã loại bí mật             |

Không đề nghị migration, thay database, thay ACK/ingest hoặc đặt ingest token lên
client. Nếu API đọc thiếu dữ liệu, ghi yêu cầu read-side riêng để chủ backend
đánh giá trước; không tự tạo API trong frontend nhằm giả lập LIVE.

## 8. Thứ tự triển khai và điểm dừng

1. Nhận mã/URL/schema backend, read auth, mẫu payload; ghi phiên bản và phạm vi
   quyền. Đọc OpenAPI và router/model thực nếu có, chưa gọi thao tác ghi.
2. Lập bảng endpoint/status/error/params từ bằng chứng; xác nhận clock, units,
   soil vs water pH, calibration và capability PRE_PAW. Mục nào chưa biết ghi rõ.
3. Chốt registry nhiều node/sensor/vùng và geometry có provenance; xác định các
   khả năng thiếu có thể cấp bằng cấu hình, không mặc định cần sửa DB.
4. Thiết kế và review DTO/runtime validators, error policy, auth, retry, cache
   scope và polling; viết fixture tests trước khi nối LIVE. Không cần phần cứng.
5. Hiện thực parser/contract + registry + adapter, test HTTP fixture. Giữ DEMO
   nguyên vẹn, LIVE lỗi phải lỗi hoặc trạng thái thiếu tương ứng.
6. Nối factory và cập nhật hooks/nhãn/provenance tối thiểu; test toàn luồng với
   backend test hoặc fake HTTP server đúng hợp đồng đã xác minh.
7. Kiểm tra read-only backend test thực: OpenAPI/version, latest, history,
   auth/CORS/HTTPS và nguồn dữ liệu; chỉ sau đó nghiệm thu LIVE.
8. Dừng trước production. Triển khai production là yêu cầu riêng, chưa thuộc audit.

**Điểm chặn hiện tại: bước 1.** Không chặn việc hoàn tất báo cáo này, nhưng chặn
việc khẳng định schema hoặc bật adapter LIVE. Ngay cả khi có OpenAPI, dữ liệu và
quy tắc nghiệp vụ không được mô tả vẫn phải được xác nhận với backend.

## 9. Thiết kế kiểm thử tích hợp không cần phần cứng

Backend test có thể dùng dữ liệu test được tạo qua test factory/transaction
rollback hoặc fixture đã lưu từ API đọc. Không phát packet gateway giả vào ingest
và không đổi ACK. Nếu cần DB test, chỉ dùng instance/DB biệt lập và quyền cho phép;
không sửa DB thật. Mock HTTP dựa trên contract thực, không dựa trên DEMO fixtures.

| Nhóm             | Ca kiểm thử và điều kiện đạt                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema/contract  | Payload đúng và sai kiểu, thiếu/null, enum lạ, timestamp lỗi, NaN/Infinity; từ chối dữ liệu không hợp lệ có chẩn đoán, không cast ép                             |
| Units/semantics  | °C/đơn vị khác được chấp nhận theo contract, raw/VWC/% đất đúng calibration, không map pH nước thành pH đất, precision hợp lý                                    |
| Latest/status    | Online/offline/delayed/unknown, sensor lỗi nhưng gateway online, không có latest; mỗi phép đo giữ timestamp riêng và nguồn                                       |
| Nhiều binding    | Một plot nhiều node, node nhiều metric, trạm chung nhiều plot, node thay theo thời gian, duplicate/unmapped; không cross-plot/cross-farm                         |
| History          | 24h/7d/30d UTC, biên inclusive/exclusive theo API, sort, duplicate, paging đến hết/limit, empty, hủy giữa các trang; không bỏ/trùng mẫu                          |
| PRE_PAW          | Chưa hỗ trợ → UNKNOWN/thông báo; có hỗ trợ → event thật và thời gian hợp lệ; không nâng dữ liệu cũ hoặc DEMO thành PRE_PAW thật                                  |
| Auth             | Không auth khi được phép, 401/403, expiry/logout/switch-user, đúng quyền farm; không dùng ingest token, không rò response body/token                             |
| Transport        | HTTP lỗi, JSON hỏng, schema mismatch, timeout, AbortSignal trước/trong fetch, retry giới hạn, 429/Retry-After, partial node failure theo policy                  |
| Cache/clock      | DEMO→LIVE lỗi không lộ mock; đổi origin/farm/user/registry không dùng cache cũ; số đo chuyển quá hạn khi không có data mới; reconnect không tạo timestamp đo mới |
| UI integration   | Chọn vùng → đúng số/đơn vị/nguồn/thời gian, đổi lớp giữ selection, no-sensor không là zero, loading/empty/error/retry, history chưa hỗ trợ được ghi rõ           |
| Geometry/heatmap | CRS/lat-lng thứ tự đúng, tọa độ không thật không gắn LIVE, chỉ nội suy khi đủ điều kiện; không dùng tâm DEMO làm GPS sensor                                      |
| E2E browser      | Desktop/mobile, CORS/cookie hoặc bearer đúng phương án thật, network chỉ đến read API/provider cần thiết; không phát request ingest/ACK/ghi                      |

Fixture tests không chứng minh server hoạt động; cần thêm lần chạy against backend
test thực (read-only) sau khi các test không phần cứng đạt. Tách lỗi tile OSM khỏi
kết quả tích hợp telemetry; tile bị chặn không chứng minh lỗi FastAPI.

### Checklist nghiệm thu LIVE

- [ ] Có OpenAPI snapshot/version/digest và bằng chứng endpoint/auth/params thực.
- [ ] Các dòng mapping bắt buộc đã xác minh; khoảng trống có capability/nguồn
      cấu hình rõ, không coi các trường chưa biết là backend chắc chắn thiếu.
- [ ] Registry node/sensor/plot, calibration/units/time và geometry đã validate.
- [ ] Contract tests và fixture integration không phần cứng đạt; lỗi schema
      không được bỏ qua hoặc thay bằng DEMO.
- [ ] Không có bí mật/gateway ingest token trong source, env công khai, bundle,
      log, screenshot hoặc fixture.
- [ ] Factory thực sự nối client/verified contract; latest/history/auth đã được
      kiểm chứng với backend test, không chỉ `/health` hoặc fetch mock.
- [ ] Clock/staleness, cache isolation, timeout/abort/retry và partial failure đúng.
- [ ] Nhãn LIVE/DEMO và geometry/source/history capabilities đúng từng phần;
      PRE_PAW chỉ khi có bằng chứng đợt khảo sát/đợt tưới xác nhận.
- [ ] Build/typecheck/lint/unit/integration/E2E liên quan đạt khi hiện thực thay đổi.
- [ ] Backend ingest/ACK không thay đổi; DB thật không bị sửa; chưa production.

## 10. Kiểm chứng trong lần audit này

Đã đọc mã/test và kiểm kê workspace như trên. Kiểm thử tập trung phía frontend:
`npm test -- tests/api.test.ts tests/mode.test.tsx`: **7/7 tests đạt trong 2 file**.
Đây là test với HTTP mock và DEMO, **không phải kiểm chứng backend**. Không chạy
lại toàn bộ build/E2E vì chỉ thay tài liệu và không hiện thực tích hợp.

Tệp duy nhất được tạo: `docs/T8_INTEGRATION_AUDIT.md`. Trước và sau audit đối
chiếu SHA-256 các tệp nguồn/cấu hình/tài liệu đã có để xác nhận không sửa chúng.
