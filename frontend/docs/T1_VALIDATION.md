# T1 — Bàn giao scaffold

Ngày kiểm tra: 2026-11-02 (UTC). Phạm vi: T1 theo bảng nhiệm vụ, dừng trước T2.

## Kết quả

| Kiểm tra                                               | Kết quả                                                 |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `npm install` cho dependencies và devDependencies      | Đạt                                                     |
| `npm ci` từ lockfile cuối                              | Đạt, 239 packages                                       |
| `npm ls --depth=0`                                     | Đạt, không lỗi dependency tree                          |
| `npm run typecheck`                                    | Đạt, không lỗi TypeScript                               |
| `npm run lint`                                         | Đạt, không lỗi/warning                                  |
| `npm test`                                             | Đạt, 1 file / 4 tests                                   |
| `npm run build`                                        | Đạt, tạo `dist/`                                        |
| Dev server `npm run dev -- --port 5173 --strictPort`   | Đạt, Vite ready                                         |
| HTTP dev `/`, `/history`, `/settings`, `/src/main.tsx` | Tất cả HTTP 200; HTML tiếng Việt và module được phục vụ |
| Preview bundle production                              | `/`, `/history`, `/settings`, JS và CSS đều HTTP 200    |

Kiểm thử routing bao gồm trang mặc định + nhãn DEMO, chuyển trang qua liên kết,
truy cập trực tiếp đường dẫn con, 404 và quay về bản đồ. Dùng MemoryRouter trong
jsdom; kiểm tra HTTP Vite bổ sung xác nhận SPA fallback và phục vụ assets.
Các server smoke test đã được dừng sau khi kiểm tra.

Môi trường xác minh: Linux, Node `24.19.0`, npm `11.9.0`; React `19.3.1`,
TypeScript `5.9.3`, Vite `8.3.5`, React Router DOM `7.18.5`, ESLint `10.14.0`,
Vitest `5.0.5`. Phiên bản chính xác được cố định trong `package-lock.json`.
Yêu cầu Node đã đặt từ `24.15.0` trong nhánh 24 để phù hợp jsdom; `.nvmrc` chọn 24.

Npm và Vite ban đầu gặp `EPERM` do sandbox chặn mạng/lắng nghe loopback.
Chạy lại với quyền mạng bổ sung đã thành công. Đây là giới hạn môi trường chạy,
không phải lỗi cấu hình ứng dụng. Đã cập nhật ESLint 9 hết hỗ trợ lên ESLint 10
và xác minh lại lint, typecheck, test, build thành công.

## File tạo mới

Tất cả nằm trong `paw-frontend/`; không sửa file dự án có sẵn.

- `package.json`, `package-lock.json`: dependencies và scripts.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript strict.
- `vite.config.ts`: React plugin, Vitest/jsdom.
- `eslint.config.js`: ESLint flat config, React hooks/refresh.
- `index.html`, `src/main.tsx`: entry tiếng Việt, React StrictMode/BrowserRouter.
- `src/app/AppRoutes.tsx`, `src/pages/ScaffoldPage.tsx`: route giữ chỗ + 404.
- `src/styles/global.css`: CSS tối thiểu cho scaffold.
- `tests/setup.ts`, `tests/routing.test.tsx`: setup và 4 smoke tests.
- `.gitignore`, `.env.example`, `.nvmrc`: quy tắc bỏ qua và cấu hình môi trường.
- `README.md`: cách chạy Windows PowerShell, kiểm tra và ranh giới kiến trúc.
- `docs/T0_REPO_AUDIT.md`, `docs/T1_VALIDATION.md`: audit và bàn giao.
- `.gitkeep` tại `public/`, `src/data/`, `src/lib/`, `src/services/`, `src/types/`,
  `src/components/{layout,farm-map,plot-details,measurements,charts,alerts}/`,
  `src/features/{farms,plots,telemetry}/`: giữ cấu trúc cho task sau.

`node_modules/` và `dist/` là kết quả cài/build, đã đưa vào `.gitignore`.

## Giới hạn còn lại

- Không có repository PAW thực tế/backend/OpenAPI nên chưa đối chiếu tích hợp;
  không thể tạo commit/PR trong workspace hiện tại. Xem audit T0.
- Chưa chạy trực tiếp trên Windows, trình duyệt thật hoặc thiết bị di động;
  hướng dẫn PowerShell đã được viết nhưng chưa xác minh trên Windows.
- T1 chỉ có trang giữ chỗ. Chưa nghiệm thu layout 1366×768, mobile hoặc tương tác
  bản đồ; các hạng mục đó thuộc T2 và các nhiệm vụ sau.
- Chưa có model, mock repository, sensor data hoặc API adapter. Không phát sinh
  dữ liệu ngẫu nhiên, số đo bịa đặt hay kết nối backend.

T0–T1 đạt tiêu chí scaffold trong phạm vi workspace hiện có. Nhiệm vụ tiếp theo:
**T2 — thiết kế tokens, app shell desktop/mobile, điều hướng trái, thanh trạng
thái, khu vực bản đồ trung tâm và panel chi tiết**. Chưa thực hiện T2.
