"""Create local configuration once. Does not print credentials."""

import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
target = root / ".env"
if target.exists():
    raise SystemExit(".env đã tồn tại; giữ nguyên cấu hình hiện có.")
content = (root / ".env.example").read_text(encoding="utf-8")
content = content.replace("PAW_ADMIN_TOKEN=\n", f"PAW_ADMIN_TOKEN={secrets.token_urlsafe(40)}\n")
content = content.replace(
    "PAW_POSTGRES_PASSWORD=\n", f"PAW_POSTGRES_PASSWORD={secrets.token_urlsafe(32)}\n"
)
with target.open("x", encoding="utf-8") as output:
    output.write(content)
try:
    target.chmod(0o600)
except OSError:
    pass  # Windows: use account/filesystem ACLs.
print("Đã tạo .env với admin token ngẫu nhiên. Không commit/chia sẻ file này.")
