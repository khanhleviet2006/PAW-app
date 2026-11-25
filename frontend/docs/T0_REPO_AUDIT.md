# T0 — Kiểm tra repository

Ngày kiểm tra: 2026-11-02 (UTC).

Tài liệu đầu vào đã đọc đầy đủ: `PAW_Frontend_Codex_Process_Map.md` do người dùng
đính kèm. Phạm vi được chấp thuận cho lần này chỉ là **T0 và T1** theo bảng nhiệm vụ
ở mục 7; không đồng nhất T1 với P1 (design system/app shell).

## Hiện trạng trước khi tạo frontend

- Thư mục làm việc: `/workspace`.
- Chỉ thấy thư mục môi trường `.agents`, `.aws`, `.codex`, `.git`,
  `library-files`, `scratch`, `shared/downloads`; không có file mã nguồn dự án.
- Không tìm thấy `AGENTS.md`, `package.json`, Vite/TypeScript config,
  `pyproject.toml`, `requirements*.txt`, `.sln`, `.csproj` hay README dự án.
- `git status --short` và `git rev-parse --show-toplevel` báo
  `fatal: not a git repository`; thư mục `.git` được gắn sẵn không phải Git repo
  khả dụng. Không chạy `git init`, không tạo commit/PR hoặc thay đổi metadata đó.
- Không có mã FastAPI, PostgreSQL, WPF hoặc OpenAPI để kiểm tra, cũng không có
  URL API được cung cấp. Chưa xác minh các route backend dự kiến trong tài liệu.
- Không đọc nội dung credentials hoặc thay đổi cấu hình môi trường.
- Môi trường chạy: Linux, Node.js `v24.19.0`, npm `11.9.0`.

## Quyết định scaffold

Tạo riêng `/workspace/paw-frontend`, có package và lockfile độc lập, không thêm
dependency hoặc lệnh vào thư mục gốc. Khi ghép vào repository PAW thực tế, đặt
`paw-frontend/` cạnh các thành phần hiện có và giữ nguyên mã backend/WPF.

Chọn React, TypeScript strict, Vite, React Router; ESLint flat config;
Vitest + Testing Library + jsdom cho smoke tests. Chỉ có routing và trang giữ
chỗ tiếng Việt mang nhãn DEMO. Tách sẵn thư mục UI, types và services, chưa làm
model/fixtures/adapters của T3 hoặc app shell của T2.

Không thêm tile server, API key, backend giả, migration cơ sở dữ liệu hay điều
khiển tưới. `.env.example` không chứa endpoint hoặc token giả định.

## Giới hạn và nghiệm thu

T0 hoàn thành đối với workspace được cung cấp. Việc đối chiếu kiến trúc và hợp
đồng API trong repository thật vẫn chưa thể xác minh vì thiếu mã nguồn/API;
đây không phải chặn scaffold frontend độc lập. Cần đối chiếu lại khi mã nguồn
được đưa vào workspace; bắt buộc trước T8.

Không có file backend, PostgreSQL hay WPF nào được sửa. Tất cả thay đổi của lần
này nằm trong `paw-frontend/`. Yêu cầu mỗi task một commit/PR chưa thể thực hiện
vì workspace không có Git repository hợp lệ; audit và scaffold được ghi nhận
riêng bằng tài liệu này và `T1_VALIDATION.md`.
