"""Explicit SIMULATION farm/gateway client. No hardware or Google key needed."""

import argparse
import json
import math
import random
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
METRICS = [
    ("temp", "air_temperature", None),
    ("humidity", "air_humidity", None),
    ("soil20", "soil_moisture", 20),
    ("soil40", "soil_moisture", 40),
    ("ph20", "soil_ph", 20),
    ("ph40", "soil_ph", 40),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["seed", "run", "move", "withdraw", "watch"])
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--credentials", type=Path, default=ROOT / ".simulation.secrets.json")
    parser.add_argument(
        "--period",
        type=float,
        default=600,
        help="Real seconds between packets; not a server clock override",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=600,
        help="Expected node measurement interval during seed",
    )
    parser.add_argument("--cycles", type=int, default=0, help="0 = run until Ctrl+C")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--node", default="sim-A-01")
    parser.add_argument("--plot", default="B-02")
    parser.add_argument(
        "--scenario",
        choices=[
            "NORMAL",
            "LOW_SOIL_MOISTURE",
            "HIGH_AIR_TEMPERATURE",
            "ABNORMAL_SOIL_PH",
            "INVALID_MEASUREMENT",
            "SENSOR_OFFLINE",
            "STALE_DATA",
            "MISSING_SENSOR",
        ],
        default="NORMAL",
    )
    args = parser.parse_args()
    if args.period < 1:
        parser.error("period >= 1 giây")
    client = httpx.Client(base_url=args.base_url, timeout=15)

    def call(method, path, body=None, token=None):
        response = client.request(
            method, path, json=body, headers={"Authorization": f"Bearer {token}"} if token else {}
        )
        if response.is_error:
            raise RuntimeError(
                f"{method} {path}: HTTP {response.status_code}: {response.json().get('detail')}"
            )
        return response.json()

    def send(body, token):
        # Retry exactly the same event ID and body after uncertain delivery.
        for attempt in range(3):
            try:
                response = client.post(
                    "/v1/gateway/ingest", json=body, headers={"Authorization": f"Bearer {token}"}
                )
                if response.status_code != 503:
                    response.raise_for_status()
                    return response.json()
            except httpx.TransportError:
                if attempt == 2:
                    raise
            time.sleep(attempt + 1)
        raise RuntimeError("Ingest chưa được xác nhận; giữ nguyên event_id khi retry")

    def packet(node, longitude, latitude, readings=None):
        from uuid import uuid4

        stamp = datetime.now(UTC).isoformat()
        return {
            "event_id": str(uuid4()),
            "node_id": node,
            "source": "simulation",
            "node_observed_at": stamp,
            "position": {
                "longitude": longitude,
                "latitude": latitude,
                "accuracy_m": 3,
                "observed_at": stamp,
            },
            "readings": readings or [],
        }

    def center(code):
        row, col = ord(code[0]) - ord("A"), int(code[2:]) - 1
        if row not in range(3) or col not in range(4):
            raise ValueError("Vùng phải là A-01…C-04")
        return 108.44 + col * 0.001 + 0.0004, 11.95 - row * 0.001 - 0.0004

    try:
        if args.command == "seed":
            if args.credentials.exists():
                raise RuntimeError("File credentials đã có; không ghi đè hoặc seed lại")
            admin = dotenv_values(ROOT / ".env").get("PAW_ADMIN_TOKEN")
            if not admin:
                raise RuntimeError("Chạy python scripts/setup_env.py trước")
            call(
                "POST",
                "/v1/farms",
                {
                    "id": "simulation",
                    "name": "DỮ LIỆU MÔ PHỎNG — không phải vị trí trang trại thật",
                    "source": "simulation",
                },
                admin,
            )
            keys = {
                role: call("POST", "/v1/farms/simulation/keys", {"role": role}, admin)["token"]
                for role in ("viewer", "operator", "gateway")
            }
            credentials = {"farm_id": "simulation", **keys}
            # Save keys BEFORE provisioning so interrupted seed can be inspected/recovered.
            with args.credentials.open("x", encoding="utf-8") as output:
                json.dump(credentials, output)
            args.credentials.chmod(0o600)
            for row in "ABC":
                for col in range(1, 5):
                    code = f"{row}-{col:02}"
                    lng, lat = center(code)
                    ring = [
                        [lng - 0.0004, lat - 0.0004],
                        [lng + 0.0004, lat - 0.0004],
                        [lng + 0.0004, lat + 0.0004],
                        [lng - 0.0004, lat + 0.0004],
                        [lng - 0.0004, lat - 0.0004],
                    ]
                    call(
                        "POST",
                        "/v1/farms/simulation/plots",
                        {
                            "id": code,
                            "name": f"DEMO {code}",
                            "geometry": {"type": "Polygon", "coordinates": [ring]},
                        },
                        keys["operator"],
                    )
                    node = f"sim-{code}"
                    call(
                        "POST",
                        "/v1/farms/simulation/nodes",
                        {
                            "id": node,
                            "name": f"DEMO {node}",
                            "interval_seconds": args.interval_seconds,
                        },
                        keys["operator"],
                    )
                    for suffix, metric, depth in METRICS:
                        call(
                            "POST",
                            f"/v1/nodes/{node}/sensors",
                            {
                                "id": f"{node}:{suffix}",
                                "metric": metric,
                                "depth_cm": depth,
                                "calibrated": True,
                            },
                            keys["operator"],
                        )
                    ack = send(packet(node, lng, lat), keys["gateway"])
                    call(
                        "POST",
                        f"/v1/nodes/{node}/deployments",
                        {"position_id": ack["position_id"], "plot_id": code},
                        keys["operator"],
                    )
            print("Đã tạo 12 vùng và 12 node MÔ PHỎNG, mỗi node 6 cảm biến (2 độ sâu đất).")
            print("Keys lưu trong file *.secrets.json đã gitignore; không in ra màn hình.")
            return
        credentials = json.loads(args.credentials.read_text(encoding="utf-8"))
        farm_id = credentials["farm_id"]
        data = call("GET", f"/v1/farms/{farm_id}/map", token=credentials["viewer"])
        if data["farm"]["source"] != "simulation":
            raise RuntimeError("Simulator từ chối thao tác trên trang trại nguồn sensor")
        if args.command == "watch":
            with client.stream(
                "GET",
                f"/v1/farms/{farm_id}/events",
                headers={"Authorization": f"Bearer {credentials['viewer']}"},
                timeout=None,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line.startswith("data: "):
                        snapshot = json.loads(line[6:])
                        print(
                            f"MÔ PHỎNG · cursor={snapshot.get('cursor')} · nodes={len(snapshot.get('nodes', []))} · heat_points={len(snapshot.get('heat_points', []))}"
                        )
            return
        if args.command == "withdraw":
            call("POST", f"/v1/nodes/{args.node}/withdraw", token=credentials["operator"])
            print("Đã xác nhận rút node mô phỏng.")
            return
        if args.command == "move":
            lng, lat = center(args.plot)
            ack = send(packet(args.node, lng, lat), credentials["gateway"])
            call(
                "POST",
                f"/v1/nodes/{args.node}/deployments",
                {"position_id": ack["position_id"], "plot_id": args.plot},
                credentials["operator"],
            )
            print("Đã xác nhận lần đặt mới; dữ liệu cũ giữ nguyên, chờ cảm biến ổn định.")
            return
        rng = random.Random(args.seed)
        baselines = {n["id"]: rng.uniform(-0.8, 0.8) for n in data["nodes"]}
        cycle = 0
        while args.cycles == 0 or cycle < args.cycles:
            data = call("GET", f"/v1/farms/{farm_id}/map", token=credentials["viewer"])
            for index, node in enumerate(data["nodes"]):
                if not node["deployment"]:
                    continue
                target = node["id"] == args.node
                if target and args.scenario == "SENSOR_OFFLINE":
                    continue  # No forged offline flag: server ages the actual heartbeat.
                stamp = datetime.now(UTC).isoformat()
                delta = baselines[node["id"]] + math.sin(cycle / 10 + index / 5) * 0.6
                readings = []
                for suffix, metric, depth in METRICS:
                    if target and (
                        args.scenario == "STALE_DATA"
                        or (args.scenario == "MISSING_SENSOR" and suffix == "soil20")
                    ):
                        continue
                    value = {
                        "air_temperature": 26 + delta,
                        "air_humidity": 72 + delta * 2,
                        "soil_moisture": (34 if depth == 20 else 42) + delta * 2,
                        "soil_ph": 6.4 + delta * 0.1,
                    }[metric]
                    if target:
                        if args.scenario == "LOW_SOIL_MOISTURE" and metric == "soil_moisture":
                            value = 10
                        if args.scenario == "HIGH_AIR_TEMPERATURE" and metric == "air_temperature":
                            value = 38
                        if args.scenario == "ABNORMAL_SOIL_PH" and metric == "soil_ph":
                            value = 9
                        if args.scenario == "INVALID_MEASUREMENT" and metric == "soil_ph":
                            value = 18
                    readings.append(
                        {
                            "sensor_id": f"{node['id']}:{suffix}",
                            "value": round(value, 2),
                            "observed_at": stamp,
                            "deployment_id": node["deployment"]["id"],
                        }
                    )
                pos = node["position"]
                send(
                    packet(node["id"], pos["longitude"], pos["latitude"], readings),
                    credentials["gateway"],
                )
            cycle += 1
            print(f"MÔ PHỎNG · chu kỳ {cycle} · {args.scenario}")
            if args.cycles == 0 or cycle < args.cycles:
                time.sleep(args.period)
    except KeyboardInterrupt:
        print("Đã dừng mô phỏng.")
    except (RuntimeError, ValueError, OSError, httpx.HTTPError) as error:
        print(
            f"Lỗi: {str(error) if isinstance(error, RuntimeError) else type(error).__name__}. Không gửi keys lên chat.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
    finally:
        client.close()


if __name__ == "__main__":
    main()
