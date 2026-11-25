from ipaddress import ip_network
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="PAW_", env_file=".env", extra="ignore")
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
    database_url: str = "sqlite:///./paw.db"
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
