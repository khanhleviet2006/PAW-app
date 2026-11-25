# Gateway, dữ liệu thiết bị và hướng dẫn nạp code

## Phân biệt ba chương trình

| Phần | Chạy ở đâu | Trạng thái trong repository |
| --- | --- | --- |
| Backend FastAPI/PostgreSQL | PC hoặc server | Có code, migrations, API và tests |
| HTTP outbox gateway | Máy gateway có Python | Có `python -m app.gateway`, nhận JSON đã giải mã |
| Firmware STM32/GPS/LoRa/cảm biến | Cột cảm biến | Chưa có board/module, pinout, protocol hoặc source firmware để build/nạp |

Backend không nạp vào STM32. HTTP outbox cũng không tự giải mã gói LoRa hoặc đọc UART khi chưa biết module và định dạng frame. Không thay đổi ACK LoRa của thiết bị hiện hữu bằng ACK HTTP dưới đây.

## Hợp đồng HTTP mới cho gateway

Gateway key phải có role gateway và đúng farm. Nó không đọc được bản đồ hoặc cấp key. Nó có thể lấy deployment đang hoạt động qua `GET /v1/gateway/nodes/{node_id}/deployment`, phục vụ đồng bộ lần cắm mới. Chỉ áp dụng thông tin này cho mẫu đo đúng khoảng thời gian; tuyệt đối không gán current deployment cho mọi gói buffer cũ.

Ví dụ payload **minh họa**, thay IDs/times bằng dữ liệu đăng ký thực:

```json
{
  "event_id": "boot-007-seq-000123",
  "node_id": "NODE-01",
  "node_observed_at": "2026-11-14T08:10:00Z",
  "source": "sensor",
  "position": {
    "latitude": 11.9496,
    "longitude": 108.4404,
    "accuracy_m": 3.5,
    "observed_at": "2026-11-14T08:10:00Z"
  },
  "readings": [
    {
      "sensor_id": "NODE-01:soil20",
      "value": 34.2,
      "observed_at": "2026-11-14T08:10:00Z",
      "deployment_id": "<deployment-id-server-da-xac-nhan>",
      "session_id": null
    }
  ]
}
```

- Chỉ gọi HTTP `POST /v1/gateway/ingest`; đọc OpenAPI cho payload và ACK chính thức.
- `event_id` ổn định qua retry. Có thể dùng boot/session ID + sequence; không reset sequence mà tái sử dụng ID cũ.
- `node_observed_at` là thời điểm node thực sự hoạt động, không phải lúc gateway gửi lại buffer. GPS và từng mẫu cũng giữ thời điểm gốc.
- Sensor ID ánh xạ loại phép đo, đơn vị, depth và calibration đã đăng ký; gateway không được tự đổi metric/unit bằng payload.
- Khi chưa biết chắc deployment cho một mẫu, gửi null để lưu `moving`, không gán bừa vào vùng hiện tại. Nếu gửi deployment sai khoảng thời gian, cả batch bị từ chối.
- `session_id` chỉ gửi khi có phiên PRE_PAW cụ thể đã tạo, đúng plot và thời gian. Không tự gắn PRE_PAW cho mọi số đo mới nhất.
- Mỗi request tối đa 128 readings; chia batch lớn nhưng giữ ID riêng ổn định.
- Gói số đo hữu hạn ngoài giới hạn được lưu với quality invalid; dữ liệu lỗi cấu trúc/NaN/thời gian sai hoặc sensor không tồn tại không được ACK accepted.

Backend trả ACK sau khi commit database. Cùng event ID/cùng body trả lại đúng ACK cũ; 409 nếu body khác. Gateway phải buffer bền vững, retry nguyên payload sau timeout/503; không tạo event mới cho cùng gói đã gửi mà chưa biết kết quả. Phân biệt HTTP 401/403/422 để xử lý cấu hình thay vì retry vô hạn.

## HTTP outbox đã có code

Module `app.gateway` dùng token từ biến môi trường, không từ tham số CLI hoặc frontend. Không dùng admin token. Trên PowerShell có thể nhập gateway token mà không echo màn hình:

```powershell
$gatewaySecret = Read-Host 'Gateway token' -AsSecureString
$env:PAW_GATEWAY_TOKEN = [System.Net.NetworkCredential]::new('', $gatewaySecret).Password
$env:PAW_GATEWAY_URL = 'http://127.0.0.1:8000'
.\.venv\Scripts\python.exe -m app.gateway enqueue packet.json
.\.venv\Scripts\python.exe -m app.gateway flush --watch --retry-seconds 10
```

`packet.json` phải chứa gói hợp lệ theo schema. enqueue kiểm tra schema và lưu file outbox/fsync trước khi báo đã lưu. flush chỉ xóa file sau HTTP 200 + ACK hợp lệ khớp event ID và số lượng readings; timeout/lỗi giữ file để gửi lại. Giữ một tiến trình flush cho mỗi spool. Không xem local enqueue là server đã nhận. Chưa có kiểm thử cắt điện phần cứng/filesystem.

`gateway-outbox/` được gitignore, không đưa dữ liệu thực vào GitHub. Token trong environment còn tồn tại tới khi đóng terminal hoặc xóa biến. Triển khai thật dùng HTTPS, credential store và cơ chế quản lý gateway phù hợp; không copy admin token cho thiết bị.

## Hướng dẫn nạp firmware STM32 — điều kiện trước khi có lệnh nạp

Ảnh chỉ nêu STM32 và module LoRa, chưa đủ xác định firmware hoặc địa chỉ flash. Cần cung cấp:

1. Mã MCU/bo mạch đầy đủ và revision PCB.
2. Module LoRa, GPS, loại cảm biến, giao tiếp và pinout đang đấu.
3. Firmware hiện tại, toolchain/project `.ioc`/PlatformIO nếu có.
4. Bộ nạp ST-LINK/bootloader đang dùng; có bootloader riêng và vùng flash nào cần giữ không.
5. Định dạng gói LoRa, ACK, sequence, thời gian và cách xác nhận cắm/rút.

Sau khi có thông tin, quy trình sẽ là:

1. Mở/build đúng project trong STM32CubeIDE hoặc toolchain của board, cấu hình module theo tài liệu thực.
2. Xác minh firmware gửi node ID/sensor ID, GPS accuracy, thời gian, boot/sequence và thông tin placement phù hợp; chưa biết placement thì không giả gán.
3. Kết nối debugger theo sơ đồ của đúng board, kiểm tra nguồn và nhận diện MCU trong STM32CubeProgrammer.
4. Chọn `.elf/.hex/.bin` đã build cho đúng MCU. Địa chỉ nạp file `.bin` phụ thuộc bootloader/linker script, không mặc định dùng một địa chỉ cho mọi board.
5. Program/verify, reset rồi kiểm tra log UART và gói nhận tại gateway.
6. Nghiệm thu cắm ở A, rút, chuyển B, mất mạng và gửi lại buffer; kiểm tra lịch sử không bị gán sai vùng.

Chưa cung cấp `.bin/.hex`, sơ đồ chân, địa chỉ flash hoặc lệnh erase vì chưa có phần cứng/source để xác minh. Không cần thực hiện bước firmware để chạy thử backend/simulator trong README.
