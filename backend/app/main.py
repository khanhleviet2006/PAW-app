import asyncio
import base64
import json
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError

from . import models as m
from .auth import Principal, authenticate, deployment_viewer, digest
from .config import Settings
from .db import database, now, utc
from .field_map import field_payload, point_collection
from .imagery import router as imagery_router
from .responses import AckOut, DeploymentOut, HistoryOut, SnapshotOut
from .schemas import (
    DEFAULT_THRESHOLDS,
    UNITS,
    DeploymentStart,
    FarmCreate,
    IngestInput,
    KeyCreate,
    NodeCreate,
    PlotCreate,
    SensorCreate,
    SessionCreate,
    ThresholdUpdate,
)
from .services import (
    active_deployment,
    deployment_json,
    flush_alerts,
    ingest,
    lock_farm,
    measurement_json,
    publish,
    require,
    snapshot,
    start_deployment,
    status_fingerprint,
)


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    engine, sessions = database(config.database_url)

    @asynccontextmanager
    async def lifespan(_):
        yield
        engine.dispose()

    app = FastAPI(
        title="PAW Mobile Sensor API",
        version="1.0.0",
        lifespan=lifespan,
        description="Node di động GPS, lần đặt node, số đo và SSE. API mới; không thay thế firmware ingest/ACK cũ khi chưa xác minh.",
    )
    app.include_router(imagery_router)
    app.state.settings, app.state.sessions, app.state.engine = config, sessions, engine
    app.state.clock = now
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Last-Event-ID"],
    )

    @app.exception_handler(IntegrityError)
    async def conflict(_, __):
        return JSONResponse(
            status_code=409,
            content={
                "detail": "Định danh hoặc trạng thái xung đột; dữ liệu không được ghi một phần."
            },
        )

    @app.exception_handler(OperationalError)
    async def unavailable(_, __):
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database chưa sẵn sàng hoặc đang bận; retry cùng event_id nếu ingest."
            },
            headers={"Retry-After": "2"},
        )

    def db():
        with sessions.begin() as session:
            yield session
            flush_alerts(session, config, clock())

    def clock():
        return utc(app.state.clock())

    Actor = Annotated[Principal, Depends(authenticate)]
    DB = Annotated[object, Depends(db, scope="function")]

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "1.0.0"}

    @app.get("/v1/viewer-bootstrap")
    def viewer_bootstrap(request: Request, response: Response):
        response.headers["Cache-Control"] = "no-store"
        viewer = deployment_viewer(request)
        if not viewer:
            raise HTTPException(
                403, "Ứng dụng chưa được cấp quyền xem. Vui lòng liên hệ quản trị viên."
            )
        with sessions() as session:
            farm = session.get(m.Farm, viewer.farm_id)
            if not farm or farm.source != "sensor":
                raise HTTPException(
                    503, "Khu quan trắc chưa sẵn sàng. Quản trị viên cần hoàn tất bàn giao."
                )
        return {"farm_id": viewer.farm_id}

    @app.get("/ready")
    def ready(session: DB):
        session.execute(select(m.Farm.id).limit(1))
        return {"status": "ready"}

    @app.post("/v1/farms", status_code=201)
    def create_farm(body: FarmCreate, actor: Actor, session: DB):
        if actor.role != "admin":
            raise HTTPException(403, "Chỉ quản trị viên được tạo trang trại")
        farm = m.Farm(**body.model_dump(), thresholds=DEFAULT_THRESHOLDS)
        session.add(farm)
        session.flush()
        publish(session, farm.id, "farm.created")
        return {"id": farm.id, "source": farm.source}

    @app.get("/v1/farms")
    def list_farms(actor: Actor, session: DB):
        query = select(m.Farm).order_by(m.Farm.id)
        if actor.role != "admin":
            query = query.where(m.Farm.id == actor.farm_id)
        return [{"id": f.id, "name": f.name, "source": f.source} for f in session.scalars(query)]

    @app.post("/v1/farms/{farm_id}/keys", status_code=201)
    def create_key(farm_id: str, body: KeyCreate, actor: Actor, session: DB):
        if actor.role != "admin":
            raise HTTPException(403, "Chỉ quản trị viên được cấp key")
        require(session, m.Farm, farm_id)
        token = secrets.token_urlsafe(40)
        key = m.ApiKey(token_hash=digest(token), role=body.role, farm_id=farm_id)
        session.add(key)
        session.flush()
        return JSONResponse(
            status_code=201,
            content={"id": key.id, "token": token, "role": key.role, "farm_id": farm_id},
            headers={"Cache-Control": "no-store"},
        )

    @app.delete("/v1/farms/{farm_id}/keys/{key_id}", status_code=204)
    def revoke_key(farm_id: str, key_id: str, actor: Actor, session: DB):
        if actor.role != "admin":
            raise HTTPException(403, "Chỉ quản trị viên được thu hồi key")
        key = require(session, m.ApiKey, key_id)
        if key.farm_id != farm_id:
            raise HTTPException(404, "Không tìm thấy key")
        key.active = False

    @app.post("/v1/farms/{farm_id}/plots", status_code=201)
    def create_plot(farm_id: str, body: PlotCreate, actor: Actor, session: DB):
        actor.require(farm_id, "operator")
        lock_farm(session, farm_id)
        session.add(m.Plot(farm_id=farm_id, **body.model_dump()))
        publish(session, farm_id, "plot.created", plot_id=body.id)
        return {"id": body.id}

    @app.patch("/v1/farms/{farm_id}/thresholds")
    def thresholds(farm_id: str, body: ThresholdUpdate, actor: Actor, session: DB):
        actor.require(farm_id, "operator")
        farm = lock_farm(session, farm_id)
        farm.thresholds = body.model_dump(mode="json")
        publish(session, farm_id, "thresholds.changed")
        return {
            "thresholds": farm.thresholds,
            "notice": "Ngưỡng giám sát; không phải khuyến nghị tưới.",
        }

    @app.post("/v1/farms/{farm_id}/nodes", status_code=201)
    def create_node(farm_id: str, body: NodeCreate, actor: Actor, session: DB):
        actor.require(farm_id, "operator")
        lock_farm(session, farm_id)
        session.add(m.Node(farm_id=farm_id, **body.model_dump()))
        publish(session, farm_id, "node.created", node_id=body.id)
        return {"id": body.id}

    @app.post("/v1/nodes/{node_id}/sensors", status_code=201)
    def create_sensor(node_id: str, body: SensorCreate, actor: Actor, session: DB):
        node = require(session, m.Node, node_id)
        actor.require(node.farm_id, "operator")
        lock_farm(session, node.farm_id)
        session.add(
            m.Sensor(
                node_id=node_id,
                unit=body.unit or UNITS[body.metric],
                **body.model_dump(exclude={"unit"}),
            )
        )
        publish(session, node.farm_id, "sensor.created", node_id=node.id)
        return {"id": body.id}

    @app.get("/v1/gateway/nodes/{node_id}/deployment")
    def gateway_deployment(node_id: str, actor: Actor, session: DB):
        if actor.role != "gateway":
            raise HTTPException(403, "Cần gateway key")
        node = require(session, m.Node, node_id)
        actor.require(node.farm_id, "gateway")
        current = active_deployment(session, node_id)
        return {
            "node_id": node_id,
            "active_deployment": deployment_json(current) if current else None,
            "notice": "Chỉ áp dụng cho số đo tương lai đúng khoảng thời gian; không sửa deployment ID của gói đã buffer.",
        }

    @app.post("/v1/gateway/ingest", response_model=AckOut)
    def receive(body: IngestInput, actor: Actor, session: DB):
        if actor.role != "gateway" or not actor.farm_id:
            raise HTTPException(403, "Ingest chỉ chấp nhận gateway key có phạm vi trang trại")
        result = ingest(session, actor.id, actor.farm_id, body, clock(), config)
        # ACK is returned only after commit. Failed persistence MUST NOT yield accepted.
        flush_alerts(session, config, clock())
        session.commit()
        return result

    @app.post("/v1/nodes/{node_id}/deployments", status_code=201, response_model=DeploymentOut)
    def place(node_id: str, body: DeploymentStart, actor: Actor, session: DB):
        node = require(session, m.Node, node_id)
        actor.require(node.farm_id, "operator")
        return deployment_json(start_deployment(session, node, body, actor, config, clock()))

    @app.post("/v1/nodes/{node_id}/withdraw")
    def withdraw(node_id: str, actor: Actor, session: DB):
        node = require(session, m.Node, node_id)
        actor.require(node.farm_id, "operator")
        lock_farm(session, node.farm_id)
        deployment = active_deployment(session, node_id)
        if not deployment:
            raise HTTPException(409, "Node chưa có lần đặt đang hoạt động")
        deployment.ended_at, deployment.active_node_id = clock(), None
        publish(session, node.farm_id, "deployment.ended", node_id=node_id)
        return deployment_json(deployment)

    @app.get("/v1/nodes/{node_id}/deployments")
    def deployments(
        node_id: str,
        actor: Actor,
        session: DB,
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0, le=100000),
    ):
        node = require(session, m.Node, node_id)
        actor.require(node.farm_id, "viewer", "operator")
        rows = session.scalars(
            select(m.Deployment)
            .where(m.Deployment.node_id == node_id)
            .order_by(m.Deployment.started_at.desc(), m.Deployment.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [deployment_json(d) for d in rows]

    @app.get("/v1/nodes/{node_id}/positions")
    def positions(
        node_id: str,
        actor: Actor,
        session: DB,
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0, le=100000),
    ):
        node = require(session, m.Node, node_id)
        actor.require(node.farm_id, "viewer", "operator")
        rows = session.scalars(
            select(m.Position)
            .where(m.Position.node_id == node_id)
            .order_by(m.Position.observed_at.desc(), m.Position.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [
            {
                "id": p.id,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "accuracy_m": p.accuracy_m,
                "observed_at": utc(p.observed_at).isoformat(),
            }
            for p in rows
        ]

    @app.post("/v1/farms/{farm_id}/measurement-sessions", status_code=201)
    def create_measurement_session(farm_id: str, body: SessionCreate, actor: Actor, session: DB):
        actor.require(farm_id, "operator")
        lock_farm(session, farm_id)
        plot = require(session, m.Plot, body.plot_id)
        if plot.farm_id != farm_id:
            raise HTTPException(422, "Vùng không thuộc trang trại")
        session.add(m.MeasurementSession(farm_id=farm_id, **body.model_dump()))
        publish(session, farm_id, "measurement_session.created", session_id=body.id)
        return {"id": body.id, "measurement_phase": "PRE_PAW"}

    def read_snapshot(farm_id, include_points=False):
        with sessions.begin() as session:
            data = snapshot(session, farm_id, config, clock())
            if include_points:
                if data["farm"]["source"] != "sensor":
                    raise HTTPException(409, "Bản đồ GPS thực không sử dụng dữ liệu mô phỏng")
                return field_payload(session, data)
            return data

    @app.get("/v1/farms/{farm_id}/map", response_model=SnapshotOut)
    def map_snapshot(farm_id: str, actor: Actor, response: Response):
        actor.require(farm_id, "viewer", "operator")
        response.headers["Cache-Control"] = "no-store"
        return read_snapshot(farm_id)

    @app.get("/v1/farms/{farm_id}/map-points")
    def map_points(
        farm_id: str,
        actor: Actor,
        session: DB,
        limit: int = Query(1000, ge=1, le=10000),
        after: str | None = Query(None, max_length=80),
    ):
        actor.require(farm_id, "viewer", "operator")
        farm = lock_farm(session, farm_id)
        if farm.source != "sensor":
            raise HTTPException(409, "Bản đồ GPS thực không sử dụng dữ liệu mô phỏng")
        return point_collection(session, farm_id, limit, after)

    @app.get("/v1/farms/{farm_id}/alerts")
    def alerts(farm_id: str, actor: Actor):
        actor.require(farm_id, "viewer", "operator")
        data = read_snapshot(farm_id)
        return {
            "reference_time": data["reference_time"],
            "items": data["alerts"],
            "notice": "Cảnh báo giám sát hiện tại; không tự khuyến nghị tưới.",
        }

    @app.get("/v1/farms/{farm_id}/alert-history")
    def alert_history(
        farm_id: str,
        actor: Actor,
        session: DB,
        limit: int = Query(100, ge=1, le=1000),
        offset: int = Query(0, ge=0, le=100000),
    ):
        actor.require(farm_id, "viewer", "operator")
        rows = session.scalars(
            select(m.Alert)
            .where(m.Alert.farm_id == farm_id)
            .order_by(m.Alert.opened_at.desc(), m.Alert.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [
            {
                "id": r.id,
                "kind": r.kind,
                "payload": r.payload,
                "opened_at": utc(r.opened_at).isoformat(),
                "resolved_at": utc(r.resolved_at).isoformat() if r.resolved_at else None,
                "acknowledged_at": utc(r.acknowledged_at).isoformat()
                if r.acknowledged_at
                else None,
            }
            for r in rows
        ]

    @app.post("/v1/farms/{farm_id}/alerts/{alert_id}/acknowledge")
    def acknowledge(farm_id: str, alert_id: str, actor: Actor, session: DB):
        actor.require(farm_id, "operator")
        lock_farm(session, farm_id)
        alert = require(session, m.Alert, alert_id)
        if alert.farm_id != farm_id:
            raise HTTPException(404, "Không tìm thấy cảnh báo")
        if alert.acknowledged_at is None:
            alert.acknowledged_at, alert.acknowledged_by = clock(), actor.id
        publish(session, farm_id, "alert.acknowledged", alert_id=alert.id)
        return {"id": alert.id, "acknowledged_at": utc(alert.acknowledged_at).isoformat()}

    @app.get("/v1/farms/{farm_id}/measurements", response_model=HistoryOut)
    def history(
        farm_id: str,
        actor: Actor,
        session: DB,
        node_id: str | None = None,
        plot_id: str | None = None,
        deployment_id: str | None = None,
        sensor_id: str | None = None,
        metric: Literal["air_temperature", "air_humidity", "soil_moisture", "soil_ph"]
        | None = None,
        depth_cm: float | None = Query(None, ge=0, le=300),
        phase: Literal["ALL", "PRE_PAW", "UNKNOWN"] = "ALL",
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = Query(100, ge=1, le=1000),
        cursor: str | None = Query(None, max_length=512),
    ):
        actor.require(farm_id, "viewer", "operator")
        require(session, m.Farm, farm_id)
        for value in (start, end):
            if value and value.tzinfo is None:
                raise HTTPException(422, "Thời gian truy vấn cần UTC offset")
        if start and end and start >= end:
            raise HTTPException(422, "start phải trước end")
        query = select(m.Measurement).where(m.Measurement.farm_id == farm_id)
        for field, value in {
            "node_id": node_id,
            "plot_id": plot_id,
            "deployment_id": deployment_id,
            "sensor_id": sensor_id,
            "metric": metric,
            "depth_cm": depth_cm,
        }.items():
            if value is not None:
                query = query.where(getattr(m.Measurement, field) == value)
        if phase != "ALL":
            query = query.where(m.Measurement.phase == phase)
        if start:
            query = query.where(m.Measurement.observed_at >= start)
        if end:
            query = query.where(m.Measurement.observed_at < end)
        if cursor:
            try:
                payload = json.loads(base64.urlsafe_b64decode(cursor.encode()))
                before, identifier = datetime.fromisoformat(payload[0]), payload[1]
                if before.tzinfo is None or not isinstance(identifier, str):
                    raise ValueError
            except (ValueError, TypeError, IndexError, KeyError):
                raise HTTPException(422, "Cursor không hợp lệ") from None
            query = query.where(
                (m.Measurement.observed_at < before)
                | ((m.Measurement.observed_at == before) & (m.Measurement.id < identifier))
            )
        rows = list(
            session.scalars(
                query.order_by(m.Measurement.observed_at.desc(), m.Measurement.id.desc()).limit(
                    limit + 1
                )
            )
        )
        more = len(rows) > limit
        rows = rows[:limit]
        next_cursor = (
            base64.urlsafe_b64encode(
                json.dumps([utc(rows[-1].observed_at).isoformat(), rows[-1].id]).encode()
            ).decode()
            if more
            else None
        )
        return {"items": [measurement_json(r) for r in rows], "next_cursor": next_cursor}

    @app.get("/v1/farms/{farm_id}/events", response_class=StreamingResponse)
    async def events(
        farm_id: str,
        request: Request,
        actor: Actor,
        since: int | None = Query(None, ge=0, le=9223372036854775807),
        last_event_id: str | None = Header(None, max_length=20),
        include_map_points: bool = False,
    ):
        actor.require(farm_id, "viewer", "operator")
        if last_event_id is not None:
            if not last_event_id.isdecimal() or int(last_event_id) > 9223372036854775807:
                raise HTTPException(422, "Last-Event-ID không hợp lệ")
            since = int(last_event_id)
        initial = await asyncio.to_thread(read_snapshot, farm_id, include_map_points)
        if since is not None and since > initial["cursor"]:
            raise HTTPException(409, "Cursor không thuộc lịch sử hiện tại; cần lấy snapshot mới")

        def key_active():
            if actor.id == "deployment-viewer":
                return deployment_viewer(request) == actor
            if actor.role == "admin":
                return True
            with sessions() as session:
                key = session.get(m.ApiKey, actor.id)
                return bool(key and key.active)

        async def stream() -> AsyncIterator[str]:
            data = initial
            fingerprint = ""
            cursor = -1
            heartbeat = 0
            while not await request.is_disconnected():
                if not await asyncio.to_thread(key_active):
                    yield "event: auth.revoked\ndata: {}\n\n"
                    return
                stamp = status_fingerprint(data)
                if data["cursor"] != cursor or stamp != fingerprint:
                    cursor, fingerprint = data["cursor"], stamp
                    # Authoritative replacement snapshot: coalesces events, survives
                    # restarts, and never requires one REST GET per sensor message.
                    yield f"id: {cursor}\nevent: snapshot\ndata: {json.dumps(data, ensure_ascii=False, allow_nan=False)}\n\n"
                heartbeat += config.sse_poll_seconds
                if heartbeat >= 15:
                    yield ": heartbeat\n\n"
                    heartbeat = 0
                await asyncio.sleep(config.sse_poll_seconds)
                data = await asyncio.to_thread(read_snapshot, farm_id, include_map_points)

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
        )

    if config.frontend_dist is not None:
        root = config.frontend_dist.resolve()
        if not (root / "index.html").is_file():
            raise RuntimeError("PAW_FRONTEND_DIST chưa có Vite build index.html")
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="frontend-assets")

        @app.get("/{page:path}", include_in_schema=False)
        def spa(page: str):
            if page.startswith(("v1/", "assets/")):
                raise HTTPException(404, "Không tìm thấy tài nguyên")
            return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})

    return app
