"""Read-only GPS measurement history. Existing measurements/deployments remain unchanged."""

from sqlalchemy import select

from . import models as m
from .db import iso
from .services import measurement_json


def point_collection(
    session, farm_id: str, limit: int = 1000, after: str | None = None, recent: bool = False
):
    query = (
        select(m.Measurement, m.Position)
        .join(m.Deployment, m.Measurement.deployment_id == m.Deployment.id)
        .join(m.Position, m.Deployment.position_id == m.Position.id)
        .where(m.Measurement.farm_id == farm_id, m.Measurement.source == "sensor")
    )
    if after:
        # Measurement UUID is a stable paging key, independent of device timestamps.
        query = query.where(m.Measurement.id > after)
    ordering = (
        (m.Measurement.received_at.desc(), m.Measurement.id.desc())
        if recent
        else (m.Measurement.id,)
    )
    rows = session.execute(query.order_by(*ordering).limit(limit + 1)).all()
    more = len(rows) > limit
    rows = rows[:limit]
    features = [
        {
            "type": "Feature",
            "id": row.id,
            "geometry": {"type": "Point", "coordinates": [pos.longitude, pos.latitude]},
            "properties": {
                **measurement_json(row),
                "accuracy_m": pos.accuracy_m,
                "gps_observed_at": iso(pos.observed_at),
            },
        }
        for row, pos in rows
    ]
    return {
        "type": "FeatureCollection",
        "features": features,
        "next_cursor": rows[-1][0].id if more and not recent else None,
        "truncated": more,
    }


def field_payload(session, data):
    # SSE supplies updates without one frontend REST request per sensor packet.
    # Bounded bootstrap is explicit; full history is available via paginated read API.
    points = point_collection(session, data["farm"]["id"], 10000, recent=True)
    return {**data, "map_points": points}
