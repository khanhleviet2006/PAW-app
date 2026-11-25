# Bàn giao bản đồ GPS offline PAW

Ngày 17/11/2026. Đã kiểm tra hai repository thực tế, không sửa ingest/ACK, schema/database hiện có hoặc xóa dữ liệu. Không tự tải ảnh vệ tinh Internet và không tạo số đo vận hành.

## Đã triển khai

- Frontend mới `/field-map`: MapCN MIT subset từ upstream chính thức + MapLibre GL JS 6; worker/CSS local. Giữ nguyên các màn hình và DEMO hiện có, thêm mục GPS offline trong điều hướng.
- Cấu hình kết nối viewer/operator runtime, không lưu token vào bundle/localStorage; từ chối farm simulation ở luồng GPS thực. Không nhúng gateway/admin token.
- Bootstrap snapshot/lịch sử phân trang rồi nhận SSE; giữ điểm cũ theo Measurement ID và tọa độ deployment cũ, không thay theo GPS node mới. Nối lại đồng bộ lịch sử. Lựa chọn chỉ tiêu, độ sâu, heatmap, opacity, popup và danh sách chọn bằng bàn phím.
- Map khởi tạo một lần/mount; số đo/filters chỉ `setData`/paint/layout. Đổi bộ ảnh do người dùng mới thay raster layer, không tạo lại map. Camera không reset khi thêm điểm.
- Backend endpoint map-points; SSE opt-in map_points không phá payload mặc định của client cũ. Dữ liệu lịch sử join Measurement→Deployment→Position, không tạo GPS từ tâm vùng.
- Catalog và API raster MBTiles có kiểm tra quyền farm, zoom/coordinate/path, read-only SQLite, attribution escape. Không proxy URL Internet.
- Công cụ nhập GeoTIFF cục bộ một lần: kiểm tra CRS/bands/range, giữ hồ sơ giấy phép, reproject Web Mercator, đóng gói PNG/TMS vào MBTiles, giới hạn số tile và publish atomic. Không ghi đè dataset đang dùng.
- FastAPI có thể phục vụ build Vite cùng origin. Có compose overlay mount build/ảnh read-only; không đưa dữ liệu ảnh vào PostgreSQL hoặc Git.

## Files

### Backend

Mới: `app/field_map.py`, `app/imagery.py`, `app/import_imagery.py`, `requirements-imagery.txt`, `compose.offline.yaml`, `tests/test_offline_map.py`, `tests/offline_e2e_server.py`, `docs/OFFLINE_MAP.md`, báo cáo này.

Sửa: `app/main.py` (router/API/SSE/serve build), `app/config.py`, `.env.example`, `.gitignore`, `pyproject.toml`, `uv.lock`, `requirements-dev.txt`, `docs/openapi.json`, README. Không có migration mới vì tái sử dụng toàn bộ dữ liệu/tables hiện tại.

### Frontend

Mới: `src/components/mapcn/{Map.tsx,context.ts,LICENSE,README.md}`, `src/features/field-map/{types.ts,repository.ts,data.ts,FieldMap.tsx}`, `src/pages/FieldMapPage.tsx`, `tests/field-map.test.tsx`, `e2e-offline/field-offline.spec.ts`, `playwright.offline.config.ts`, tài liệu offline và ảnh E2E tên `offline-map-test-*`.

Sửa: `src/app/AppRoutes.tsx`, `src/components/layout/AppShell.tsx`, `src/styles/global.css`, package/lock, README, `.env.example`. Giữ API client/repositories, simulator và map cũ để không làm mất chức năng đang dùng.

## Kiểm thử

| Kiểm tra                     | Kết quả                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Frontend TypeScript          | Đạt                                                                                                    |
| Frontend ESLint, Prettier    | Đạt                                                                                                    |
| Frontend unit/integration    | 70/70 đạt, gồm 67 bài cũ và 3 bài mới                                                                  |
| Frontend production build    | Đạt; worker local được xuất thành asset                                                                |
| E2E hồi quy cũ               | 12/12 đạt ở 1920/1366/390/360                                                                          |
| E2E offline riêng            | 4/4 đạt ở 1920/1366/390/360; lượt cuối 13,2 giây, popup mobile đã sửa để không bị menu che             |
| Backend Ruff lint/format     | Đạt                                                                                                    |
| Backend pytest SQLite        | 37/37 đạt                                                                                              |
| Backend pytest PostgreSQL 16 | 37/37 đạt                                                                                              |
| Alembic check                | Không có thay đổi schema cần migration                                                                 |
| Tile import/serve            | GeoTIFF fixture → MBTiles → authenticated PNG; thiếu giấy phép, ghi đè, sai coordinate/role bị từ chối |
| OpenAPI                      | Sinh lại từ API đang chạy                                                                              |

E2E offline dùng production build được FastAPI phục vụ; chặn mọi HTTP request ngoài origin LAN thử nghiệm. MapLibre/WebGL và worker chạy thật, không mock renderer. Sau GPS mới/confirm placement/số đo mới, kiểm tra điểm cũ còn, điểm mới có popup đúng GPS, canvas cũ còn kết nối, camera và số request tile/REST bootstrap không đổi. Unit test thêm assertion constructor map chỉ gọi một lần khi rerender/setData và raster source giữ cùng identity.

Fixtures là GPS và pixel tổng hợp trong `/tmp`/database thử, có nhãn TEST ONLY, nhằm kiểm tra đường kỹ thuật. **Không có ảnh vệ tinh thật hoặc số đo thực nào được tự tạo/đưa vào vận hành.** Không dùng screenshots test làm bằng chứng đã nhập ảnh khu đất thật.

## Giới hạn và phần cần người dùng cung cấp

- Chưa có GeoTIFF/raster tiles, nguồn/giấy phép và tọa độ/phạm vi khu đất. Cần cung cấp để nhập ảnh thật và nghiệm thu độ phủ/độ phân giải/màu. Khi thiếu bộ ảnh, UI báo rõ và chỉ vẽ nền trung tính + GPS thật nếu đã có.
- Chưa có stream phần cứng thật để nghiệm thu ngoài thực địa. Các protocol test không chứng minh độ chính xác GPS/cảm biến.
- Offline được kiểm tra là **mất Internet nhưng LAN/server còn hoạt động**, không phải mất toàn bộ mạng hoặc server. Không bổ sung PWA cold-start khi server cũng ngắt.
- MapLibre heatmap là cường độ có trọng số theo giá trị, không phải IDW/kriging định lượng. Độ sâu/chỉ tiêu được tách; heat dùng điểm hiện tại hợp lệ, lịch sử vẫn xem qua marker.
- React StrictMode ở môi trường dev có thể mount/cleanup lại để phát hiện side effects; production khởi tạo một map cho mỗi lần mở/kết nối màn hình. Đổi dữ liệu không tạo map mới trong cả hai trường hợp.
- SSE snapshot giới hạn 10000 điểm mới nhất; lịch sử đầy đủ qua phân trang. Chưa benchmark hàng trăm nghìn điểm hoặc hơn 10000 phép đo giữa hai lần nhận; cần delta/event log chuyên biệt cho tải đó.
- Vite cảnh báo lazy chunk MapLibre >500kB (khoảng 1,08MB minified, 299kB gzip). Chưa tắt warning hoặc sửa ngưỡng để che; tải từ LAN một lần rồi cache.
- Backend test dependency Starlette/httpx có deprecation warning từ trước; không bỏ test hoặc suppress warning.
- Chưa thử Windows/điện thoại vật lý. Đã có lệnh PowerShell và kiểm thử Chromium responsive.

Xem `docs/OFFLINE_MAP.md` để triển khai LAN, nhập ảnh được cấp phép và chạy lại bộ kiểm thử độc lập. Production cần quy trình cấp quyền/token, HTTPS trên mạng không tin cậy, backup ảnh/database và giám sát dung lượng.
