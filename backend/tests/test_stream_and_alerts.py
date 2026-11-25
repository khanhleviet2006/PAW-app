import json
import socket
import threading
import time

import httpx
import uvicorn
from test_api import state

from app.monitor import tick


def test_persistent_alerts_acknowledge_resolve_and_monitor_offline(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d, value=35)]))
    path = "/v1/farms/farm/alert-history"
    rows = e["client"].get(path, headers=e["headers"]["viewer"]).json()
    warning = next(row for row in rows if row["kind"] == "warning" and row["resolved_at"] is None)
    ack = f"/v1/farms/farm/alerts/{warning['id']}/acknowledge"
    assert e["client"].post(ack, headers=e["headers"]["viewer"]).status_code == 403
    assert e["client"].post(ack, headers=e["headers"]["operator"]).status_code == 200
    e["advance"](1)
    e["send"](e["packet"]([e["reading"](d, value=26)]))
    rows = e["client"].get(path, headers=e["headers"]["viewer"]).json()
    resolved = next(row for row in rows if row["id"] == warning["id"])
    assert resolved["resolved_at"] and resolved["acknowledged_at"]
    e["advance"](1801)
    tick(e["app"].state.sessions, e["app"].state.settings, e["current"][0])
    rows = e["client"].get(path, headers=e["headers"]["viewer"]).json()
    assert any(row["kind"] == "offline" and row["resolved_at"] is None for row in rows)


def test_raw_measurement_is_retained_but_never_interpolated(env):
    e = env
    e["post"](
        "/v1/nodes/node/sensors",
        {
            "id": "raw",
            "metric": "soil_moisture",
            "depth_cm": 20,
            "unit": "raw",
            "calibrated": False,
        },
    )
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d, sensor="raw", value=2048)]))
    assert state(e)["latest"][0]["quality"] == "uncalibrated"
    assert state(e)["latest"][0]["unit"] == "raw"
    assert state(e)["heat_points"] == []


def test_sse_network_stream_updates_without_rest_polling_and_revokes(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(e["app"], log_level="error", lifespan="off"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 5
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.01)
    assert server.started
    try:
        with httpx.stream(
            "GET",
            f"http://127.0.0.1:{port}/v1/farms/farm/events?since=0",
            headers=e["headers"]["viewer"],
            timeout=5,
        ) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            lines = response.iter_lines()

            def next_event():
                event = {}
                for line in lines:
                    if not line:
                        if "data" in event:
                            return event
                        continue
                    if ":" in line:
                        key, value = line.split(":", 1)
                        event[key] = value.strip()
                raise AssertionError("SSE closed before expected event")

            first = next_event()
            assert first["event"] == "snapshot"
            initial = json.loads(first["data"])
            assert initial["heat_points"] == []
            e["send"](e["packet"]([e["reading"](d)]))
            second = next_event()
            data = json.loads(second["data"])
            assert int(second["id"]) > int(first["id"])
            assert data["heat_points"][0]["value"] == 26
            e["advance"](1801)
            third = next_event()
            assert json.loads(third["data"])["nodes"][0]["connectivity"] == "offline"
            e["client"].delete(
                f"/v1/farms/farm/keys/{e['keys']['viewer']['id']}", headers=e["admin"]
            )
            assert next_event()["event"] == "auth.revoked"
    finally:
        server.should_exit = True
        thread.join(5)
        sock.close()
    assert not thread.is_alive()


def test_bad_sse_cursor_is_rejected_before_opening_stream(env):
    e = env
    path = "/v1/farms/farm/events"
    assert (
        e["client"].get(path, params={"since": 999999}, headers=e["headers"]["viewer"]).status_code
        == 409
    )
    headers = {**e["headers"]["viewer"], "Last-Event-ID": "not-a-number"}
    assert e["client"].get(path, headers=headers).status_code == 422
