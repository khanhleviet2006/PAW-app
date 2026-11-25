from fastapi.testclient import TestClient


def configure(env):
    settings = env["app"].state.settings
    settings.viewer_farm_id = "farm"
    settings.viewer_networks = ["127.0.0.1/32"]
    settings.viewer_origins = ["http://testserver"]
    return settings


def test_grant_disabled_by_default(env):
    assert env["client"].get("/v1/viewer-bootstrap").status_code == 403
    assert env["client"].get("/v1/farms/farm/map").status_code == 401


def test_deployment_read_only_grant(env):
    configure(env)
    with TestClient(env["app"], client=("127.0.0.1", 1234)) as client:
        # Bootstrap refuses the simulation fixture; never supplies fake real-world GPS.
        assert client.get("/v1/viewer-bootstrap").status_code == 503
        farm = env["post"]("/v1/farms", {"id": "real", "name": "Real field", "source": "sensor"})
        assert farm["id"] == "real"
        env["app"].state.settings.viewer_farm_id = "real"
        response = client.get("/v1/viewer-bootstrap")
        assert response.json() == {"farm_id": "real"}
        assert response.headers["cache-control"] == "no-store"
        assert client.get("/v1/farms/real/map").status_code == 200
        assert client.get("/v1/farms/real/imagery/active").json()["item"] is None
        assert client.get("/v1/farms/farm/map").status_code == 403
        assert client.post("/v1/farms", json={}).status_code == 401
        assert client.post("/v1/gateway/ingest", json={}).status_code == 401
        assert client.post("/v1/farms/real/keys", json={"role": "admin"}).status_code == 401
        assert (
            client.get(
                "/v1/farms/real/map", headers={"Authorization": "Bearer invalid"}
            ).status_code
            == 401
        )
        for header in ["Bearer", "Basic invalid"]:
            assert (
                client.get("/v1/farms/real/map", headers={"Authorization": header}).status_code
                == 401
            )
        env["app"].state.settings.viewer_networks = []
        assert client.get("/v1/farms/real/map").status_code == 401


def test_network_origin_and_host_are_explicit(env):
    configure(env)
    for address in ["192.0.2.1", "::1"]:
        with TestClient(env["app"], client=(address, 1234)) as client:
            assert (
                client.get(
                    "/v1/viewer-bootstrap", headers={"X-Forwarded-For": "127.0.0.1"}
                ).status_code
                == 403
            )
    with TestClient(env["app"], client=("127.0.0.1", 1234)) as client:
        for headers in [{"Host": "attacker.example"}, {"Origin": "https://attacker.example"}]:
            assert client.get("/v1/viewer-bootstrap", headers=headers).status_code == 403
        # Existing device and admin tokens continue working independently.
        assert client.get("/v1/farms", headers=env["admin"]).status_code == 200
