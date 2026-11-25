import os
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import Base
from app.main import create_app

ADMIN = "test-only-admin-key-at-least-32-characters"


@pytest.fixture
def env(tmp_path):
    url = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    if not url.startswith("sqlite") and "paw_test" not in url.rsplit("/", 1)[-1]:
        pytest.fail(
            "PostgreSQL test database name must contain paw_test; no destructive test on real DB"
        )
    app = create_app(
        Settings(
            admin_token=ADMIN, database_url=url, stabilization_seconds=120, sse_poll_seconds=0.05
        )
    )
    Base.metadata.drop_all(app.state.engine)
    Base.metadata.create_all(app.state.engine)
    current = [datetime(2026, 11, 14, 8, tzinfo=UTC)]
    app.state.clock = lambda: current[0]
    client = TestClient(app)
    admin = {"Authorization": f"Bearer {ADMIN}"}

    def post(path, body=None, headers=None):
        response = client.post(path, json=body, headers=headers or admin)
        assert response.status_code in (200, 201), response.text
        return response.json()

    post("/v1/farms", {"id": "farm", "name": "Thử nghiệm", "source": "simulation"})
    for identifier, x in [("A", 108), ("B", 108.02)]:
        post(
            "/v1/farms/farm/plots",
            {
                "id": identifier,
                "name": identifier,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[x, 11], [x + 0.01, 11], [x + 0.01, 11.01], [x, 11.01], [x, 11]]
                    ],
                },
            },
        )
    post("/v1/farms/farm/nodes", {"id": "node", "name": "Node di động"})
    for identifier, metric, depth in [
        ("temp", "air_temperature", None),
        ("humidity", "air_humidity", None),
        ("soil20", "soil_moisture", 20),
        ("soil40", "soil_moisture", 40),
        ("ph", "soil_ph", 20),
    ]:
        post(
            "/v1/nodes/node/sensors",
            {"id": identifier, "metric": metric, "depth_cm": depth, "calibrated": True},
        )
    keys = {
        role: post("/v1/farms/farm/keys", {"role": role})
        for role in ("gateway", "operator", "viewer")
    }
    headers = {role: {"Authorization": f"Bearer {key['token']}"} for role, key in keys.items()}
    counter = [0]

    def packet(
        readings=None, longitude=108.005, accuracy=3, event_id=None, position=True, observed_at=None
    ):
        counter[0] += 1
        stamp = (observed_at or current[0]).isoformat()
        return {
            "event_id": event_id or f"event-{counter[0]}",
            "node_id": "node",
            "node_observed_at": stamp,
            "source": "simulation",
            "position": {
                "latitude": 11.005,
                "longitude": longitude,
                "accuracy_m": accuracy,
                "observed_at": stamp,
            }
            if position
            else None,
            "readings": readings or [],
        }

    def send(body):
        return post("/v1/gateway/ingest", body, headers["gateway"])

    def place(longitude=108.005):
        ack = send(packet(longitude=longitude))
        return post(
            "/v1/nodes/node/deployments", {"position_id": ack["position_id"]}, headers["operator"]
        )

    def advance(seconds):
        current[0] += timedelta(seconds=seconds)

    def reading(deployment, sensor="temp", value=26, observed_at=None, **extra):
        return {
            "sensor_id": sensor,
            "value": value,
            "observed_at": (observed_at or current[0]).isoformat(),
            "deployment_id": deployment["id"] if deployment else None,
            **extra,
        }

    yield {
        "app": app,
        "client": client,
        "admin": admin,
        "post": post,
        "headers": headers,
        "keys": keys,
        "packet": packet,
        "send": send,
        "place": place,
        "advance": advance,
        "reading": reading,
        "current": current,
    }
    client.close()
    Base.metadata.drop_all(app.state.engine)
    app.state.engine.dispose()
