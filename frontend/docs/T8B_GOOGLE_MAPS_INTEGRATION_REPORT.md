# T8B — Google Maps Integration & Interactive Farm Map

Ngày kiểm tra: 04/11/2026. Phạm vi: frontend React/TypeScript hiện có. Không sửa backend, database, API, ingest/ACK hoặc dữ liệu simulator; không triển khai production, đăng ký Cloud/Billing hay push GitHub.

## 1. Audit trước thay đổi

| Thành phần                                                | Hiện trạng và cách tái sử dụng                                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/geo-map/FarmMap.tsx`                            | React Leaflet, GeoJSON polygon, Tooltip số đo, CircleMarker cụm cảm biến, fit/zoom/pan và ResizeObserver. Trước đây là renderer duy nhất của Workspace.                                      |
| `features/geo-map/config.ts`                              | Tile URL HTTPS chính thức `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution OSM, maxZoom 19; phép chiếu DEMO gần Đà Lạt. Không phải ranh giới khảo sát.                          |
| `features/farm-map/FarmMap.tsx`                           | Sơ đồ SVG độc lập tile, kéo/zoom/fit, chọn vùng bằng chuột, chạm, Enter/Space. Tái sử dụng làm fallback.                                                                                     |
| `HeatmapLayer.tsx`, `heatmap.ts`, `GeographicHeatmap.tsx` | IDW p=2, raster SVG làm mượt, clip polygon có dữ liệu hợp lệ, contour 12 mức. Giữ nguyên thuật toán và quy tắc loại số đo offline/stale/không hợp lệ/trạm chung.                             |
| Domain/repository                                         | 12 vùng A-01…C-04, 4 metric, tọa độ sơ đồ `relative-demo`. Fixtures và simulator cùng Repository Pattern. Không tạo nguồn dữ liệu mới khi đổi bản đồ.                                        |
| Workspace và layout                                       | Vùng được chọn nằm trong Workspace/query parameter; metric, filter và panel độc lập renderer. Giữ sidebar icon/hover/focus/ghim, dock công cụ, fullscreen và Bottom Sheet với thao tác vuốt. |
| Tests                                                     | 54 unit tests trước T8B; E2E geographic và simulation chạy ở 1920×1080, 1366×768, 390×844, 360×800. `e2e/legacy` đã được loại khỏi cấu hình từ trước; T8B không thay đổi danh sách bỏ qua.   |

## 2. Điều tra tile OSM

Đã tái hiện bằng yêu cầu đọc, không giả User-Agent/referrer và không dùng proxy để vượt chặn:

```bash
curl -I --max-time 15 https://tile.openstreetmap.org/17/105017/61153.png
```

Phản hồi tại môi trường cloud: **HTTP 200**, `content-type: image/png`, nhưng có **`x-blocked: Access denied. See https://operations.osmfoundation.org/policies/tiles/`**, cùng header không cache. Vì nhà cung cấp trả ảnh thông báo lỗi dưới HTTP 200, sự kiện `tileerror` của trình duyệt có thể không xảy ra. Đây là bằng chứng dịch vụ tile từ chối yêu cầu tại môi trường này; không khẳng định đã biết điều kiện cụ thể dẫn đến quyết định chặn.

| Hạng mục                  | Kết quả                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL, HTTPS, mixed content | URL chính thức dùng HTTPS; không có HTTP tile URL gây mixed content trong source.                                                                |
| Kết nối                   | Có phản hồi từ máy chủ; network policy phiên cloud là unrestricted. Không phải bằng chứng mất Internet.                                          |
| Chính sách tile           | Header `x-blocked` xác nhận từ chối ở nhà cung cấp. Giữ attribution và nguồn chính thức; không tải hàng loạt, cache offline tile hoặc lách chặn. |
| CORS                      | Chưa có bằng chứng lỗi CORS gây sự cố này. Leaflet hiển thị ảnh tile qua `<img>`, không đọc pixel bằng canvas.                                   |
| CSP                       | Repository không khai báo CSP chặn tile. Chưa kiểm tra header CSP tại domain production vì chưa triển khai.                                      |
| Mạng khác                 | Chưa xác minh OSM trên mạng/domain của người dùng. Không bảo đảm lỗi cloud xuất hiện ở mọi nơi.                                                  |

Xử lý: warning tồn tại sau tileerror; có hướng dẫn cả trường hợp ảnh lỗi HTTP 200 trong bộ chọn nền. Người dùng chủ động chọn sơ đồ hoặc Google, không có vòng lặp tự retry/chuyển provider. Schematic mặc định khi không có key để tránh phụ thuộc vào tile đang bị từ chối.

## 3. Kiến trúc provider

```text
Repository / simulator → useFarmData → Workspace (selectedId, metric, filter, details)
                                     ↓ một bộ props dữ liệu chung
                         FarmMapContainer
                         (provider, camera, DEMO projection, heat on/off, opacity)
                         ├─ FarmMap SVG: sơ đồ nội bộ
                         ├─ FarmMap Leaflet: OSM + GeoJSON + SVGOverlay
                         └─ GoogleMapsView: APIProvider + Map + Polygon/Marker/Circle
                                            + EnvironmentalOverlay (official OverlayView)
```

Mỗi renderer được lazy-load. Chỉ mount một engine; engine cũ và overlay/listener được tháo khi chuyển. Google SDK đã tải có thể còn trong bộ nhớ trang theo vòng đời loader chính thức; không cố xóa script rồi tải lặp lại. Không dùng Google tile URL, không dùng Google làm TileLayer Leaflet.

- Provider: Schematic, Google Satellite, Roadmap, Hybrid và OSM. Có key → ưu tiên Satellite; không key → Schematic.
- DEMO chỉ có sơ đồ tương đối: người dùng phải bật **“Cho phép chiếu tọa độ DEMO (không phải vị trí thật)”** trước khi mở một nền địa lý. Có badge trên bản đồ sau khi bật. Chưa bật thì không khởi tạo renderer địa lý.
- Thiếu key: không mount Google APIProvider hay phát request Google. Có thông báo tên biến cấu hình và nút fallback.
- Vùng, metric, filter, số đo/cảnh báo và trạng thái panel thuộc Workspace/repository, không reset khi đổi engine. Camera `{center:{lat,lng},zoom}` được lưu từ Leaflet moveend / Google idle rồi khôi phục khi đổi engine địa lý. Sơ đồ SVG có đơn vị riêng, không chuyển đổi camera sang lat/lng.
- Bộ chọn dạng `<details>` có thể mở bằng bàn phím hoặc chạm, thu gọn độc lập, không đẩy bản đồ. Các controls có target tối thiểu 44px; Google có danh sách chọn vùng bằng bàn phím, chỉ hiện khi focus.

## 4. Dữ liệu địa lý và environmental overlays

Domain giữ nguyên `geometry` sơ đồ; bổ sung tùy chọn `Plot.geographicGeometry` (GeoJSON Polygon, `[longitude, latitude]`) và `Sensor.position` (`latitude`, `longitude`). Farm khai báo `relative-demo | geographic`. Không tự gán GPS cho fixture hoặc sinh sensor mới.

`coordinates.ts` kiểm tra polygon có đủ đỉnh, số hữu hạn, ring đóng, giới hạn lon/lat và diện tích khác 0. Khi `geographic` thiếu geometry hợp lệ: báo lỗi, không suy đoán vị trí thật. Chuyển Google sang `{lat,lng}` và Leaflet sang `[lat,lng]` đúng thứ tự. Giới hạn latitude ±85° dành cho nền Mercator. Kiểm tra này không thay thế kiểm định topology GIS đầy đủ (tự cắt, lỗ nằm ngoài ring, v.v.).

Google: polygon theo trạng thái/số đo, viền trắng vùng chọn, marker nhãn vùng và giá trị, Circle cụm sensor DEMO. Sensor thật chỉ hiện khi có tọa độ sensor rõ ràng, hợp lệ và liên kết `sensorIds` của vùng đang hiển thị. Không dùng tâm vùng làm vị trí GPS sensor thật. Nhãn vùng dùng tâm trung bình các đỉnh để trình bày; đó không phải điểm khảo sát.

Heatmap/contour DEMO:

- Cả Google và Leaflet dùng chung `HeatPoint[]`, display domain và thuật toán IDW hiện có. Không random khi đổi nền hoặc render.
- Google dùng `OverlayView` chính thức, ảnh SVG nội bộ đặt theo projection của map; Leaflet dùng SVGOverlay. Không cần visualization heatmap API hoặc dịch vụ trả phí bổ sung.
- Có ít nhất 3 điểm hợp lệ mới có surface/contour; clip theo vùng có điểm đủ điều kiện. Vùng offline/stale/thiếu dữ liệu giữ màu trạng thái và số đo tương ứng, không bị surface tô nhầm là bình thường.
- Chọn metric cập nhật màu, nhãn, contour và chú giải hiện có. Bật/tắt và opacity áp dụng cùng cách trên 3 renderer.
- Nhãn giải thích nội suy DEMO không phải số đo thật ở mọi vị trí; không suy ra quyết định tưới PAW.

**Giới hạn có chủ đích:** chưa có ranh giới GPS/sensor GPS thực trong repository. Với `geographic`, polygon và sensor GPS được hỗ trợ nhưng heatmap tương đối bị tắt, kèm giải thích; không chiếu bừa nội suy sơ đồ lên đất thật. Muốn heatmap địa lý thật cần kiểm chứng dữ liệu vị trí, phép biến đổi/hệ tọa độ, đơn vị và phạm vi nội suy trước. Overlay DEMO trên cả Google và Leaflet đã có kiểm thử; không tuyên bố nội suy GPS thực đã hoàn thành.

## 5. Xử lý lỗi và offline

| Trường hợp                               | Hành vi                                                                                                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Không có browser key                     | Không tải Google; thông báo cấu hình và fallback thủ công.                                                                                                                                                                         |
| Script Google không tải được             | `APIProvider.onError` báo lỗi với các mục cần kiểm tra.                                                                                                                                                                            |
| Key/referrer/API/Billing bị từ chối      | `window.gm_authFailure` thông báo; callback cũ được bảo toàn và khôi phục khi unmount.                                                                                                                                             |
| SDK hoặc tile không sẵn sàng sau 15 giây | Watchdog một lần, dừng sau `tilesloaded`; không lặp tải vô hạn.                                                                                                                                                                    |
| Billing/quota                            | Thông báo kiểm tra key/referrer/Maps JavaScript API/Billing/quota. Google không luôn cung cấp mã lỗi có cấu trúc cho từng trường hợp; cần xem Console/Cloud Metrics để xác định chính xác. Không bắt log để suy diễn hoặc ghi key. |
| Offline sau khi mở app                   | Bắt sự kiện online/offline; báo lỗi khi đang dùng nền địa lý; Schematic vẫn chạy. Người dùng tự chọn fallback; giữ dữ liệu và vùng đang chọn.                                                                                      |
| Tile OSM lỗi                             | Warning và bộ chọn nền luôn truy cập được. Ảnh lỗi HTTP 200 không thể được suy ra chỉ từ `tileerror`.                                                                                                                              |
| Geometry thiếu/không hợp lệ              | Chặn renderer địa lý, thông báo rõ; cho chọn sơ đồ nếu geometry tương đối vẫn hợp lệ. Không có vùng phù hợp bộ lọc cũng có thông báo.                                                                                              |
| Engine/lazy chunk lỗi                    | Error boundary cung cấp nút dùng sơ đồ. Nếu mất mạng trước khi tải ứng dụng/chunk schematic lần đầu, cần mạng để tải ứng dụng.                                                                                                     |

Schematic không dùng tile/API ngoài. **Không bổ sung service worker/PWA:** offline sau khi renderer đã tải được kiểm thử; không bảo đảm cold-start hoặc tải lại trang hoàn toàn khi offline.

## 6. Cấu hình Google Maps trên Windows

Không cần key để chạy sơ đồ DEMO. Các thao tác Cloud/Billing sau đây do chủ tài khoản tự thực hiện:

1. Tạo/chọn Google Cloud Project trong [Google Cloud Console](https://console.cloud.google.com/).
2. Liên kết Billing nếu quyết định sử dụng dịch vụ; xem [pricing chính thức](https://developers.google.com/maps/billing-and-pricing/pricing) trước khi bật.
3. Trong APIs & Services, bật **Maps JavaScript API**.
4. Tạo API key loại browser. Không dùng service account, gateway ingest token hoặc khóa máy chủ.
5. Application restrictions → **Websites (HTTP referrers)**. Chỉ thêm origin thực sự dùng, ví dụ `http://127.0.0.1:5173/*`, `http://localhost:5173/*`, và `https://<domain-trien-khai>/*`. Nếu dùng preview, thêm origin cổng 4173; nếu thử điện thoại qua LAN, chỉ thêm referrer IP/cổng dev cụ thể cần dùng. Không dùng wildcard toàn bộ Internet.
6. API restrictions → **Restrict key** → chỉ **Maps JavaScript API**. Tách browser key dev và production khi cần.
7. Thiết lập quota phù hợp trong APIs & Services / Quotas; tạo budget và email alerts trong Billing. **Budget alert không phải hard spending cap**; xem chính sách quota của API và giám sát lượt tải để hạn chế chi phí.
8. Trong thư mục frontend:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Đặt key đã giới hạn vào dòng có sẵn:

```dotenv
VITE_GOOGLE_MAPS_API_KEY=<public-browser-key-cua-ban>
```

Khởi động lại Vite:

```powershell
npm ci
npm run dev
```

Biến `VITE_*` được nhúng vào bundle, key này không bí mật. `.env.local` đã nằm trong gitignore; không commit hoặc ghi key vào tài liệu/test. Khi đổi biến ở bản build, phải build lại. Không đặt secrets backend vào Vite.

9. Mở **Loại bản đồ**, xác nhận phép chiếu DEMO nếu đang dùng fixture rồi chọn Satellite/Roadmap/Hybrid. Để hiển thị đất thật cần cung cấp geometry đã kiểm chứng; hiện dữ liệu vẫn là DEMO.
10. Nếu domain triển khai có CSP, cấu hình theo [Google Maps JavaScript API CSP guide](https://developers.google.com/maps/documentation/javascript/content-security-policy); overlay nội bộ cần `img-src data:`. Không tắt CSP toàn bộ để chữa lỗi.

Tham khảo: [API key security](https://developers.google.com/maps/api-security-best-practices), [error messages](https://developers.google.com/maps/documentation/javascript/error-messages), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## 7. Các file tạo/chỉnh sửa

| Nhóm                                    | File                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mới: provider contract và container     | `src/features/map-providers/types.ts`, `FarmMapContainer.tsx`                                                                                                     |
| Mới: Google renderer, overlay và tọa độ | `src/features/map-providers/GoogleMapsView.tsx`, `environmentSvg.ts`, `coordinates.ts`                                                                            |
| Tích hợp vào Workspace/domain           | `src/pages/WorkspacePage.tsx`, `src/types/domain.ts`                                                                                                              |
| Tái sử dụng Leaflet/SVG                 | `src/features/geo-map/FarmMap.tsx`, `GeographicHeatmap.tsx`, `src/features/farm-map/FarmMap.tsx`, `HeatmapLayer.tsx`                                              |
| UX/config/dependencies                  | `src/styles/global.css`, `.env.example`, `tsconfig.app.json`, `package.json`, `package-lock.json`                                                                 |
| Kiểm thử mới                            | `tests/map-providers.test.tsx`, `tests/google-maps.test.tsx`, `e2e/map-providers.spec.ts`                                                                         |
| Điều chỉnh kiểm thử hiện có             | `e2e/geographic.spec.ts`: chủ động chọn OSM và xác nhận projection; mock tile để test không phụ thuộc dịch vụ ngoài. Giữ kiểm thử chọn vùng/heatmap/Bottom Sheet. |
| Tài liệu/ảnh                            | `README.md`, báo cáo này, `docs/screenshots/t8b-*.png` từ E2E; cập nhật ảnh regression `simulator-desktop-1920.png`                                               |

Dependencies thêm: `@vis.gl/react-google-maps` và `@types/google.maps`. Giữ nguyên Leaflet, Repository Pattern và simulator T8A.

## 8. Kết quả kiểm thử

Không cần key/billing cho bộ tự động. Google API được mock tại adapter; E2E không truy cập Google; tile OSM E2E được stub hoặc chủ động gây lỗi, không dùng làm bằng chứng OSM hoạt động thực.

- `npm run typecheck`: đạt, không bỏ qua lỗi TypeScript.
- `npm run lint`: đạt, 0 warnings.
- `npm test`: **67/67 đạt**, 16 test files (54 bài có sẵn + 13 bài T8B), 21,45 giây.
- `npm run build`: đạt; Google renderer và Leaflet nằm trong các lazy chunks riêng.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/paw-playwright-browsers npm run test:e2e`: **12/12 đạt**, 39,6 giây; desktop 1920/1366, mobile 390/360.
- `npm run format:check` và `git diff --check`: đạt.

Lần chạy E2E đầu gặp thiếu executable Chromium tại `/tmp/paw-playwright-browsers`; cài browser đúng phiên bản trước khi chạy lại. Đây là lỗi môi trường khởi chạy, chưa chạy được assertions ứng dụng ở lần đó.

Các vòng E2E tiếp theo phát hiện bộ chọn nền che nút thu gọn công cụ và, trên mobile, che nút fallback. Đã đưa hai trigger về cùng hàng và đưa feedback vào menu khi menu mở; không dùng force-click hoặc bỏ assertion. Selector attribution được đổi sang role link để phân biệt option OSM. Bộ E2E cuối cùng đạt 12/12.

Phạm vi Google mock: Roadmap/Satellite/Hybrid, 12 polygon, marker/sensor, highlight/click, camera idle/restore, fit/zoom, heatmap/contour SVG, opacity, dọn overlay khi unmount, thiếu key, loader rejection, auth callback, timeout và tile-ready. Provider integration kiểm tra đổi Google/OSM/Schematic, DEMO consent, giữ selectedId/metric/camera/opacity, offline và geometry sai. E2E gồm regression simulation → map/history/alerts/reset và geographic → Bottom Sheet.

## 9. Kiểm chứng Google thực: chưa chạy

**Chưa được cung cấp key hợp lệ**, nên chưa xác minh imagery Google thực, quyền referrer, Billing/quota, thời gian tải, chất lượng chữ trên ảnh vệ tinh và thao tác trên thiết bị thật. Không coi Google mock là chứng nhận dịch vụ thật hoạt động.

Checklist nghiệm thu khi có key:

- [ ] HTTP referrer đúng localhost/domain, API restriction đúng, Billing/quota hợp lệ; không còn lỗi Google trong Console.
- [ ] Roadmap/Satellite/Hybrid tải imagery thật, giữ attribution/terms của Google.
- [ ] Chỉ một engine được mount, không có tile Google không chính thức.
- [ ] Xác nhận projection DEMO có nhãn; polygon thật chỉ dùng geometry đã kiểm chứng.
- [ ] Chọn A-03 bằng chuột/chạm/bàn phím; đổi nền giữ lựa chọn, metric, filter, panel và cảnh báo.
- [ ] Pan/zoom rồi đổi Google ↔ OSM, giữ camera tương đương; fit hiển thị đủ vùng.
- [ ] Đổi đủ 4 metric, kiểm tra nhãn/chú giải/heat/contour/opacity; offline/stale/missing không bị tô như bình thường.
- [ ] Key sai/referrer sai/API chưa bật/Billing/quota/mạng chậm đều có thông báo hoặc chẩn đoán Console và có fallback; không reload loop.
- [ ] Thử desktop 1366/1920 và thiết bị thật 360/390; không scroll ngang, Bottom Sheet không chặn nút chọn nền, attribution không bị che cố định.
- [ ] Thu hồi quyền/test quota trong project thử nghiệm do chủ tài khoản quản lý; không thử gây chi phí cao.

Chưa phát sinh backend/production work. Các bước tiếp theo là cấu hình browser key có giới hạn, nghiệm thu Google thực, và thu thập ranh giới/sensor GPS trước khi bật nội suy trên dữ liệu địa lý thật.
