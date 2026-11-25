# T7 — Bàn giao và kết quả QA

Ngày: 02/11/2026 (UTC+7). Phạm vi theo master task T2–T7 mới nhất.

## Trạng thái nghiệm thu

| Phần                               | Kết quả                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| T2 — design system/app shell       | Đạt trong phạm vi frontend                                                    |
| T3 — interactive SVG map           | Đạt với hình học DEMO                                                         |
| T4 — bốn lớp dữ liệu               | Đạt với dữ liệu/ngưỡng DEMO                                                   |
| T5 — chi tiết và lịch sử trước PAW | Đạt DEMO; PRE_PAW thật chưa được xác minh                                     |
| T6 — API integration               | **Chưa hoàn tất LIVE**; client/adapter boundary và tests đã có                |
| T7 — QA                            | Đạt các kiểm tra bên dưới, không thay thế nghiệm thu production/thiết bị thật |

Không có tính năng lấy số đo LIVE nào đã được kiểm chứng. Chưa có API URL,
OpenAPI hoặc schema thực. Chuyển sang LIVE hiện thông báo chưa tích hợp;
không fallback, không hiển thị bản đồ/số đo DEMO còn trong cache.

## Lệnh và kết quả thực tế

Môi trường Linux, Node.js 24.19.0, npm 11.9.0. Dependencies chính:
React 19.3.1, Vite 8.3.5, TypeScript 5.9.3, React Router 7.18.5,
Tailwind 4.3.3, TanStack Query 5.105.2, Recharts 3.10.1,
Vitest 5.0.5, Playwright 1.64.1, axe 4.14.0.

| Kiểm tra cuối          | Kết quả                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `npm ci`               | Đạt, 300 packages từ lockfile                                                       |
| `npm ls --depth=0`     | Đạt, không lỗi dependency tree                                                      |
| `npm run typecheck`    | Đạt, strict giữ nguyên; app, unit tests, Vite, Playwright/E2E được kiểm tra         |
| `npm run lint`         | Đạt, 0 warning/error                                                                |
| `npm test`             | **29/29 tests**, 9 files                                                            |
| `npm run build`        | Đạt, không cảnh báo build; lazy chunk cho biểu đồ                                   |
| `npm run format:check` | Đạt                                                                                 |
| `npm run test:e2e`     | **20/20 E2E** trên 5 viewport Chromium                                              |
| Preview production     | HTTP 200: `/map?plot=A-03`, `/history?plot=B-04`, `/settings`, `/alerts`, JS và CSS |

Cloud chạy E2E với `PLAYWRIGHT_BROWSERS_PATH=/tmp/paw-playwright-browsers` và quyền
mạng bổ sung để server lắng nghe loopback. Cảnh báo NO_COLOR/FORCE_COLOR và thông
báo npm có bản mới là từ môi trường CLI, không phải lỗi cấu hình app. Không có
thay đổi sandbox/network policy hoặc credentials dự án.

Bundle cuối: CSS ~28,18 kB, app JS ~343,66 kB (~108,95 kB gzip), biểu đồ lazy
~352,65 kB (~102,58 kB gzip). Preview chỉ smoke HTTP/static fallback, không phải
kiểm chứng triển khai production. Server kiểm tra đã được dừng.

Sau lượt 20/20 toàn bộ, đã bổ sung assertion riêng chứng minh touch làm đổi
viewBox và chạy lại hai ca pan tại 375px/768px: **2/2 đạt**. Playwright report
hiện giữ lượt chạy tập trung gần nhất; chạy `npm run test:e2e` để tái tạo đầy đủ.

## Phạm vi kiểm thử

Vitest/Testing Library:

- Fixture ổn định, 12 ID duy nhất, geometry và liên kết sensor nhất quán.
- Thiếu cảm biến không điền số; soil moisture chưa hiệu chuẩn dùng raw.
- Bình thường/cảnh báo/offline/no-data/stale, đổi ngưỡng không đổi số đo.
- PRE_PAW riêng có đợt tưới DEMO và thời điểm sau quan trắc; UNKNOWN giữ nguyên;
  khoảng 24 giờ, 7 ngày, 30 ngày lọc đúng.
- Chọn vùng chuột/bàn phím; zoom/fit; đổi lớp/legend giữ selection; filter/search;
  đóng/mở panel và fullscreen/Escape.
- Routing, truy cập đường dẫn con/404; pin/unpin sidebar; drawer giữ/trả focus.
- Loading, empty, error/retry; lịch sử thiếu cảm biến; ngưỡng không hợp lệ.
- LIVE không dùng lại DEMO trong cache; fetch mock cho encoding/query, HTTP 503,
  JSON lỗi, mạng lỗi, timeout, abort và không gọi mạng khi thiếu contract.

Playwright (4 kịch bản × 5 viewport):

| Viewport | Loại xác minh                                    |
| -------- | ------------------------------------------------ |
| 375×812  | Chromium mobile/touch giả lập, drawer, sheet     |
| 768×1024 | Chromium tablet/touch giả lập, panel dưới bản đồ |
| 1024×768 | Chromium desktop                                 |
| 1366×768 | Chromium desktop                                 |
| 1440×900 | Chromium desktop                                 |

Map interaction, tìm/chọn vùng, layer, no-sensor, zoom/fit, fullscreen/Escape,
pan dừng khi thả, chọn bàn phím, drawer/sidebar, lịch sử/phase/bảng, LIVE không
fallback, không tràn ngang. Axe quét map/history/settings tại mỗi viewport theo
WCAG 2 A/AA và 2.1 AA: **không có violation được phát hiện trong các màn hình đã
quét**. Đây không phải chứng nhận tuân thủ toàn bộ WCAG hoặc kiểm tra screen reader.

Đã sửa lỗi phát hiện trong quá trình QA: pan tiếp sau pointerup, nhãn map quá
nhỏ ở màn hẹp, một số chữ phụ thiếu contrast, selector E2E không tìm đúng label
của select. Giữ đầy đủ strict và test; không vô hiệu hóa kiểm tra để bỏ qua lỗi.

Ảnh chụp hiện tại (đã xem trực quan desktop/mobile):

- [375px](screenshots/mobile-375.png)
- [768px](screenshots/tablet-768.png)
- [1024px](screenshots/desktop-1024.png)
- [1366px](screenshots/desktop-1366.png)
- [1440px](screenshots/desktop-1440.png)

## Giới hạn còn tồn tại và bước tiếp theo

- T6 chưa hoàn tất: cần URL và OpenAPI thực, runtime schema/mapper, node→plot,
  geometry và auth/CORS/HTTPS; tích hợp thật và kiểm thử đọc số đo/lịch sử mới
  được gắn nhãn LIVE. Xem `T6_API_INTEGRATION.md`.
- DEMO dùng đồng hồ cố định 14:40 02/11/2026 UTC+7, hình học tương đối và lịch sử
  sinh xác định; không phải GPS, dữ liệu cảm biến hoặc sự kiện tưới thật.
- Mobile/tablet chỉ giả lập Chromium. Chưa chạy Windows, iPhone/Android thật,
  Safari/Firefox, screen reader hoặc LAN/backend thực tế. Chỉ nhận ảnh desktop
  tham chiếu; mobile dựa trên yêu cầu văn bản.
- Chưa có pagination/server downsampling lịch sử thật, auto-refresh LIVE, offline
  PWA hoặc heatmap; không tự thêm backend/điều khiển tưới.
- Ngưỡng/mode UI giữ trong phiên; tải lại sẽ reset theo mặc định/environment.
- Panel desktop có cuộn để xem đầy đủ thông tin nguồn, pH, lịch sử; hình polygon
  nhỏ có thể zoom hoặc chọn bằng tìm kiếm/bàn phím. Chú giải thu gọn được.
- Git metadata workspace không hợp lệ, nên chưa thể commit theo từng task.
  Không `git init`, không push, không sửa backend/database/WPF.
- Chưa deploy. Trước production: hoàn tất LIVE, xác thực người dùng và HTTPS,
  SPA fallback/reverse proxy, nghiệm thu thiết bị thật, build artifact có version
  và rollback, quan sát lỗi/mạng và thử tải dữ liệu thực.

## File tạo hoặc cập nhật

Tất cả thay đổi thuộc `paw-frontend/`. File T0/T1 giữ làm lịch sử, một số file được
định dạng lại bằng Prettier. Thư mục trống của scaffold đã bỏ `.gitkeep` khi thay
bằng module thật để tránh cấu trúc trùng chức năng. `ScaffoldPage.tsx` được gỡ.

Các file cập nhật từ T1: `package.json`, `package-lock.json`, `vite.config.ts`,
`tsconfig.node.json`, `eslint.config.js`, `.gitignore`, `.env.example`,
`README.md`, `index.html`, `src/app/AppRoutes.tsx`, `src/styles/global.css`,
`tests/routing.test.tsx`; các file còn lại dưới đây là module/tài liệu mới hoặc
file nền tảng được giữ/định dạng. Danh sách toàn bộ file nguồn/cấu hình/tài liệu
hiện tại, không gồm node_modules, dist, trace và report:

```text
.env.example
.gitignore
.nvmrc
.prettierignore
.prettierrc.json
README.md
docs/T0_REPO_AUDIT.md
docs/T1_VALIDATION.md
docs/T2_DESIGN_SYSTEM.md
docs/T3_INTERACTIVE_MAP.md
docs/T4_DATA_LAYERS.md
docs/T5_AREA_DETAILS.md
docs/T6_API_INTEGRATION.md
docs/T7_FINAL_VALIDATION.md
docs/screenshots/desktop-1024.png
docs/screenshots/desktop-1366.png
docs/screenshots/desktop-1440.png
docs/screenshots/mobile-375.png
docs/screenshots/tablet-768.png
e2e/workspace.spec.ts
eslint.config.js
index.html
package-lock.json
package.json
playwright.config.ts
public/.gitkeep
src/app/AppRoutes.tsx
src/app/PreferencesProvider.tsx
src/app/preferences.ts
src/components/layout/AppShell.tsx
src/data/mock/fixtures.ts
src/data/mock/geometry.ts
src/features/area-details/AreaDetails.tsx
src/features/environmental-layers/LayerSwitcher.tsx
src/features/environmental-layers/Legend.tsx
src/features/environmental-layers/config.ts
src/features/environmental-layers/status.ts
src/features/farm-map/FarmMap.tsx
src/features/telemetry-history/HistoryChart.tsx
src/features/telemetry-history/TelemetryHistory.tsx
src/hooks/useFarmData.ts
src/hooks/useHistoryData.ts
src/lib/format.ts
src/main.tsx
src/pages/AlertsPage.tsx
src/pages/HistoryPage.tsx
src/pages/SettingsPage.tsx
src/pages/WorkspacePage.tsx
src/services/adapters/liveRepository.ts
src/services/adapters/mockRepository.ts
src/services/api/client.ts
src/services/repositories.ts
src/services/repositoryFactory.ts
src/styles/global.css
src/types/domain.ts
tests/api.test.ts
tests/data-states.test.tsx
tests/history.test.ts
tests/layers.test.ts
tests/map.test.tsx
tests/mode.test.tsx
tests/model.test.ts
tests/routing.test.tsx
tests/setup.ts
tests/workspace.test.tsx
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
```
