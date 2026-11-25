# Hợp đồng frontend — PAW mobile nodes API v1.0

## Tình trạng thực tế

Đã kiểm tra repository PAW-Frontend. `FarmRepository` có `getFarm` và `getHistory`, nhưng `VerifiedReadContract` cũ yêu cầu `nodeIdForPlot` trả đúng một node, cố định `nodeIds`, đọc `/v1/nodes/status`, `/v1/nodes/{id}/latest` và telemetry. Nó không phù hợp node di động, nhiều node/vùng hoặc hai độ sâu.

Backend mới không giả vờ cung cấp các endpoint cũ với semantics sai. `repositoryFactory.ts` frontend vẫn đóng LIVE. Chỉ đổi base URL hoặc bật VITE_DATA_MODE=LIVE sẽ chưa kết nối được backend này. Không có thay đổi hoặc push frontend trong lần phát triển backend này.

OpenAPI tại `docs/openapi.json` được sinh từ `create_app().openapi()`, các response chính có Pydantic model: `SnapshotOut`, `MeasurementOut`, `HistoryOut`, `DeploymentOut`, `AckOut`. API thực được kiểm thử bằng TestClient và SSE TCP thật.

## Bootstrap và SSE

1. Lấy quyền truy cập viewer/operator cho farm ở runtime; không build admin/gateway token vào Vite. Trước production cần login/session phù hợp thay việc cấp long-lived API keys cho nông dân.
2. GET `/v1/farms/{id}/map`, lưu cursor và toàn bộ snapshot.
3. Dùng `fetch` stream GET `/v1/farms/{id}/events?since=<cursor>` với header Authorization. SSE gửi snapshot đầy đủ ngay khi kết nối và khi dữ liệu/trạng thái thay đổi. Không cần GET map theo chu kỳ hoặc mỗi gói tin.
4. Thay thế atomically data cache theo snapshot, không cộng dồn các mảng vì sẽ tạo duplicate marker/số đo. Giữ selection/filter/camera/panel ở state UI riêng.
5. Đọc SSE theo block ngăn bằng dòng trống; HTTP chunk có thể cắt giữa UTF-8/JSON, không coi mỗi chunk là một event. Handle CRLF, comments heartbeat và nhiều dòng data.
6. Khi mất kết nối: đánh dấu stream disconnected, dùng reference_time/freshness để không trình bày dữ liệu cũ như bình thường; reconnect có backoff giới hạn. 401/403 hoặc `auth.revoked` phải dừng và yêu cầu xác thực lại. Cursor 409 → lấy snapshot mới rồi nối lại.
7. Reconnect nhận trạng thái hiện tại, không phải replay từng raw event. Dùng history API cho dữ liệu đo đầy đủ. Không loại sự kiện chỉ vì cursor bằng cursor cũ: trạng thái thời gian stale/offline có thể đổi mà không có transaction ingest mới.

## Mapping

| Backend | Frontend xử lý |
| --- | --- |
| `farm.source = simulation` | DEMO + nhãn DỮ LIỆU MÔ PHỎNG; không gọi là số đo thực |
| `farm.source = sensor` | LIVE, không fallback sang fixtures nếu lỗi |
| `plots[].geometry` | GeoJSON lon/lat, Google chuyển sang `{lat,lng}` |
| `nodes[].position` | GPS đã xác nhận; marker có trạng thái placement/connectivity |
| `nodes[].candidate_position` | GPS mới chưa xác nhận; dùng marker phụ/accuracy circle nếu cần, không trình bày như đã cắm |
| `nodes[].deployment` | Nguồn liên kết node↔plot hiện tại, không gán cố định node vào plot |
| `sensors[].depth_cm` | Filter độ sâu riêng; air có depth null |
| `latest[]` | Một số đo mới nhất/sensor trong deployment active; không lấy latest của vị trí cũ làm của vị trí mới |
| `heat_points[]` | Các số đo đủ điều kiện, có GPS; frontend lọc metric và depth trước nội suy |
| `measurement_phase`, `session_id` | PRE_PAW có căn cứ phiên đo; khác với chỉ lấy latest |
| `alerts[]` | Cảnh báo hiện tại; history/acknowledge dùng endpoint riêng |
| `reference_time` | Thời gian server tính trạng thái; không ghi đè observed_at bằng giờ render |

History: GET `/v1/farms/{id}/measurements`, lọc `plot_id`, `node_id`, `deployment_id`, `sensor_id`, `metric`, `depth_cm`, `phase`, `start` inclusive, `end` exclusive, `limit` tối đa 1000. Theo `next_cursor` tới hết dữ liệu khi cần biểu đồ. Không chỉ tải 100 mẫu rồi trình bày như toàn bộ 30 ngày. Đơn vị và timezone lấy từ payload.

## Các thay đổi frontend cần làm tiếp

- Thay VerifiedReadContract giả định một node/vùng bằng adapter snapshot contract 1.0; giữ Repository Pattern và tách DEMO/LIVE.
- Bổ sung model `Node`, `Deployment`, `SensorReading`, filter depth. `PlotSnapshot.measurements[metric]` hiện chỉ có một giá trị/metric/vùng nên không đủ biểu diễn nhiều node và nhiều độ sâu; không âm thầm ghi đè một giá trị bằng node cuối cùng.
- Nối SSE vào React Query `['farm', mode]`, dọn stream/credential cache khi đổi mode/farm/logout; giữ history cache đúng nguồn. Tắt refetch interval/focus trùng bootstrap nếu muốn một REST bootstrap.
- Thêm luồng operator xác nhận cắm/rút, xem candidate GPS và accuracy, chọn vùng nếu nằm trên nhiều polygon. Viewer không có nút thao tác ghi.
- T8B hiện tắt heatmap cho geographic và chỉ có IDW ở hệ sơ đồ. Cần đổi overlay sang phạm vi GPS có phép chiếu mét cục bộ phù hợp, clip theo ranh giới thật; không đưa lat/lng thẳng vào x/y sơ đồ 1100×720.
- Chỉ bật nội suy khi đủ điểm không đồng tuyến, độ phủ và khoảng cách phù hợp; không ngoại suy kín vùng chưa có dữ liệu. Google và Leaflet render overlay riêng, dùng chung tập điểm và thuật toán; Google Map instance giữ nguyên.
- Kiểm thử chọn node, chuyển vị trí, nhiều node/vùng, depth, stream reconnect, offline, history, mobile và API key Google thực.

Đây là phần tích hợp frontend tiếp theo được xác định rõ, không được đánh dấu đã hoàn thành chỉ vì backend trả được dữ liệu. Không có key Google nên chưa nghiệm thu imagery thực.
