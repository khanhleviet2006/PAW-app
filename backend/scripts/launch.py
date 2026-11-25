"""Run from backend directory using the installed deployment venv."""

import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    from sqlalchemy import text
    from sqlalchemy.engine import make_url

    from app.config import Settings
    from app.db import database, schema_current

    settings = Settings()
    if make_url(settings.database_url).drivername != "postgresql+psycopg":
        raise ValueError("PAW_DATABASE_URL cần dùng postgresql+psycopg.")
    if not settings.frontend_dist or not (settings.frontend_dist / "index.html").is_file():
        raise ValueError("Chưa có frontend/dist. Chạy npm ci và npm run build trong frontend.")
    engine, _ = database(settings)
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
            if not schema_current(c):
                raise ValueError("Schema chưa đúng phiên bản. Quản trị viên kiểm tra Alembic.")
    finally:
        engine.dispose()
    addr = os.environ.get("PAW_BIND_HOST", "127.0.0.1")
    host = "127.0.0.1" if addr == "0.0.0.0" else addr
    base = f"http://{host}:8000"
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.asgi:app",
            "--host",
            addr,
            "--port",
            "8000",
            "--no-proxy-headers",
        ]
    )
    try:
        for _ in range(100):
            if proc.poll() is not None:
                raise RuntimeError("API dừng trước readiness. Kiểm tra log và cổng 8000.")
            try:
                with urlopen(base + "/ready", timeout=1) as response:
                    if response.status == 200:
                        webbrowser.open(base + "/map")
                        return proc.wait()
            except OSError:
                time.sleep(0.3)
        raise RuntimeError("API chưa sẵn sàng sau thời gian chờ.")
    finally:
        if proc.poll() is None:
            proc.terminate()
            proc.wait()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"PAW: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
