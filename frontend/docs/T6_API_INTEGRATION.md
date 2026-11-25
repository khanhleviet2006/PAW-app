# T6 — API integration: CHƯA HOÀN TẤT LIVE

## Hiện trạng xác minh

Workspace chỉ có frontend T0–T1, không có source FastAPI/PostgreSQL/WPF, OpenAPI,
URL server hoặc credentials đọc dữ liệu. Không suy đoán host/cổng hoặc schema.
Không sửa backend; chưa kiểm thử kết nối thực tế. **Không nghiệm thu T6 LIVE.**

Các route từ tài liệu gốc chỉ dùng làm vị trí gọi dự kiến:
`GET /health`, `GET /v1/nodes/status`, `GET /v1/nodes/{node_id}/latest`,
`GET /v1/nodes/{node_id}/telemetry`. Chưa xác minh payload hoặc query params.

## Phần đã làm và kiểm chứng độc lập

- `services/api/client.ts`: typed method signatures, payload `unknown` cho tới
  khi có parser/schema đã xác minh, encode node ID, truyền query parameters do
  contract cung cấp; HTTP/HTTPS base URL, không chấp nhận URL nhúng credentials.
- HTTP timeout 10 giây, AbortSignal/hủy yêu cầu, JSON lỗi, HTTP lỗi, lỗi mạng;
  không hiển thị response body có thể chứa chi tiết nội bộ.
- `services/repositories.ts`: interface chung cho farm và history.
- `services/adapters/liveRepository.ts`: adapter extension nhận
  `VerifiedReadContract` và client; mặc định từ chối chạy khi thiếu contract.
  Node IDs, node→plot, telemetry parameters và mapper do tích hợp sau cung cấp.
  Không có mapper/schema giả; không gọi endpoint khi contract thiếu.
- `services/repositoryFactory.ts`: LIVE hiện luôn trả adapter bị khóa. Chỉ có
  thể kết nối sau khi chủ động nối contract/client đã được xác minh tại đây.
- TanStack Query: query keys gồm mode + plot + metric + range + phase; truyền
  signal, không keepPreviousData hoặc fallback giữa hai nguồn. Có loading,
  error/retry, empty states; cache DEMO tách khỏi LIVE.
- `VITE_API_BASE_URL` cho thao tác kiểm tra HTTP/JSON `/health` tại Cài đặt;
  `VITE_DATA_MODE` chọn nguồn ban đầu. Không cần `.env` để chạy DEMO.
- Test bằng fetch mock: thành công, URL encoding, query, HTTP 503, JSON hỏng,
  mất mạng, timeout và hủy. E2E: LIVE không hiển thị số đo DEMO còn trong cache.

Kiểm tra `/health` thành công chỉ chứng minh HTTP/JSON; không xác minh LIVE.
`credentials: omit`, không có token frontend, không dùng gateway ingest token.

## Để hoàn tất T6

1. Cung cấp URL/backend hoặc file OpenAPI thực và payload đại diện (không chứa
   bí mật). Xác minh version, đơn vị, calibration, observed/received time,
   trạng thái gateway, giới hạn pagination và tham số telemetry.
2. Chốt node→plot, geometry và nguồn cảm biến chung; không giả định có API farm/plot.
3. Thêm runtime validation/mapper theo schema thật trong VerifiedReadContract,
   kết nối client/contract vào factory. Xác minh các mẫu LIVE có dữ liệu thật.
4. Chốt cơ chế xác thực người dùng, CORS, HTTPS và kiến trúc LAN; không nhúng
   ingest token. Điều chỉnh credentials chỉ theo phương án auth đã thống nhất.
5. Xác minh API trước tưới: event ID, thời điểm, phase. Nếu chưa hỗ trợ, giữ
   UNKNOWN và thông báo chưa hỗ trợ; không đổi dữ liệu cũ thành PRE_PAW.
6. Integration tests và kết nối thực tế, timeout/retry/cancellation, không dữ
   liệu/quá hạn/mất kết nối; chỉ sau đó mới đổi nhãn LIVE đã kiểm chứng.
