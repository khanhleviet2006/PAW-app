"""Durable HTTP outbox adapter; physical LoRa/UART decoder is intentionally external."""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import httpx
from pydantic import ValidationError

from .responses import AckOut
from .schemas import IngestInput


def enqueue(folder: Path, payload: IngestInput) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    # Safe filename even if a device supplies colons or dots in event_id.
    name = hashlib.sha256(payload.event_id.encode()).hexdigest() + ".json"
    target = folder / name
    canonical = payload.model_dump_json()
    try:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        if target.read_text(encoding="utf-8") != canonical:
            raise ValueError("Outbox event_id đã có payload khác") from None
        return target
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(canonical)
        stream.flush()
        os.fsync(stream.fileno())
    return target


def flush(folder: Path, client: httpx.Client, token: str) -> tuple[int, int]:
    sent, retained = 0, 0
    for path in sorted(folder.glob("*.json")):
        try:
            payload = IngestInput.model_validate_json(path.read_text(encoding="utf-8"))
            response = client.post(
                "/v1/gateway/ingest",
                json=payload.model_dump(mode="json"),
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            ack = AckOut.model_validate(response.json())
            if ack.event_id != payload.event_id or len(ack.measurement_ids) != len(
                payload.readings
            ):
                raise ValueError("ACK không khớp gói tin")
            path.unlink()  # Only remove after matching committed ACK.
            sent += 1
        except (httpx.HTTPError, ValueError, OSError, ValidationError):
            retained += 1  # Keep original event/body/times/deployment for later retry.
    return sent, retained


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["enqueue", "flush"])
    parser.add_argument("packet", nargs="?", type=Path)
    parser.add_argument("--spool", type=Path, default=Path("gateway-outbox"))
    parser.add_argument(
        "--base-url", default=os.environ.get("PAW_GATEWAY_URL", "http://127.0.0.1:8000")
    )
    parser.add_argument("--watch", action="store_true")
    parser.add_argument("--retry-seconds", type=float, default=10)
    args = parser.parse_args()
    if args.retry_seconds < 1:
        parser.error("retry-seconds >= 1")
    if args.command == "enqueue":
        if not args.packet:
            parser.error("Cần đường dẫn packet.json")
        try:
            enqueue(
                args.spool, IngestInput.model_validate_json(args.packet.read_text(encoding="utf-8"))
            )
        except (OSError, ValueError, ValidationError):
            raise SystemExit(
                "Không ghi được gói hoặc payload không hợp lệ; dữ liệu chưa bị xóa."
            ) from None
        print("Đã lưu gói vào outbox; chưa coi là server đã nhận.")
        return
    token = os.environ.get("PAW_GATEWAY_TOKEN")
    if not token:
        parser.error("Cần PAW_GATEWAY_TOKEN (không đặt token vào tham số dòng lệnh)")
    with httpx.Client(base_url=args.base_url, timeout=15) as client:
        try:
            while True:
                sent, retained = flush(args.spool, client, token)
                print(json.dumps({"sent": sent, "retained": retained}))
                if not args.watch:
                    raise SystemExit(1 if retained else 0)
                time.sleep(args.retry_seconds)
        except KeyboardInterrupt:
            sys.exit(0)


if __name__ == "__main__":
    main()
