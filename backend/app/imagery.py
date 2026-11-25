"""Local, licensed raster MBTiles. No proxy to Internet tile providers."""

import html
import json
import re
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .auth import Principal, authenticate

router = APIRouter(prefix="/v1/farms/{farm_id}/imagery", tags=["Offline imagery"])
IDENTIFIER = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$")


def dataset(root: Path, identifier: str):
    if not IDENTIFIER.fullmatch(identifier):
        raise HTTPException(404, "Không tìm thấy bộ ảnh")
    path = (root / f"{identifier}.mbtiles").resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise HTTPException(404, "Chưa cài bộ ảnh offline")
    return path


def metadata(path: Path):
    try:
        with sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True) as connection:
            record = dict(connection.execute("SELECT name,value FROM metadata"))
        result = json.loads(record["paw"])
        if not result.get("offline_rights_confirmed"):
            raise ValueError("Missing license acknowledgement")
        return result
    except (sqlite3.Error, ValueError, KeyError):
        raise HTTPException(422, "Bộ ảnh hoặc thông tin giấy phép không hợp lệ") from None


@router.get("")
def catalog(farm_id: str, request: Request, actor: Principal = Depends(authenticate)):
    actor.require(farm_id, "viewer", "operator")
    root = request.app.state.settings.imagery_dir
    items = []
    if root.is_dir():
        for path in sorted(root.glob("*.mbtiles")):
            if not IDENTIFIER.fullmatch(path.stem):
                continue
            path = dataset(root, path.stem)
            record = metadata(path)
            if record["farm_id"] == farm_id:
                items.append(
                    {
                        **record,
                        "id": path.stem,
                        "attribution": html.escape(record["attribution"]),
                        "tiles": [f"/v1/farms/{farm_id}/imagery/{path.stem}/{{z}}/{{x}}/{{y}}.png"],
                    }
                )
    return {
        "items": items,
        "notice": "Chỉ ảnh được nhập trên máy chủ PAW; không tải từ Internet khi vận hành.",
    }


@router.get("/active")
def active_imagery(farm_id: str, request: Request, actor: Principal = Depends(authenticate)):
    """An administrator selects the single basemap in server configuration, not the viewer UI."""
    actor.require(farm_id, "viewer", "operator")
    configured = request.app.state.settings.active_imagery_ids.get(farm_id)
    notice = "Chưa cài đặt dữ liệu ảnh vệ tinh khu vực"
    if configured:
        try:
            path = dataset(request.app.state.settings.imagery_dir, configured)
            record = metadata(path)
        except HTTPException as error:
            if error.status_code not in (404, 422):
                raise
            return {"item": None, "notice": notice}
        if record["farm_id"] != farm_id:
            return {"item": None, "notice": notice}
        return {
            "item": {**record, "id": configured, "attribution": html.escape(record["attribution"])},
            "notice": "",
        }
    items = catalog(farm_id, request, actor)["items"]
    # A single installed dataset needs no extra setting. Ambiguous catalogs never
    # silently switch backgrounds; an admin must select the intended dataset.
    return {
        "item": items[0] if len(items) == 1 else None,
        "notice": "" if len(items) == 1 else notice,
    }


@router.get("/{identifier}/{z}/{x}/{y}.png")
def tile(
    farm_id: str,
    identifier: str,
    z: int,
    x: int,
    y: int,
    request: Request,
    actor: Principal = Depends(authenticate),
):
    actor.require(farm_id, "viewer", "operator")
    path = dataset(request.app.state.settings.imagery_dir, identifier)
    record = metadata(path)
    if record["farm_id"] != farm_id:
        raise HTTPException(403, "Ảnh không thuộc trang trại")
    if not record["minzoom"] <= z <= record["maxzoom"] or not (0 <= x < 2**z and 0 <= y < 2**z):
        raise HTTPException(404, "Tile ngoài phạm vi bộ ảnh")
    with sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True) as connection:
        row = connection.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
            (z, x, 2**z - 1 - y),
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Tile chưa có trong bộ ảnh")
    return Response(
        bytes(row[0]),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=86400", "Vary": "Authorization"},
    )
