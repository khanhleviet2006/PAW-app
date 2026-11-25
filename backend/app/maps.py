"""Authenticated offline Leafmap document and bounded interpolation reads."""

import json
from functools import lru_cache
from pathlib import Path
from threading import BoundedSemaphore

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from . import models as m
from .auth import Principal, authenticate
from .db import iso, utc
from .schemas import UNITS, Metric
from .spatial import Policy, raster

router = APIRouter(prefix="/v1/farms/{farm_id}")
compute_slots = BoundedSemaphore(2)
assets = Path(__file__).with_name("map_assets")


@lru_cache(maxsize=1)
def document():
    from leafmap.foliumap import Map

    view = Map(tiles=None, fullscreen_control=False, layers_control=False, prefer_canvas=False)
    # Only use Folium's generated map initialization. Its default document head uses CDNs.
    root = view.get_root()
    root.render()
    return f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/map-assets/leaflet.css">
    <style>html,body,.folium-map{{margin:0;height:100%;width:100%}}</style>
    <script src="/map-assets/leaflet.js"></script></head><body>{root.html.render()}
    <script>{root.script.render()}</script><script src="/map-assets/bridge.js"></script>
    <script>connectField({view.get_name()})</script></body></html>"""


@router.get("/leafmap", response_class=HTMLResponse)
def field(farm_id: str, actor: Principal = Depends(authenticate)):
    actor.require(farm_id, "viewer", "operator")
    return document()


@router.get("/surface")
def surface(
    farm_id: str,
    metric: Metric,
    request: Request,
    session_id: str,
    depth: float | None = Query(None, ge=0, le=300),
    actor: Principal = Depends(authenticate),
):
    actor.require(farm_id, "viewer", "operator")
    cfg = request.app.state.settings
    with request.app.state.sessions() as db:
        run = db.get(m.MeasurementSession, session_id)
        if (
            not run
            or run.farm_id != farm_id
            or (utc(run.ended_at) - utc(run.started_at)).total_seconds()
            > cfg.surface_window_seconds
        ):
            return {"notice": "Phiên đo không đủ điều kiện so sánh theo thời gian."}
        plot = db.get(m.Plot, run.plot_id)
        q = (
            select(
                m.Position.longitude,
                m.Position.latitude,
                m.Measurement.value,
                m.Position.accuracy_m,
                m.Measurement.observed_at,
            )
            .select_from(m.Measurement)
            .join(m.Deployment, m.Measurement.deployment_id == m.Deployment.id)
            .join(m.Position, m.Deployment.position_id == m.Position.id)
            .where(
                m.Measurement.farm_id == farm_id,
                m.Measurement.plot_id == run.plot_id,
                m.Measurement.session_id == session_id,
                m.Measurement.metric == metric,
                m.Measurement.depth_cm == depth,
                m.Measurement.source == "sensor",
                m.Measurement.unit == UNITS[metric],
                m.Measurement.quality == "valid",
                m.Measurement.calibrated.is_(True),
                m.Measurement.value.is_not(None),
                m.Measurement.phase == "PRE_PAW",
                m.Position.accuracy_m <= cfg.gps_max_accuracy_m,
                m.Measurement.observed_at >= run.started_at,
                m.Measurement.observed_at < run.ended_at,
            )
            .limit(2001)
        )
        rows = db.execute(q).all()
        samples = tuple(sorted(tuple(row[:4]) for row in rows))
        geometry = json.dumps(plot.geometry, sort_keys=True)
        latest = max((row.observed_at for row in rows), default=None)
    if len(samples) > 2000:
        return {"notice": "Phiên vượt giới hạn xử lý trực tuyến."}
    policy = Policy(
        power=cfg.idw_power,
        radius=cfg.surface_radius_m,
        min_sites=cfg.surface_min_sites,
        kriging_sites=cfg.kriging_sites,
        neighbors=cfg.surface_neighbors,
        cv_sites=cfg.surface_cv_sites,
    )
    if not compute_slots.acquire(blocking=False):
        raise HTTPException(503, "Bộ xử lý nội suy đang bận.", headers={"Retry-After": "2"})
    try:
        layer = raster((farm_id, session_id, metric, depth), geometry, samples, policy)
    finally:
        compute_slots.release()
    return {
        **layer,
        "unit": UNITS[metric],
        "time": iso(latest),
    }
