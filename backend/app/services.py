import hashlib
import json
import math
from datetime import datetime, timedelta

from fastapi import HTTPException
from shapely.geometry import Point, shape
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models as m
from .config import Settings
from .db import iso, utc
from .schemas import BOUNDS, IngestInput


def require(session: Session, model, identifier: str):
    item = session.get(model, identifier)
    if item is None:
        raise HTTPException(404, "Không tìm thấy đối tượng")
    return item


def lock_farm(session: Session, farm_id: str):
    # All writers acquire this lock BEFORE allocating event IDs. This also gives
    # snapshots a consistent boundary and prevents out-of-order farm SSE cursors.
    farm = session.scalar(select(m.Farm).where(m.Farm.id == farm_id).with_for_update())
    if not farm:
        raise HTTPException(404, "Không tìm thấy trang trại")
    return farm


def publish(session: Session, farm_id: str, kind: str, **payload):
    session.info.setdefault("changed_farms", set()).add(farm_id)
    session.add(m.Event(farm_id=farm_id, kind=kind, payload=payload))
    session.flush()


def check_time(value: datetime, current: datetime):
    if utc(value) > current + timedelta(minutes=5):
        raise HTTPException(422, "Thời gian thiết bị vượt quá server hơn 5 phút")


def active_deployment(session: Session, node_id: str):
    return session.scalar(select(m.Deployment).where(m.Deployment.active_node_id == node_id))


def start_deployment(session, node, body, actor, settings, current):
    lock_farm(session, node.farm_id)
    pos = require(session, m.Position, body.position_id)
    if pos.node_id != node.id:
        raise HTTPException(422, "GPS không thuộc node")
    age = (current - utc(pos.observed_at)).total_seconds()
    if (
        age < -300
        or age > settings.gps_max_age_seconds
        or pos.accuracy_m > settings.gps_max_accuracy_m
    ):
        raise HTTPException(422, "GPS quá cũ hoặc chưa đủ chính xác; cần fix mới")
    point = Point(pos.longitude, pos.latitude)
    plots = session.scalars(select(m.Plot).where(m.Plot.farm_id == node.farm_id)).all()
    candidates = [p for p in plots if shape(p.geometry).covers(point)]
    if body.plot_id:
        plot = next((p for p in candidates if p.id == body.plot_id), None)
        if not plot:
            raise HTTPException(422, "Vị trí không nằm trong vùng đã chọn của trang trại")
    else:
        if len(candidates) > 1:
            raise HTTPException(409, "GPS thuộc nhiều vùng; người dùng cần chọn vùng để xác nhận")
        plot = candidates[0] if candidates else None
    previous = active_deployment(session, node.id)
    if previous:
        previous.ended_at = current
        previous.active_node_id = None
        session.flush()
    deployment = m.Deployment(
        node_id=node.id,
        active_node_id=node.id,
        plot_id=plot.id if plot else None,
        position_id=pos.id,
        started_at=current,
        stable_at=current + timedelta(seconds=settings.stabilization_seconds),
        confirmed_by=actor.id,
    )
    session.add(deployment)
    session.flush()
    publish(
        session, node.farm_id, "deployment.started", node_id=node.id, deployment_id=deployment.id
    )
    return deployment


def ingest(
    session: Session,
    key_id: str,
    farm_id: str,
    body: IngestInput,
    current: datetime,
    settings: Settings,
):
    farm = lock_farm(session, farm_id)
    request_hash = hashlib.sha256(body.model_dump_json().encode()).hexdigest()
    previous = session.scalar(
        select(m.IngestBatch).where(
            m.IngestBatch.gateway_id == key_id, m.IngestBatch.event_id == body.event_id
        )
    )
    if previous:
        if previous.request_hash != request_hash:
            raise HTTPException(409, "event_id đã dùng với nội dung khác")
        return previous.ack
    node = require(session, m.Node, body.node_id)
    if node.farm_id != farm_id or body.source != farm.source:
        raise HTTPException(403, "Node/nguồn dữ liệu không thuộc gateway/trang trại")
    check_time(body.node_observed_at, current)
    old_seen = utc(node.last_seen_at) if node.last_seen_at else None
    if old_seen is None or utc(body.node_observed_at) > old_seen:
        node.last_seen_at = utc(body.node_observed_at)
    position_id = None
    if body.position:
        check_time(body.position.observed_at, current)
        position = m.Position(node_id=node.id, **body.position.model_dump(), received_at=current)
        session.add(position)
        session.flush()
        position_id = position.id
        deployment = active_deployment(session, node.id)
        confirmed_position = session.get(m.Position, deployment.position_id) if deployment else None
        if (
            confirmed_position
            and utc(position.observed_at) >= utc(deployment.started_at)
            and position.accuracy_m <= settings.gps_max_accuracy_m
            and (current - utc(position.observed_at)).total_seconds()
            <= settings.gps_max_age_seconds
            and distance_m(confirmed_position, position)
            > max(
                settings.movement_threshold_m, confirmed_position.accuracy_m + position.accuracy_m
            )
        ):
            # Latch until explicit new placement. GPS expiry or returning near the old
            # point must NOT silently make the removed probe valid again.
            if deployment.movement_detected_at is None:
                deployment.movement_detected_at = utc(position.observed_at)
    measurement_ids = []
    for reading in body.readings:
        check_time(reading.observed_at, current)
        sensor = require(session, m.Sensor, reading.sensor_id)
        if sensor.node_id != node.id:
            raise HTTPException(422, "Cảm biến không thuộc node")
        deployment = (
            require(session, m.Deployment, reading.deployment_id) if reading.deployment_id else None
        )
        observed = utc(reading.observed_at)
        if deployment and (
            deployment.node_id != node.id
            or observed < utc(deployment.started_at)
            or (deployment.ended_at and observed >= utc(deployment.ended_at))
        ):
            raise HTTPException(422, "Số đo nằm ngoài lần đặt node được khai báo")
        # No deployment ID: retain transit data, NEVER attach current deployment implicitly.
        quality = "valid"
        if not deployment:
            quality = "moving"
        elif deployment.movement_detected_at and observed >= utc(deployment.movement_detected_at):
            quality = "moving"
        elif observed < utc(deployment.stable_at):
            quality = "stabilizing"
        elif not sensor.calibrated:
            quality = "uncalibrated"
        low, high = BOUNDS[sensor.metric]
        if sensor.unit != "raw" and not low <= reading.value <= high:
            quality = "invalid"
        measure_session = (
            require(session, m.MeasurementSession, reading.session_id)
            if reading.session_id
            else None
        )
        if measure_session and (
            measure_session.farm_id != farm_id
            or not deployment
            or measure_session.plot_id != deployment.plot_id
            or not utc(measure_session.started_at) <= observed < utc(measure_session.ended_at)
        ):
            raise HTTPException(422, "Phiên PRE_PAW không phù hợp vùng hoặc thời gian")
        measurement = m.Measurement(
            farm_id=farm_id,
            node_id=node.id,
            sensor_id=sensor.id,
            deployment_id=deployment.id if deployment else None,
            plot_id=deployment.plot_id if deployment else None,
            session_id=measure_session.id if measure_session else None,
            metric=sensor.metric,
            unit=sensor.unit,
            depth_cm=sensor.depth_cm,
            value=reading.value,
            calibrated=sensor.calibrated,
            quality=quality,
            phase="PRE_PAW" if measure_session else "UNKNOWN",
            source=body.source,
            observed_at=observed,
            received_at=current,
        )
        session.add(measurement)
        session.flush()
        measurement_ids.append(measurement.id)
    publish(session, farm_id, "telemetry.received", node_id=node.id)
    ack = {
        "accepted": True,
        "event_id": body.event_id,
        "position_id": position_id,
        "measurement_ids": measurement_ids,
        "received_at": iso(current),
    }
    session.add(
        m.IngestBatch(gateway_id=key_id, event_id=body.event_id, request_hash=request_hash, ack=ack)
    )
    session.flush()
    return ack


def measurement_json(row: m.Measurement):
    return {
        "id": row.id,
        "node_id": row.node_id,
        "sensor_id": row.sensor_id,
        "deployment_id": row.deployment_id,
        "plot_id": row.plot_id,
        "session_id": row.session_id,
        "metric": row.metric,
        "unit": row.unit,
        "depth_cm": row.depth_cm,
        "value": row.value,
        "quality": row.quality,
        "calibrated": row.calibrated,
        "measurement_phase": row.phase,
        "source": row.source,
        "observed_at": iso(row.observed_at),
        "received_at": iso(row.received_at),
    }


def deployment_json(row: m.Deployment):
    return {
        "id": row.id,
        "node_id": row.node_id,
        "plot_id": row.plot_id,
        "position_id": row.position_id,
        "started_at": iso(row.started_at),
        "stable_at": iso(row.stable_at),
        "ended_at": iso(row.ended_at),
        "confirmed_by": row.confirmed_by,
        "movement_detected_at": iso(row.movement_detected_at),
    }


def snapshot(session: Session, farm_id: str, settings: Settings, current: datetime):
    farm = lock_farm(session, farm_id)
    nodes = session.scalars(
        select(m.Node).where(m.Node.farm_id == farm_id).order_by(m.Node.id)
    ).all()
    plots = session.scalars(
        select(m.Plot).where(m.Plot.farm_id == farm_id).order_by(m.Plot.id)
    ).all()
    sensors = session.scalars(
        select(m.Sensor).join(m.Node).where(m.Node.farm_id == farm_id).order_by(m.Sensor.id)
    ).all()
    deployments = session.scalars(
        select(m.Deployment)
        .join(m.Node, m.Deployment.node_id == m.Node.id)
        .where(m.Node.farm_id == farm_id, m.Deployment.active_node_id.is_not(None))
    ).all()
    active = {d.node_id: d for d in deployments}
    # Window query: latest by sensor within ACTIVE placement, ordered by observed time,
    # never by arrival time; historical placements cannot contaminate a new marker.
    ranked = (
        select(
            m.Measurement.id,
            func.row_number()
            .over(
                partition_by=m.Measurement.sensor_id,
                order_by=(
                    m.Measurement.observed_at.desc(),
                    m.Measurement.received_at.desc(),
                    m.Measurement.id.desc(),
                ),
            )
            .label("rank"),
        )
        .join(m.Deployment, m.Measurement.deployment_id == m.Deployment.id)
        .where(m.Measurement.farm_id == farm_id, m.Deployment.active_node_id.is_not(None))
        .subquery()
    )
    latest = session.scalars(
        select(m.Measurement)
        .join(ranked, ranked.c.id == m.Measurement.id)
        .where(ranked.c.rank == 1)
    ).all()
    node_json, alerts, heat_points = [], [], []
    states = {}
    moving_nodes = set()
    for node in nodes:
        age = (current - utc(node.last_seen_at)).total_seconds() if node.last_seen_at else None
        connectivity = (
            "unknown"
            if age is None
            else "offline"
            if age > max(settings.offline_after_seconds, node.interval_seconds * 3)
            else "delayed"
            if age > node.interval_seconds * 2
            else "online"
        )
        deployment = active.get(node.id)
        placement = (
            "unplaced"
            if not deployment
            else "stabilizing"
            if current < utc(deployment.stable_at)
            else "placed"
        )
        position = session.get(m.Position, deployment.position_id) if deployment else None
        candidate = session.scalar(
            select(m.Position)
            .where(m.Position.node_id == node.id)
            .order_by(
                m.Position.observed_at.desc(), m.Position.received_at.desc(), m.Position.id.desc()
            )
            .limit(1)
        )
        if deployment and deployment.movement_detected_at:
            placement = "confirmation_required"
            moving_nodes.add(node.id)
            alerts.append(
                {
                    "id": f"{node.id}:movement_detected",
                    "kind": "movement_detected",
                    "node_id": node.id,
                    "plot_id": deployment.plot_id,
                }
            )
        states[node.id] = connectivity
        if connectivity != "online":
            alerts.append(
                {
                    "id": f"{node.id}:{connectivity}",
                    "kind": connectivity,
                    "node_id": node.id,
                    "plot_id": deployment.plot_id if deployment else None,
                }
            )
        node_json.append(
            {
                "id": node.id,
                "name": node.name,
                "connectivity": connectivity,
                "placement_state": placement,
                "last_seen_at": iso(node.last_seen_at),
                "expected_interval_seconds": node.interval_seconds,
                "candidate_position": {
                    "latitude": candidate.latitude,
                    "longitude": candidate.longitude,
                    "accuracy_m": candidate.accuracy_m,
                    "observed_at": iso(candidate.observed_at),
                }
                if candidate
                else None,
                "deployment": deployment_json(deployment) if deployment else None,
                "position": {
                    "latitude": position.latitude,
                    "longitude": position.longitude,
                    "accuracy_m": position.accuracy_m,
                    "observed_at": iso(position.observed_at),
                }
                if position
                else None,
            }
        )
    latest_json = []
    for row in latest:
        node = next(n for n in nodes if n.id == row.node_id)
        status = row.quality
        if states[row.node_id] == "offline":
            status = "offline"
        elif row.node_id in moving_nodes:
            status = "moving"
        elif (current - utc(row.observed_at)).total_seconds() > node.interval_seconds * 2:
            status = "stale"
        elif row.quality == "valid":
            low, high = farm.thresholds[row.metric]
            status = "warning" if row.value < low or row.value > high else "normal"
        item = {**measurement_json(row), "status": status}
        latest_json.append(item)
        if status not in ("normal",):
            alerts.append(
                {
                    "id": f"{row.sensor_id}:{status}",
                    "kind": status,
                    "node_id": row.node_id,
                    "plot_id": row.plot_id,
                    "sensor_id": row.sensor_id,
                    "measurement_id": row.id,
                }
            )
        deployment = active[row.node_id]
        if status in ("normal", "warning") and row.plot_id:
            position = require(session, m.Position, deployment.position_id)
            heat_points.append(
                {
                    **item,
                    "latitude": position.latitude,
                    "longitude": position.longitude,
                    "accuracy_m": position.accuracy_m,
                }
            )
    for sensor in sensors:
        if sensor.node_id in active and not any(row.sensor_id == sensor.id for row in latest):
            alerts.append(
                {
                    "id": f"{sensor.id}:missing",
                    "kind": "missing",
                    "node_id": sensor.node_id,
                    "plot_id": active[sensor.node_id].plot_id,
                    "sensor_id": sensor.id,
                }
            )
    cursor = session.scalar(select(func.max(m.Event.id)).where(m.Event.farm_id == farm_id)) or 0
    return {
        "schema_version": "1.0",
        "farm": {
            "id": farm.id,
            "name": farm.name,
            "source": farm.source,
            "coordinate_system": "geographic",
            "thresholds": farm.thresholds,
        },
        "reference_time": iso(current),
        "cursor": cursor,
        "plots": [{"id": p.id, "name": p.name, "geometry": p.geometry} for p in plots],
        "nodes": node_json,
        "sensors": [
            {
                "id": s.id,
                "node_id": s.node_id,
                "metric": s.metric,
                "unit": s.unit,
                "depth_cm": s.depth_cm,
                "calibrated": s.calibrated,
            }
            for s in sensors
        ],
        "latest": latest_json,
        "heat_points": heat_points,
        "alerts": alerts,
        "interpolation_notice": "Điểm đo GPS; nội suy không phải số đo thực tại mọi vị trí. Lọc riêng metric và depth_cm; không suy ra quyết định tưới.",
    }


def distance_m(a: m.Position, b: m.Position) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat, dlng = lat2 - lat1, math.radians(b.longitude - a.longitude)
    x = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(max(0, x))))


def status_fingerprint(data: dict) -> str:
    return json.dumps(
        {
            "nodes": [(n["id"], n["connectivity"], n["placement_state"]) for n in data["nodes"]],
            "latest": [(x["id"], x["status"]) for x in data["latest"]],
            "alerts": data["alerts"],
        },
        sort_keys=True,
    )


def reconcile_alerts(session: Session, farm_id: str, data: dict, current: datetime):
    existing = {
        row.active_key: row
        for row in session.scalars(
            select(m.Alert).where(m.Alert.farm_id == farm_id, m.Alert.active_key.is_not(None))
        )
    }
    seen = set()
    changed = False
    for item in data["alerts"]:
        key = hashlib.sha256(f"{farm_id}:{item['id']}".encode()).hexdigest()
        seen.add(key)
        if key in existing:
            existing[key].payload = item
        else:
            session.add(
                m.Alert(
                    farm_id=farm_id,
                    active_key=key,
                    kind=item["kind"],
                    payload=item,
                    opened_at=current,
                )
            )
            changed = True
    for key, row in existing.items():
        if key not in seen:
            row.active_key, row.resolved_at = None, current
            changed = True
    return changed


def flush_alerts(session: Session, settings: Settings, current: datetime):
    for farm_id in sorted(session.info.pop("changed_farms", set())):
        reconcile_alerts(session, farm_id, snapshot(session, farm_id, settings, current), current)
    session.flush()
