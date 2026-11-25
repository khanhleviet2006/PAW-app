from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app import models as m
from app.schemas import Polygon


def state(e):
    r = e["client"].get("/v1/farms/farm/map", headers=e["headers"]["viewer"])
    assert r.status_code == 200, r.text
    return r.json()


def history(e, **params):
    r = e["client"].get(
        "/v1/farms/farm/measurements", params=params, headers=e["headers"]["viewer"]
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_snapshot_empty_and_missing_sensor(env):
    e = env
    assert state(e)["heat_points"] == []
    assert state(e)["nodes"][0]["placement_state"] == "unplaced"
    e["place"]()
    data = state(e)
    assert len([x for x in data["alerts"] if x["kind"] == "missing"]) == 5
    assert data["nodes"][0]["placement_state"] == "stabilizing"


def test_placement_stabilization_and_heatmap(env):
    e = env
    deployment = e["place"]()
    e["send"](e["packet"]([e["reading"](deployment)]))
    assert state(e)["latest"][0]["quality"] == "stabilizing"
    assert state(e)["heat_points"] == []
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](deployment)]))
    point = state(e)["heat_points"][0]
    assert point["longitude"] == 108.005 and point["plot_id"] == "A"
    assert point["measurement_phase"] == "UNKNOWN"
    assert point["source"] == "simulation"


def test_moving_node_preserves_a_history_and_accepts_late_a_packet(env):
    e = env
    first = e["place"]()
    e["advance"](120)
    old_time = e["current"][0]
    e["send"](e["packet"]([e["reading"](first, value=25)]))
    e["advance"](30)
    second = e["place"](108.025)
    assert state(e)["heat_points"] == []
    assert second["plot_id"] == "B"
    e["send"](
        e["packet"](
            [e["reading"](first, value=24, observed_at=old_time + timedelta(seconds=5))],
            observed_at=old_time + timedelta(seconds=5),
        )
    )
    assert state(e)["latest"] == []  # delayed A data never appears at B
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](second, value=27)], longitude=108.025))
    assert state(e)["heat_points"][0]["plot_id"] == "B"
    assert len(history(e, plot_id="A")["items"]) == 2
    assert len(history(e, plot_id="B")["items"]) == 1
    assert all(x["deployment_id"] == first["id"] for x in history(e, plot_id="A")["items"])


def test_withdraw_removes_heat_and_stores_transit_readings(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d)]))
    e["post"]("/v1/nodes/node/withdraw", headers=e["headers"]["operator"])
    e["send"](e["packet"]([e["reading"](None)]))
    assert state(e)["heat_points"] == []
    assert state(e)["nodes"][0]["position"] is None
    assert any(row["quality"] == "moving" and row["plot_id"] is None for row in history(e)["items"])


def test_duplicate_idempotent_and_conflicting_event_id(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    body = e["packet"]([e["reading"](d)])
    ack = e["send"](body)
    cursor = state(e)["cursor"]
    assert e["send"](body) == ack
    assert state(e)["cursor"] == cursor
    assert len(history(e)["items"]) == 1
    body["readings"][0]["value"] = 30
    assert (
        e["client"]
        .post("/v1/gateway/ingest", json=body, headers=e["headers"]["gateway"])
        .status_code
        == 409
    )


def test_batch_rolls_back_all_writes_on_invalid_sensor(env):
    e = env
    d = e["place"]()
    before = state(e)["cursor"]
    e["advance"](120)
    body = e["packet"]([e["reading"](d), e["reading"](d, sensor="unknown")])
    assert (
        e["client"]
        .post("/v1/gateway/ingest", json=body, headers=e["headers"]["gateway"])
        .status_code
        == 404
    )
    assert history(e)["items"] == []
    assert state(e)["cursor"] == before


def test_separate_soil_depths_and_invalid_measurement(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](
        e["packet"](
            [
                e["reading"](d, "soil20", 30),
                e["reading"](d, "soil40", 60),
                e["reading"](d, "ph", 18),
            ]
        )
    )
    data = state(e)
    assert {x["depth_cm"] for x in data["heat_points"]} == {20, 40}
    assert all(x["metric"] != "soil_ph" for x in data["heat_points"])
    assert any(x["kind"] == "invalid" for x in data["alerts"])
    assert history(e, depth_cm=20, metric="soil_moisture")["items"][0]["value"] == 30


def test_warning_threshold_change(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d, value=35)]))
    assert state(e)["latest"][0]["status"] == "warning"
    thresholds = state(e)["farm"]["thresholds"]
    thresholds["air_temperature"] = [18, 40]
    assert (
        e["client"]
        .patch("/v1/farms/farm/thresholds", json=thresholds, headers=e["headers"]["operator"])
        .status_code
        == 200
    )
    assert state(e)["latest"][0]["status"] == "normal"


def test_stale_offline_and_old_packets_do_not_reconnect_node(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    stamp = e["current"][0]
    e["send"](e["packet"]([e["reading"](d)]))
    e["advance"](1201)
    assert state(e)["latest"][0]["status"] == "stale"
    assert state(e)["heat_points"] == []
    e["advance"](600)
    e["send"](e["packet"](position=False, observed_at=stamp))
    assert state(e)["nodes"][0]["connectivity"] == "offline"
    assert state(e)["latest"][0]["status"] == "offline"


def test_fresh_heartbeat_does_not_make_old_measurement_fresh(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d)]))
    e["advance"](1201)
    e["send"](e["packet"]())
    assert state(e)["nodes"][0]["connectivity"] == "online"
    assert state(e)["latest"][0]["status"] == "stale"


def test_pre_paw_requires_matching_explicit_session(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    start = e["current"][0]
    e["post"](
        "/v1/farms/farm/measurement-sessions",
        {
            "id": "pre",
            "plot_id": "A",
            "started_at": start.isoformat(),
            "ended_at": (start + timedelta(minutes=10)).isoformat(),
            "irrigation_event_id": "irrigation-001",
        },
    )
    e["send"](e["packet"]([e["reading"](d, session_id="pre")]))
    assert history(e, phase="PRE_PAW")["items"][0]["session_id"] == "pre"
    e["advance"](600)
    body = e["packet"]([e["reading"](d, session_id="pre")])
    assert (
        e["client"]
        .post("/v1/gateway/ingest", json=body, headers=e["headers"]["gateway"])
        .status_code
        == 422
    )


@pytest.mark.parametrize("accuracy,age", [(100, 0), (3, 301)])
def test_reject_uncertain_or_stale_gps(env, accuracy, age):
    e = env
    ack = e["send"](e["packet"](accuracy=accuracy))
    e["advance"](age)
    r = e["client"].post(
        "/v1/nodes/node/deployments",
        json={"position_id": ack["position_id"]},
        headers=e["headers"]["operator"],
    )
    assert r.status_code == 422


def test_position_updates_do_not_move_confirmed_node_without_confirmation(env):
    e = env
    e["place"]()
    e["send"](e["packet"](longitude=108.025))
    assert state(e)["nodes"][0]["position"]["longitude"] == 108.005
    assert state(e)["nodes"][0]["deployment"]["plot_id"] == "A"


def test_outside_plot_can_place_but_does_not_interpolate(env):
    e = env
    d = e["place"](108.5)
    assert d["plot_id"] is None
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d)]))
    assert state(e)["heat_points"] == []
    assert state(e)["nodes"][0]["position"] is not None


def test_auth_scope_revocation_and_source_isolation(env):
    e = env
    c = e["client"]
    assert c.get("/v1/farms/farm/map").status_code == 401
    assert (
        c.post(
            "/v1/farms/farm/nodes",
            json={"id": "bad", "name": "bad"},
            headers=e["headers"]["viewer"],
        ).status_code
        == 403
    )
    assert c.get("/v1/farms/farm/map", headers=e["headers"]["gateway"]).status_code == 403
    e["post"]("/v1/farms", {"id": "other", "name": "Other", "source": "sensor"})
    assert c.get("/v1/farms/other/map", headers=e["headers"]["viewer"]).status_code == 403
    body = e["packet"]()
    body["source"] = "sensor"
    assert (
        c.post("/v1/gateway/ingest", json=body, headers=e["headers"]["gateway"]).status_code == 403
    )
    assert c.post("/v1/gateway/ingest", json=e["packet"](), headers=e["admin"]).status_code == 403
    assert (
        c.delete(f"/v1/farms/farm/keys/{e['keys']['viewer']['id']}", headers=e["admin"]).status_code
        == 204
    )
    assert c.get("/v1/farms/farm/map", headers=e["headers"]["viewer"]).status_code == 401


def test_pagination_history_and_time_validation(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    for value in range(5):
        e["send"](e["packet"]([e["reading"](d, value=20 + value)]))
    first = history(e, limit=2)
    second = history(e, limit=2, cursor=first["next_cursor"])
    third = history(e, limit=2, cursor=second["next_cursor"])
    ids = [x["id"] for page in [first, second, third] for x in page["items"]]
    assert len(ids) == len(set(ids)) == 5
    assert third["next_cursor"] is None
    for params in ({"cursor": "garbage"}, {"start": "2026-01-01T00:00:00"}, {"limit": 1001}):
        assert (
            e["client"]
            .get("/v1/farms/farm/measurements", params=params, headers=e["admin"])
            .status_code
            == 422
        )


def test_invalid_polygon_and_nan_never_reach_map(env):
    e = env
    with pytest.raises(ValueError):
        Polygon(coordinates=[[[108, 11], [108.1, 11.1], [108.1, 11], [108, 11.1], [108, 11]]])
    with pytest.raises(ValueError):
        Polygon(coordinates=[[[11, 108], [12, 108], [12, 109], [11, 108]]])
    body = e["packet"]()
    body["position"]["latitude"] = 100
    assert (
        e["client"]
        .post("/v1/gateway/ingest", json=body, headers=e["headers"]["gateway"])
        .status_code
        == 422
    )


def test_future_timestamp_rejected(env):
    e = env
    body = e["packet"](observed_at=e["current"][0] + timedelta(minutes=6))
    assert (
        e["client"]
        .post("/v1/gateway/ingest", json=body, headers=e["headers"]["gateway"])
        .status_code
        == 422
    )


def test_database_enforces_single_active_placement(env):
    e = env
    d = e["place"]()
    e["advance"](1)
    e["place"]()
    with e["app"].state.sessions() as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(m.Deployment)
                .where(m.Deployment.active_node_id == "node")
            )
            == 1
        )
        old = session.get(m.Deployment, d["id"])
        assert old.ended_at is not None


def test_openapi_declares_routes_and_security(env):
    spec = env["client"].get("/openapi.json").json()
    assert spec["openapi"].startswith("3.1")
    assert spec["paths"]["/v1/farms/{farm_id}/map"]["get"]["security"] == [{"HTTPBearer": []}]
    assert "/v1/gateway/ingest" in spec["paths"]


def test_gps_movement_requires_confirmation_and_removes_old_heat(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d)]))
    assert state(e)["heat_points"]
    e["advance"](1)
    e["send"](e["packet"](longitude=108.025))
    data = state(e)
    assert data["heat_points"] == []
    assert data["nodes"][0]["placement_state"] == "confirmation_required"
    assert data["nodes"][0]["position"]["longitude"] == 108.005
    assert data["nodes"][0]["candidate_position"]["longitude"] == 108.025
    assert data["latest"][0]["status"] == "moving"


def test_gps_jitter_does_not_create_new_deployment(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d)], longitude=108.00501))
    data = state(e)
    assert data["nodes"][0]["placement_state"] == "placed"
    assert data["nodes"][0]["deployment"]["id"] == d["id"]
    assert len(data["heat_points"]) == 1


def test_old_gps_cannot_relocate_or_flag_new_placement(env):
    e = env
    first = e["place"]()
    e["advance"](120)
    old = e["current"][0]
    e["advance"](60)
    second = e["place"](108.025)
    e["send"](e["packet"]([e["reading"](first, observed_at=old)], observed_at=old))
    node = state(e)["nodes"][0]
    assert node["deployment"]["id"] == second["id"]
    assert node["placement_state"] == "stabilizing"
    assert node["candidate_position"]["longitude"] == 108.025


def test_movement_latch_survives_gps_expiry(env):
    e = env
    d = e["place"]()
    e["advance"](120)
    e["send"](e["packet"]([e["reading"](d)]))
    e["advance"](1)
    e["send"](e["packet"](longitude=108.025))
    e["advance"](301)
    assert state(e)["nodes"][0]["placement_state"] == "confirmation_required"
    assert state(e)["heat_points"] == []
