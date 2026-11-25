"""Versioned read contract; generated OpenAPI is checked into docs/openapi.json."""

from typing import Literal

from pydantic import AwareDatetime

from .schemas import Metric, Payload, Polygon


class DeploymentOut(Payload):
    id: str
    node_id: str
    plot_id: str | None
    position_id: str
    started_at: AwareDatetime
    stable_at: AwareDatetime
    ended_at: AwareDatetime | None
    confirmed_by: str
    movement_detected_at: AwareDatetime | None


class PositionOut(Payload):
    latitude: float
    longitude: float
    accuracy_m: float
    observed_at: AwareDatetime


class MeasurementOut(Payload):
    id: str
    node_id: str
    sensor_id: str
    deployment_id: str | None
    plot_id: str | None
    session_id: str | None
    metric: Metric
    unit: Literal["°C", "%RH", "%", "pH", "raw"]
    depth_cm: float | None
    value: float
    quality: Literal["valid", "moving", "stabilizing", "uncalibrated", "invalid"]
    calibrated: bool
    measurement_phase: Literal["PRE_PAW", "UNKNOWN"]
    source: Literal["simulation", "sensor"]
    observed_at: AwareDatetime
    received_at: AwareDatetime


class LatestOut(MeasurementOut):
    status: Literal[
        "normal", "warning", "offline", "stale", "moving", "stabilizing", "uncalibrated", "invalid"
    ]


class HeatPointOut(LatestOut):
    latitude: float
    longitude: float
    accuracy_m: float


class FarmOut(Payload):
    id: str
    name: str
    source: Literal["simulation", "sensor"]
    coordinate_system: Literal["geographic"]
    thresholds: dict[str, list[float]]


class PlotOut(Payload):
    id: str
    name: str
    geometry: Polygon


class NodeOut(Payload):
    id: str
    name: str
    connectivity: Literal["unknown", "offline", "delayed", "online"]
    placement_state: Literal["unplaced", "stabilizing", "placed", "confirmation_required"]
    last_seen_at: AwareDatetime | None
    expected_interval_seconds: int
    deployment: DeploymentOut | None
    position: PositionOut | None
    candidate_position: PositionOut | None


class SensorOut(Payload):
    id: str
    node_id: str
    metric: Metric
    unit: Literal["°C", "%RH", "%", "pH", "raw"]
    depth_cm: float | None
    calibrated: bool


class AlertOut(Payload):
    id: str
    kind: str
    node_id: str
    plot_id: str | None
    sensor_id: str | None = None
    measurement_id: str | None = None


class SnapshotOut(Payload):
    schema_version: Literal["1.0"]
    farm: FarmOut
    reference_time: AwareDatetime
    cursor: int
    plots: list[PlotOut]
    nodes: list[NodeOut]
    sensors: list[SensorOut]
    latest: list[LatestOut]
    heat_points: list[HeatPointOut]
    alerts: list[AlertOut]
    interpolation_notice: str


class HistoryOut(Payload):
    items: list[MeasurementOut]
    next_cursor: str | None


class AckOut(Payload):
    accepted: Literal[True]
    event_id: str
    position_id: str | None
    measurement_ids: list[str]
    received_at: AwareDatetime
