from ipaddress import ip_network
from pathlib import Path

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PAW_", env_file=".env", extra="ignore", hide_input_in_errors=True
    )
    active_imagery_ids: dict[str, str] = {}
    viewer_farm_id: str | None = None
    viewer_networks: list[str] = []
    viewer_origins: list[str] = []

    @field_validator("viewer_networks")
    @classmethod
    def valid_networks(cls, values: list[str]) -> list[str]:
        for value in values:
            ip_network(value, strict=True)
        return values

    imagery_dir: Path = Path("data/imagery")
    frontend_dist: Path | None = None
    database_url: str = Field(repr=False)
    db_password: SecretStr | None = None

    @model_validator(mode="after")
    def resolve_driver(self):
        url = make_url(self.database_url)
        if url.drivername == "postgresql":
            url = url.set(drivername="postgresql+psycopg")
        if url.get_backend_name() == "postgresql" and self.db_password is not None:
            url = url.set(password=self.db_password.get_secret_value())
        self.database_url = url.render_as_string(hide_password=False)
        return self

    db_pool_size: int = Field(4, ge=1, le=64)
    db_max_overflow: int = Field(2, ge=0, le=32)
    db_pool_timeout: int = Field(8, ge=1, le=60)
    db_pool_recycle: int = Field(1800, ge=60)
    db_connect_timeout: int = Field(5, ge=2, le=60)
    admin_token: SecretStr
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    gps_max_accuracy_m: float = Field(default=25, gt=0, le=1000)
    movement_threshold_m: float = Field(default=15, gt=0)
    gps_max_age_seconds: int = Field(default=300, gt=0)
    stabilization_seconds: int = Field(default=120, ge=0)
    offline_after_seconds: int = Field(default=1800, gt=0)
    sse_poll_seconds: float = Field(default=1, ge=0.05, le=30)

    @field_validator("admin_token")
    @classmethod
    def valid_token(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("PAW_ADMIN_TOKEN phải có ít nhất 32 ký tự ngẫu nhiên")
        return value

    idw_power: float = Field(2, gt=0, le=8)
    surface_radius_m: float = Field(200, gt=0, le=10000)
    surface_window_seconds: int = Field(1800, ge=60, le=86400)
    surface_min_sites: int = Field(3, ge=3, le=128)
    surface_neighbors: int = Field(12, ge=1, le=128)
    surface_cv_sites: int = Field(8, ge=3, le=128)
    kriging_sites: int = Field(20, ge=12, le=128)
