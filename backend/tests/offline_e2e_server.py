"""TEST ONLY. Ephemeral protocol/pixel fixtures, never used by app.asgi or production."""

import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mercantile
import numpy as np
import rasterio
import uvicorn
from fastapi.testclient import TestClient
from rasterio.transform import from_bounds

from app.config import Settings
from app.db import Base
from app.import_imagery import import_geotiff
from app.main import create_app

root = Path(os.environ["PAW_E2E_DIR"]).resolve()
root.mkdir(parents=True, exist_ok=True)
admin = "e2e-only-not-a-production-admin-token-123456"
app = create_app(
    Settings(
        admin_token=admin,
        database_url=f"sqlite:///{root}/test.db",
        imagery_dir=root / "imagery",
        frontend_dist=Path(os.environ["PAW_E2E_FRONTEND_DIST"]),
        stabilization_seconds=0,
        sse_poll_seconds=0.1,
        viewer_farm_id="field-test-" + os.environ.get("PAW_E2E_PROJECT", "desktop-1366"),
        viewer_networks=["127.0.0.1/32"],
        viewer_origins=["http://127.0.0.1:18082"],
    )
)
Base.metadata.create_all(app.state.engine)
client = TestClient(app)
headers = {"Authorization": f"Bearer {admin}"}


def post(path, body, token=None):
    r = client.post(
        path, json=body, headers={"Authorization": f"Bearer {token}"} if token else headers
    )
    r.raise_for_status()
    return r.json()


credentials = {}
for project in ["desktop-1920", "desktop-1366", "mobile-390", "mobile-360"]:
    farm = f"field-test-{project}"
    node = f"{farm}-node"
    sensor = f"{node}-temp"
    post(
        "/v1/farms",
        {"id": farm, "name": "TEST FIXTURE ONLY — NOT REAL FIELD DATA", "source": "sensor"},
    )
    ring = [
        [108.004, 11.004],
        [108.006, 11.004],
        [108.006, 11.006],
        [108.004, 11.006],
        [108.004, 11.004],
    ]
    post(
        f"/v1/farms/{farm}/plots",
        {
            "id": farm + "-plot",
            "name": "TEST FIXTURE",
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        },
    )
    post(f"/v1/farms/{farm}/nodes", {"id": node, "name": "TEST NODE"})
    post(
        f"/v1/nodes/{node}/sensors", {"id": sensor, "metric": "air_temperature", "calibrated": True}
    )
    keys = {
        role: post(f"/v1/farms/{farm}/keys", {"role": role})["token"]
        for role in ["viewer", "operator", "gateway"]
    }
    stamp = datetime.now(UTC).isoformat()
    ack = post(
        "/v1/gateway/ingest",
        {
            "event_id": "initial-gps",
            "node_id": node,
            "node_observed_at": stamp,
            "source": "sensor",
            "position": {
                "longitude": 108.005,
                "latitude": 11.005,
                "accuracy_m": 3,
                "observed_at": stamp,
            },
        },
        keys["gateway"],
    )
    deployment = post(
        f"/v1/nodes/{node}/deployments", {"position_id": ack["position_id"]}, keys["operator"]
    )
    stamp = datetime.now(UTC).isoformat()
    post(
        "/v1/gateway/ingest",
        {
            "event_id": "initial-reading",
            "node_id": node,
            "node_observed_at": stamp,
            "source": "sensor",
            "readings": [
                {
                    "sensor_id": sensor,
                    "value": 26,
                    "observed_at": stamp,
                    "deployment_id": deployment["id"],
                }
            ],
        },
        keys["gateway"],
    )
    source = root / (project + ".tif")
    bounds = mercantile.bounds(mercantile.tile(108.005, 11.005, 14))
    with rasterio.open(
        source,
        "w",
        driver="GTiff",
        width=64,
        height=64,
        count=3,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_bounds(*bounds, 64, 64),
    ) as dst:
        dst.write(np.full((3, 64, 64), 100, dtype="uint8"))
    import_geotiff(
        source,
        root / "imagery" / (project + ".mbtiles"),
        {
            "id": project,
            "farm_id": farm,
            "license": "TEST PIXELS ONLY",
            "license_url": "https://example.invalid/test",
            "attribution": "Test pixels — not satellite imagery",
            "offline_rights_confirmed": True,
            "minzoom": 14,
            "maxzoom": 14,
        },
        [1, 2, 3],
        max_tiles=20,
    )
    empty_farm = f"empty-test-{project}"
    post("/v1/farms", {"id": empty_farm, "name": "TEST ONLY — NO IMAGERY", "source": "sensor"})
    empty_viewer = post(f"/v1/farms/{empty_farm}/keys", {"role": "viewer"})["token"]
    credentials[project] = {
        "farm": farm,
        "empty_farm": empty_farm,
        "empty_viewer": empty_viewer,
        "node": node,
        "sensor": sensor,
        "deployment": deployment["id"],
        **keys,
    }
(root / "credentials.json").write_text(json.dumps(credentials))
(root / "credentials.json").chmod(0o600)
uvicorn.run(
    app,
    host="127.0.0.1",
    port=int(os.environ.get("PAW_E2E_PORT", "18082")),
    log_level="warning",
    access_log=False,
    proxy_headers=False,
)
