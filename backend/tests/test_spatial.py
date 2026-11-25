import json

import numpy as np
import pytest

from app import models as m
from app.spatial import Policy, idw, kriging, prediction, raster

GEOMETRY = json.dumps(
    {
        "type": "Polygon",
        "coordinates": [[[108, 11], [108.002, 11], [108.002, 11.002], [108, 11.002], [108, 11]]],
    }
)
SCOPE = ("f", "s", "soil_moisture", 20)
SAMPLES = (
    (108.0001, 11.0001, 20.0, 2.0),
    (108.0018, 11.0001, 30.0, 2.0),
    (108.001, 11.0018, 40.0, 2.0),
)


def test_idw_metric_exact_radius_and_weights():
    x = np.array([[0.0, 0.0], [10.0, 0.0]])
    pred = idw(x, np.array([10.0, 20.0]), [[0, 0], [5, 0], [500, 0]], Policy(), 2)
    assert np.allclose(pred[:2], [10, 15]) and np.isnan(pred[-1])


def test_surface_coverage_and_sparse_geometry():
    assert "image" not in raster(SCOPE, GEOMETRY, SAMPLES[:2], Policy())
    assert "image" not in raster(
        SCOPE, GEOMETRY, tuple((x, 11.0001, v, a) for x, _, v, a in SAMPLES), Policy()
    )
    result = raster(SCOPE, GEOMETRY, SAMPLES + (SAMPLES[0],), Policy())
    assert result["sites"] == 3 and result["bounds"] == (108, 11, 108.002, 11.002)
    assert result["image"].startswith("data:image/png") and result["method"] == ["IDW", 2]
    import base64
    import io

    from PIL import Image

    alpha = np.asarray(Image.open(io.BytesIO(base64.b64decode(result["image"].split(",")[1]))))[
        :, :, 3
    ]
    assert alpha.min() == 0 and alpha.max() == 255


def test_flat_variogram_falls_back():
    x = np.random.default_rng(10).uniform(0, 50, (24, 2))
    y = np.ones(24)
    with pytest.raises(ValueError):
        kriging(x, y, x, "spherical")
    pred, var, model, cv = prediction(x, y, x, Policy())
    assert model[0] == "IDW" and var is None and np.allclose(pred, y) and cv["r2"] is None


def test_null_is_stored_and_never_interpolated(env):
    placement = env["place"]()
    env["advance"](121)
    env["send"](env["packet"]([env["reading"](placement, value=None)]))
    with env["app"].state.sessions() as s:
        row = s.query(m.Measurement).one()
        assert row.value is None and row.quality == "invalid"


def test_structured_variogram_reproduces_measured_sites():
    x = np.array([(i, j) for i in range(5) for j in range(5)], dtype=float)
    y = np.sin(x[:, 0] / 4) + 0.3 * x[:, 1]
    for family in ("spherical", "exponential", "gaussian"):
        estimated, variance = kriging(x, y, x, family)
        assert np.allclose(estimated, y)
        assert np.allclose(variance, 0, atol=1e-7)


def test_missing_values_do_not_create_sites_or_change_estimates():
    missing = ((108.001, 11.001, None, 2.0), (108.0012, 11.001, float("nan"), 2.0))
    result = raster(SCOPE, GEOMETRY, SAMPLES + missing, Policy())
    assert result["sites"] == 3
    assert result["image"] == raster(SCOPE, GEOMETRY, SAMPLES, Policy())["image"]


def test_connection_password_is_encoded_once():
    from sqlalchemy.engine import make_url

    from app.config import Settings

    cfg = Settings(
        admin_token="x" * 36,
        database_url="postgresql://account@localhost/paw_test",
        db_password="a@:b%25",
    )
    assert make_url(cfg.database_url).password == "a@:b%25"
    assert make_url(cfg.database_url).drivername == "postgresql+psycopg"


def test_surface_scopes_session_depth_source_and_auth(env):
    from datetime import timedelta

    start = env["current"][0]
    with env["app"].state.sessions.begin() as db:
        db.get(m.Farm, "farm").source = "sensor"
    env["post"](
        "/v1/farms/farm/measurement-sessions",
        {
            "id": "pre",
            "plot_id": "A",
            "started_at": start.isoformat(),
            "ended_at": (start + timedelta(minutes=20)).isoformat(),
        },
    )
    for i, (lon, lat, _, _) in enumerate(SAMPLES):
        packet = env["packet"](longitude=lon)
        packet["source"] = "sensor"
        packet["position"]["latitude"] = lat
        gps = env["send"](packet)
        placement = env["post"](
            "/v1/nodes/node/deployments",
            {"position_id": gps["position_id"]},
            env["headers"]["operator"],
        )
        env["advance"](121)
        readings = [
            env["reading"](placement, "soil20", 20 + i, session_id="pre"),
            env["reading"](placement, "soil40", 80 + i, session_id="pre"),
            env["reading"](placement, "soil20", 100),
        ]  # UNKNOWN phase
        payload = env["packet"](readings, position=False)
        payload["source"] = "sensor"
        env["send"](payload)
    path = "/v1/farms/farm/surface"
    args = dict(session_id="pre", metric="soil_moisture")

    def get(depth, **extra):
        return (
            env["client"]
            .get(path, params={**args, "depth": depth, **extra}, headers=env["headers"]["viewer"])
            .json()
        )

    shallow, deep = get(20), get(40)
    assert shallow["sites"] == deep["sites"] == 3
    assert 20 <= shallow["limits"][0] <= shallow["limits"][1] <= 22
    assert 80 <= deep["limits"][0] <= deep["limits"][1] <= 82
    assert shallow["time"] == env["current"][0].isoformat()
    assert "image" not in get(40, session_id="unknown")
    assert (
        env["client"].get(path, params=args, headers=env["headers"]["gateway"]).status_code == 403
    )
