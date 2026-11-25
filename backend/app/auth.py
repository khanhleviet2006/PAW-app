import hashlib
import secrets
from dataclasses import dataclass
from ipaddress import ip_address, ip_network

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select

from .models import ApiKey

bearer = HTTPBearer(auto_error=False)


def deployment_viewer(request: Request) -> "Principal | None":
    """Explicit deployment-only read grant. Never trust X-Forwarded-For/Host."""
    settings = request.app.state.settings
    if not settings.viewer_farm_id or not request.client:
        return None
    origin = str(request.base_url).rstrip("/")
    if origin not in settings.viewer_origins:
        return None
    if request.headers.get("origin", origin) not in settings.viewer_origins:
        return None
    try:
        address = ip_address(request.client.host)
    except ValueError:
        return None
    if not any(address in ip_network(net) for net in settings.viewer_networks):
        return None
    if request.method != "GET":
        return None
    return Principal("deployment-viewer", "viewer", settings.viewer_farm_id)


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass(frozen=True)
class Principal:
    id: str
    role: str
    farm_id: str | None

    def require(self, farm_id: str, *roles: str):
        if self.role == "admin":
            return
        if self.farm_id != farm_id or self.role not in roles:
            raise HTTPException(403, "Không có quyền cho trang trại hoặc thao tác này")


def authenticate(
    request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(bearer)
):
    if not credentials:
        if request.headers.get("authorization"):
            raise HTTPException(401, "Thông tin xác thực không hợp lệ")
        viewer = deployment_viewer(request)
        if viewer:
            return viewer
        raise HTTPException(401, "Cần Bearer token", headers={"WWW-Authenticate": "Bearer"})
    token = credentials.credentials
    if secrets.compare_digest(token, request.app.state.settings.admin_token.get_secret_value()):
        return Principal("admin", "admin", None)
    with request.app.state.sessions() as session:
        key = session.scalar(
            select(ApiKey).where(ApiKey.token_hash == digest(token), ApiKey.active.is_(True))
        )
        if key:
            return Principal(key.id, key.role, key.farm_id)
    raise HTTPException(
        401, "Token không hợp lệ hoặc đã thu hồi", headers={"WWW-Authenticate": "Bearer"}
    )
