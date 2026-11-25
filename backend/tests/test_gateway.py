import httpx
import pytest

from app.gateway import enqueue, flush
from app.schemas import IngestInput


def test_outbox_retains_on_timeout_then_retries_identical_packet(env, tmp_path):
    e = env
    packet = IngestInput.model_validate(e["packet"]())
    path = enqueue(tmp_path, packet)
    with httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(503)), base_url="http://test"
    ) as client:
        assert flush(tmp_path, client, "test-gateway") == (0, 1)
    assert path.exists()
    sent = []

    def handle(request):
        sent.append(request.content)
        return httpx.Response(
            200,
            json={
                "accepted": True,
                "event_id": packet.event_id,
                "position_id": "gps",
                "measurement_ids": [],
                "received_at": e["current"][0].isoformat(),
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handle), base_url="http://test") as client:
        assert flush(tmp_path, client, "test-gateway") == (1, 0)
    assert not path.exists()
    assert IngestInput.model_validate_json(sent[0]) == packet


def test_outbox_does_not_delete_after_mismatched_ack(env, tmp_path):
    packet = IngestInput.model_validate(env["packet"]())
    path = enqueue(tmp_path, packet)

    def bad(_):
        return httpx.Response(
            200,
            json={
                "accepted": True,
                "event_id": "wrong",
                "position_id": None,
                "measurement_ids": [],
                "received_at": env["current"][0].isoformat(),
            },
        )

    with httpx.Client(transport=httpx.MockTransport(bad), base_url="http://test") as client:
        assert flush(tmp_path, client, "gateway") == (0, 1)
    assert path.exists()
    different = packet.model_copy(update={"node_id": "another-node"})
    with pytest.raises(ValueError):
        enqueue(tmp_path, different)


def test_gateway_can_read_own_deployment_but_not_map(env):
    e = env
    d = e["place"]()
    response = e["client"].get("/v1/gateway/nodes/node/deployment", headers=e["headers"]["gateway"])
    assert response.status_code == 200
    assert response.json()["active_deployment"]["id"] == d["id"]
