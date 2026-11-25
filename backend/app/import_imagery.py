"""Import a licensed, georeferenced GeoTIFF into a self-contained raster MBTiles."""

import argparse
import json
import sqlite3
import tempfile
from pathlib import Path

from .imagery import IDENTIFIER


def import_geotiff(
    source: Path,
    output: Path,
    record: dict,
    bands: list[int],
    value_range: tuple[float, float] | None = None,
    max_tiles: int = 20000,
):
    # Optional dependencies are needed only during one-time import, not tile serving.
    import mercantile
    import numpy as np
    import rasterio
    from PIL import Image
    from rasterio.enums import ColorInterp, Resampling
    from rasterio.transform import from_bounds
    from rasterio.warp import reproject, transform_bounds

    if output.exists():
        raise ValueError("Bộ ảnh đã có; dùng ID phiên bản mới, không ghi đè ảnh đang phục vụ")
    if not record.get("offline_rights_confirmed") or not all(
        record.get(k) for k in ("license", "license_url", "attribution", "farm_id")
    ):
        raise ValueError("Cần thông tin giấy phép và xác nhận quyền lưu/phục vụ offline")
    if not source.is_file():
        raise ValueError("Cần file GeoTIFF cục bộ đã tải và được cấp phép")
    with rasterio.open(source) as src:
        if (
            not src.crs
            or not bands
            or len(bands) not in (1, 3)
            or any(i < 1 or i > src.count for i in bands)
        ):
            raise ValueError("Cần GeoTIFF có CRS và 1 hoặc 3 band ảnh phù hợp")
        if any(src.dtypes[i - 1] != "uint8" for i in bands) and value_range is None:
            raise ValueError("Ảnh không phải uint8 cần --value-range MIN MAX theo metadata nguồn")
        bounds = transform_bounds(src.crs, "EPSG:4326", *src.bounds, densify_pts=21)
        if not (-180 <= bounds[0] < bounds[2] <= 180 and -85 <= bounds[1] < bounds[3] <= 85):
            raise ValueError("Phạm vi GeoTIFF không phù hợp Web Mercator")
        tiles = []
        for tile in mercantile.tiles(
            *bounds, zooms=range(record["minzoom"], record["maxzoom"] + 1)
        ):
            tiles.append(tile)
            if len(tiles) > max_tiles:
                raise ValueError("Vượt --max-tiles; giảm phạm vi/zoom trước khi nhập")
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = tempfile.NamedTemporaryFile(
            dir=output.parent, suffix=".importing", delete=False
        )
        temporary.close()
        temp = Path(temporary.name)
        try:
            with sqlite3.connect(temp) as db:
                db.executescript(
                    "CREATE TABLE metadata(name TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE tiles(zoom_level INTEGER,tile_column INTEGER,tile_row INTEGER,tile_data BLOB,PRIMARY KEY(zoom_level,tile_column,tile_row));"
                )
                for tile in tiles:
                    extent = mercantile.xy_bounds(tile)
                    transform = from_bounds(
                        extent.left, extent.bottom, extent.right, extent.top, 256, 256
                    )
                    channels = []
                    for band in bands:
                        dest = np.full((256, 256), np.nan, dtype="float32")
                        reproject(
                            rasterio.band(src, band),
                            dest,
                            src_transform=src.transform,
                            src_crs=src.crs,
                            src_nodata=src.nodata,
                            src_alpha=src.count if src.colorinterp[-1] == ColorInterp.alpha else 0,
                            dst_transform=transform,
                            dst_crs="EPSG:3857",
                            dst_nodata=np.nan,
                            resampling=Resampling.bilinear,
                        )
                        channels.append(dest)
                    mask = np.all(np.isfinite(channels), axis=0)
                    low, high = value_range or (0, 255)
                    rgb = [
                        np.clip(
                            (np.nan_to_num(c, nan=low) - low) * 255 / (high - low), 0, 255
                        ).astype("uint8")
                        for c in channels
                    ]
                    if len(rgb) == 1:
                        rgb = rgb * 3
                    rgba = np.dstack([*rgb, mask.astype("uint8") * 255])
                    from io import BytesIO

                    image = BytesIO()
                    Image.fromarray(rgba).save(image, format="PNG")
                    db.execute(
                        "INSERT INTO tiles VALUES(?,?,?,?)",
                        (tile.z, tile.x, 2**tile.z - 1 - tile.y, image.getvalue()),
                    )
                record = {
                    **record,
                    "bounds": list(bounds),
                    "tile_count": len(tiles),
                    "format": "png",
                    "scheme": "xyz",
                }
                db.executemany(
                    "INSERT INTO metadata VALUES(?,?)",
                    [
                        ("name", record["id"]),
                        ("format", "png"),
                        ("paw", json.dumps(record, ensure_ascii=False)),
                    ],
                )
            # Same-filesystem atomic publication; serving never sees partial imports.
            # Operator must use a single importer per dataset ID.
            if output.exists():
                raise ValueError("Dataset vừa được tạo bởi tiến trình khác")
            temp.rename(output)
            return record
        finally:
            temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--id", required=True)
    parser.add_argument("--farm-id", required=True)
    parser.add_argument("--license", required=True)
    parser.add_argument("--license-url", required=True)
    parser.add_argument("--attribution", required=True)
    parser.add_argument("--offline-rights-confirmed", action="store_true", required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data/imagery"))
    parser.add_argument("--bands", type=int, nargs="+", default=[1, 2, 3])
    parser.add_argument("--value-range", type=float, nargs=2)
    parser.add_argument("--min-zoom", type=int, default=12)
    parser.add_argument("--max-zoom", type=int, default=18)
    parser.add_argument("--max-tiles", type=int, default=20000)
    args = parser.parse_args()
    if not IDENTIFIER.fullmatch(args.id) or not 0 <= args.min_zoom <= args.max_zoom <= 22:
        parser.error("ID hoặc zoom không hợp lệ")
    if args.value_range and args.value_range[0] >= args.value_range[1]:
        parser.error("value-range cần MIN < MAX")
    try:
        result = import_geotiff(
            args.source,
            args.output_dir / f"{args.id}.mbtiles",
            {
                "id": args.id,
                "farm_id": args.farm_id,
                "license": args.license,
                "license_url": args.license_url,
                "attribution": args.attribution,
                "offline_rights_confirmed": True,
                "minzoom": args.min_zoom,
                "maxzoom": args.max_zoom,
            },
            args.bands,
            tuple(args.value_range) if args.value_range else None,
            args.max_tiles,
        )
        print(json.dumps(result, ensure_ascii=False))
    except (ValueError, ImportError, OSError) as error:
        parser.exit(1, f"Lỗi nhập ảnh: {error}\n")


if __name__ == "__main__":
    main()
