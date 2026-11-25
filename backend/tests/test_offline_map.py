import mercantile
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from app import models as m
from app.import_imagery import import_geotiff


@pytest.fixture
def real_contract(env, tmp_path):
    # Isolated protocol fixtures only; never seeded by the running application.
    e = env
    with e["app"].state.sessions.begin() as session:
        session.get(m.Farm, "farm").source = "sensor"
    original = e["packet"]

    def packet(*args, **kwargs):
        value = original(*args, **kwargs)
        value["source"] = "sensor"
        return value

    e["packet"] = packet

    def place(longitude=108.005):
        ack = e["send"](packet(longitude=longitude))
        return e["post"](
            "/v1/nodes/node/deployments",
            {"position_id": ack["position_id"]},
            e["headers"]["operator"],
        )

    e["place"] = place
    e["app"].state.settings.imagery_dir = tmp_path / "imagery"
    return e


def test_measurement_locations_are_immutable_and_paged(real_contract):
    e = real_contract
    first = e["place"]()
    e["advance"](120)
    old = e["current"][0]
    e["send"](e["packet"]([e["reading"](first, value=25)]))
    e["advance"](10)
    second = e["place"](108.025)
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](second, value=27)], longitude=108.025))
    path = "/v1/farms/farm/map-points"
    first_page = e["client"].get(path, params={"limit": 1}, headers=e["headers"]["viewer"]).json()
    second_page = (
        e["client"]
        .get(
            path,
            params={"limit": 1, "after": first_page["next_cursor"]},
            headers=e["headers"]["viewer"],
        )
        .json()
    )
    features = first_page["features"] + second_page["features"]
    assert {f["geometry"]["coordinates"][0] for f in features} == {108.005, 108.025}
    assert all(f["properties"]["source"] == "sensor" for f in features)
    assert len({f["id"] for f in features}) == 2
    assert second_page["next_cursor"] is None
    # Late historical data remains attached to A, not the latest GPS at B.
    e["send"](e["packet"]([e["reading"](first, observed_at=old, value=24)], observed_at=old))
    all_points = e["client"].get(path, headers=e["headers"]["viewer"]).json()["features"]
    assert sum(f["geometry"]["coordinates"][0] == 108.005 for f in all_points) == 2


def test_simulation_is_not_used_by_field_map(env):
    assert (
        env["client"].get("/v1/farms/farm/map-points", headers=env["headers"]["viewer"]).status_code
        == 409
    )


def test_import_and_serve_local_geotiff_without_network(real_contract, tmp_path):
    e = real_contract
    source = tmp_path / "test-only-synthetic.tif"
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
    ) as dest:
        dest.write(np.full((3, 64, 64), 120, dtype="uint8"))
    root = e["app"].state.settings.imagery_dir
    record = {
        "id": "test-only",
        "farm_id": "farm",
        "license": "TEST FIXTURE ONLY",
        "license_url": "https://example.invalid/test-fixture",
        "attribution": "<b>Test pixels</b>",
        "offline_rights_confirmed": True,
        "minzoom": 14,
        "maxzoom": 14,
    }
    result = import_geotiff(source, root / "test-only.mbtiles", record, [1, 2, 3], max_tiles=20)
    assert result["tile_count"] > 0
    path = "/v1/farms/farm/imagery"
    catalog = e["client"].get(path, headers=e["headers"]["viewer"]).json()["items"]
    assert catalog[0]["attribution"] == "&lt;b&gt;Test pixels&lt;/b&gt;"
    tile = mercantile.tile(108.005, 11.005, 14)
    url = f"{path}/test-only/{tile.z}/{tile.x}/{tile.y}.png"
    response = e["client"].get(url, headers=e["headers"]["viewer"])
    assert response.status_code == 200 and response.content.startswith(b"\x89PNG")
    assert e["client"].get(url).status_code == 401
    assert e["client"].get(url, headers=e["headers"]["gateway"]).status_code == 403
    assert (
        e["client"].get(f"{path}/test-only/14/-1/0.png", headers=e["headers"]["viewer"]).status_code
        == 404
    )
    with pytest.raises(ValueError):
        import_geotiff(source, root / "test-only.mbtiles", record, [1, 2, 3])
    with pytest.raises(ValueError):
        import_geotiff(
            source,
            root / "unlicensed.mbtiles",
            {**record, "offline_rights_confirmed": False},
            [1, 2, 3],
        )


def test_no_imagery_returns_empty_catalog_not_fake_image(real_contract):
    e = real_contract
    assert (
        e["client"].get("/v1/farms/farm/imagery", headers=e["headers"]["viewer"]).json()["items"]
        == []
    )


def test_spa_serving_has_no_api_fallback(tmp_path):
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import create_app

    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text("<html>LOCAL PAW TEST</html>")
    (root / "assets" / "worker.js").write_text("/* test */")
    app = create_app(
        Settings(
            admin_token="test-only-admin-token-long-enough-123",
            frontend_dist=root,
            database_url=f"sqlite:///{tmp_path}/db.sqlite",
        )
    )
    with TestClient(app) as client:
        assert "LOCAL PAW TEST" in client.get("/field-map").text
        assert client.get("/assets/worker.js").status_code == 200
        assert client.get("/v1/missing").status_code == 404


def test_active_imagery_never_guesses_between_multiple_datasets(real_contract, tmp_path):
    import json
    import sqlite3

    e = real_contract
    root = e["app"].state.settings.imagery_dir
    root.mkdir()
    for name in ["older", "newer"]:
        record = {
            "id": name,
            "farm_id": "farm",
            "offline_rights_confirmed": True,
            "attribution": "Test pixels only",
            "minzoom": 10,
            "maxzoom": 10,
        }
        with sqlite3.connect(root / f"{name}.mbtiles") as db:
            db.execute("CREATE TABLE metadata(name TEXT PRIMARY KEY,value TEXT)")
            db.execute("INSERT INTO metadata VALUES(?,?)", ("paw", json.dumps(record)))
    path = "/v1/farms/farm/imagery/active"
    headers = e["headers"]["viewer"]
    result = e["client"].get(path, headers=headers).json()
    assert result["item"] is None
    assert result["notice"] == "Chưa cài đặt dữ liệu ảnh vệ tinh khu vực"
    e["app"].state.settings.active_imagery_ids = {"farm": "newer"}
    assert e["client"].get(path, headers=headers).json()["item"]["id"] == "newer"
    e["app"].state.settings.active_imagery_ids = {"farm": "not-installed"}
    assert e["client"].get(path, headers=headers).json()["item"] is None  # never fallback to older
    assert e["client"].get(path).status_code == 401
    assert e["client"].get(path, headers=e["headers"]["gateway"]).status_code == 403


def test_missing_active_imagery_exact_notice(real_contract):
    e = real_contract
    result = e["client"].get("/v1/farms/farm/imagery/active", headers=e["headers"]["viewer"])
    assert result.status_code == 200
    assert result.json() == {"item": None, "notice": "Chưa cài đặt dữ liệu ảnh vệ tinh khu vực"}
