from datetime import datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, FiniteFloat, model_validator
from shapely.geometry import shape

Id = Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$")]
Metric = Literal["air_temperature", "air_humidity", "soil_moisture", "soil_ph"]
UNITS = {"air_temperature": "°C", "air_humidity": "%RH", "soil_moisture": "%", "soil_ph": "pH"}
BOUNDS = {
    "air_temperature": (-50, 80),
    "air_humidity": (0, 100),
    "soil_moisture": (0, 100),
    "soil_ph": (0, 14),
}
DEFAULT_THRESHOLDS = {
    "air_temperature": [18, 32],
    "air_humidity": [45, 90],
    "soil_moisture": [20, 60],
    "soil_ph": [5.5, 7.5],
}


class Payload(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class FarmCreate(Payload):
    id: Id
    name: str = Field(min_length=1, max_length=200)
    source: Literal["simulation", "sensor"]


class Polygon(Payload):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[FiniteFloat]]]

    @model_validator(mode="after")
    def valid(self):
        if not self.coordinates or len(self.coordinates) > 32:
            raise ValueError("Polygon cần 1–32 rings")
        if sum(map(len, self.coordinates)) > 2000:
            raise ValueError("Polygon tối đa 2000 đỉnh")
        for ring in self.coordinates:
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError("GeoJSON ring phải đóng và có ít nhất 4 điểm")
            for point in ring:
                if len(point) != 2 or not -180 <= point[0] <= 180 or not -85 <= point[1] <= 85:
                    raise ValueError("Tọa độ phải là [longitude, latitude] hợp lệ")
        polygon = shape(self.model_dump())
        if not polygon.is_valid or polygon.area <= 0 or polygon.bounds[2] - polygon.bounds[0] > 180:
            raise ValueError("Polygon tự cắt, suy biến hoặc vượt kinh tuyến đổi ngày")
        return self


class PlotCreate(Payload):
    id: Id
    name: str = Field(min_length=1, max_length=200)
    geometry: Polygon


class NodeCreate(Payload):
    id: Id
    name: str = Field(min_length=1, max_length=200)
    interval_seconds: int = Field(default=600, ge=10, le=86400)


class SensorCreate(Payload):
    id: Id
    metric: Metric
    depth_cm: FiniteFloat | None = Field(default=None, ge=0, le=300)
    calibrated: bool = False
    unit: Literal["°C", "%RH", "%", "pH", "raw"] | None = None

    @model_validator(mode="after")
    def depth(self):
        if self.unit == "raw" and self.calibrated:
            raise ValueError("Giá trị raw chưa được coi là đã hiệu chuẩn")
        if self.unit not in (None, "raw", UNITS[self.metric]):
            raise ValueError("Đơn vị không phù hợp chỉ tiêu")
        if self.metric.startswith("soil_") and self.depth_cm is None:
            raise ValueError("Đầu dò đất phải khai báo độ sâu")
        if self.metric.startswith("air_") and self.depth_cm is not None:
            raise ValueError("Cảm biến không khí không có độ sâu đất")
        return self


class PositionInput(Payload):
    latitude: FiniteFloat = Field(ge=-85, le=85)
    longitude: FiniteFloat = Field(ge=-180, le=180)
    accuracy_m: FiniteFloat = Field(gt=0, le=100000)
    observed_at: AwareDatetime


class ReadingInput(Payload):
    sensor_id: Id
    value: FiniteFloat
    observed_at: AwareDatetime
    deployment_id: Id | None = None
    session_id: Id | None = None


class IngestInput(Payload):
    event_id: Id
    node_id: Id
    node_observed_at: AwareDatetime
    source: Literal["simulation", "sensor"]
    position: PositionInput | None = None
    readings: list[ReadingInput] = Field(default_factory=list, max_length=128)


class DeploymentStart(Payload):
    position_id: Id
    plot_id: Id | None = None


class SessionCreate(Payload):
    id: Id
    plot_id: Id
    started_at: AwareDatetime
    ended_at: AwareDatetime
    irrigation_event_id: Id | None = None

    @model_validator(mode="after")
    def ordered(self):
        if self.ended_at <= self.started_at:
            raise ValueError("Thời gian kết thúc phải sau bắt đầu")
        return self


class KeyCreate(Payload):
    role: Literal["viewer", "operator", "gateway"]


class ThresholdUpdate(Payload):
    air_temperature: tuple[FiniteFloat, FiniteFloat]
    air_humidity: tuple[FiniteFloat, FiniteFloat]
    soil_moisture: tuple[FiniteFloat, FiniteFloat]
    soil_ph: tuple[FiniteFloat, FiniteFloat]

    @model_validator(mode="after")
    def ordered(self):
        for metric, limits in self.model_dump().items():
            low, high = BOUNDS[metric]
            if not low <= limits[0] < limits[1] <= high:
                raise ValueError(f"Ngưỡng {metric} nằm ngoài giới hạn hoặc sai thứ tự")
        return self


def timestamp(value: datetime) -> str:
    return value.isoformat()
