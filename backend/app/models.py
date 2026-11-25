from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, now, uid


class Farm(Base):
    __tablename__ = "farms"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20))  # simulation or sensor; immutable
    thresholds: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (CheckConstraint("source IN ('simulation','sensor')"),)


class Plot(Base):
    __tablename__ = "plots"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    geometry: Mapped[dict] = mapped_column(JSON)


class Node(Base):
    __tablename__ = "nodes"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    interval_seconds: Mapped[int] = mapped_column(Integer, default=600)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Sensor(Base):
    __tablename__ = "sensors"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), index=True)
    metric: Mapped[str] = mapped_column(String(40))
    unit: Mapped[str] = mapped_column(String(12))
    depth_cm: Mapped[float | None] = mapped_column(Float)
    calibrated: Mapped[bool] = mapped_column(default=False)
    __table_args__ = (CheckConstraint("depth_cm IS NULL OR depth_cm >= 0"),)


class Position(Base):
    __tablename__ = "node_positions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy_m: Mapped[float] = mapped_column(Float)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        CheckConstraint(
            "latitude BETWEEN -85 AND 85 AND longitude BETWEEN -180 AND 180 AND accuracy_m > 0"
        ),
    )


class Deployment(Base):
    __tablename__ = "node_deployments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), index=True)
    active_node_id: Mapped[str | None] = mapped_column(ForeignKey("nodes.id"), unique=True)
    plot_id: Mapped[str | None] = mapped_column(ForeignKey("plots.id"), index=True)
    position_id: Mapped[str] = mapped_column(ForeignKey("node_positions.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    stable_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirmed_by: Mapped[str] = mapped_column(String(80))
    movement_detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint(
            "(active_node_id IS NOT NULL AND active_node_id = node_id AND ended_at IS NULL) OR (active_node_id IS NULL AND ended_at IS NOT NULL)"
        ),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at"),
    )


class MeasurementSession(Base):
    __tablename__ = "measurement_sessions"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"), index=True)
    plot_id: Mapped[str] = mapped_column(ForeignKey("plots.id"))
    irrigation_event_id: Mapped[str | None] = mapped_column(String(80))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    __table_args__ = (CheckConstraint("ended_at > started_at"),)


class Measurement(Base):
    __tablename__ = "measurements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"), index=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), index=True)
    sensor_id: Mapped[str] = mapped_column(ForeignKey("sensors.id"))
    deployment_id: Mapped[str | None] = mapped_column(ForeignKey("node_deployments.id"))
    plot_id: Mapped[str | None] = mapped_column(ForeignKey("plots.id"))
    session_id: Mapped[str | None] = mapped_column(ForeignKey("measurement_sessions.id"))
    metric: Mapped[str] = mapped_column(String(40))
    unit: Mapped[str] = mapped_column(String(12))
    depth_cm: Mapped[float | None] = mapped_column(Float)
    value: Mapped[float] = mapped_column(Float)
    calibrated: Mapped[bool] = mapped_column()
    quality: Mapped[str] = mapped_column(String(30))
    phase: Mapped[str] = mapped_column(String(12), default="UNKNOWN")
    source: Mapped[str] = mapped_column(String(20))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        Index("ix_measurement_plot_time", "plot_id", "metric", "depth_cm", "observed_at", "id"),
    )


class ApiKey(Base):
    __tablename__ = "api_keys"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    role: Mapped[str] = mapped_column(String(20))
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"))
    active: Mapped[bool] = mapped_column(default=True)
    __table_args__ = (CheckConstraint("role IN ('viewer','operator','gateway')"),)


class IngestBatch(Base):
    __tablename__ = "ingest_batches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    gateway_id: Mapped[str] = mapped_column(ForeignKey("api_keys.id"))
    event_id: Mapped[str] = mapped_column(String(80))
    request_hash: Mapped[str] = mapped_column(String(64))
    ack: Mapped[dict] = mapped_column(JSON)
    __table_args__ = (UniqueConstraint("gateway_id", "event_id"),)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    farm_id: Mapped[str] = mapped_column(ForeignKey("farms.id"), index=True)
    active_key: Mapped[str | None] = mapped_column(String(64), unique=True)
    kind: Mapped[str] = mapped_column(String(30))
    payload: Mapped[dict] = mapped_column(JSON)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    acknowledged_by: Mapped[str | None] = mapped_column(String(80))
