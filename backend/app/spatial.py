"""Local interpolation for a single curated plot/session/metric/depth slice."""

import base64
import io
from dataclasses import dataclass
from functools import lru_cache
from time import perf_counter

import numpy as np
from PIL import Image
from pyproj import Transformer
from scipy.optimize import lsq_linear
from scipy.spatial.distance import cdist, pdist
from shapely import intersects_xy
from shapely.geometry import MultiPoint, shape
from shapely.ops import transform


@dataclass(frozen=True)
class Policy:
    power: float = 2
    neighbors: int = 12
    radius: float = 200
    min_sites: int = 3
    cv_sites: int = 8
    kriging_sites: int = 20


def idw(x, y, targets, policy, power):
    d = cdist(targets, x)
    idx = np.argsort(d, axis=1)[:, : policy.neighbors]
    dist = np.take_along_axis(d, idx, axis=1)
    weights = np.where(dist <= policy.radius, np.maximum(dist, 1e-8) ** -power, 0)
    total = weights.sum(axis=1)
    out = np.divide(
        (weights * y[idx]).sum(axis=1), total, out=np.full(len(total), np.nan), where=total > 0
    )
    return np.where(dist[:, 0] < 1e-8, y[idx[:, 0]], out)


def structure(h, family, scale):
    r = h / scale
    if family == "spherical":
        return np.where(r < 1, 1.5 * r - 0.5 * r**3, 1.0)
    return 1 - np.exp(-3 * (r if family == "exponential" else r * r))


def kriging(x, y, targets, family):
    """Binned method-of-moments variogram, nonnegative nugget and partial sill."""
    d, g = pdist(x), 0.5 * pdist(y[:, None], "sqeuclidean")
    groups = np.array_split(np.argsort(d), min(12, len(d) // 5))
    h = np.array([d[i].mean() for i in groups])
    gamma = np.array([g[i].mean() for i in groups])
    if len(h) < 4 or gamma.var() < 1e-12:
        raise ValueError("variogram has insufficient structure")
    fits = []
    for scale in np.linspace(np.quantile(h, 0.2), h.max(), 8):
        a = np.column_stack((np.ones(len(h)), structure(h, family, scale)))
        nugget, sill = lsq_linear(a, gamma, bounds=(0, np.inf)).x
        fits.append((np.mean((a @ [nugget, sill] - gamma) ** 2), scale, nugget, sill))
    loss, scale, nugget, sill = min(fits)
    if loss >= gamma.var() * 0.9 or sill < 1e-8:
        raise ValueError("poor variogram fit")

    def variogram(dist):
        return np.where(dist < 1e-8, 0, nugget + sill * structure(dist, family, scale))

    n = len(x)
    system = np.ones((n + 1, n + 1))
    system[:n, :n] = variogram(cdist(x, x))
    system[-1, -1] = 0
    if np.linalg.cond(system) > 1e10:
        raise ValueError("ill-conditioned kriging system")
    rhs = np.vstack((variogram(cdist(x, targets)), np.ones(len(targets))))
    weights = np.linalg.solve(system, rhs)
    variance = (weights * rhs).sum(axis=0)
    if variance.min() < -1e-6:
        raise ValueError("invalid prediction variance")
    return y @ weights[:-1], np.maximum(variance, 0)


def scores(actual, predicted):
    residual = predicted - actual
    return dict(
        rmse=float(np.sqrt(np.mean(residual**2))),
        mae=float(np.abs(residual).mean()),
        bias=float(residual.mean()),
        r2=float(1 - np.mean(residual**2) / actual.var()) if actual.var() > 0 else None,
    )


def prediction(x, y, targets, policy):
    candidates = [("IDW", policy.power)]
    if len(x) >= policy.cv_sites:
        candidates += [("IDW", p) for p in [1.0, 2.0, 3.0] if p != policy.power]
    if len(x) >= policy.kriging_sites:
        candidates += [("OK", f) for f in ["spherical", "exponential", "gaussian"]]

    def run(candidate, sites, values, query):
        method, param = candidate
        if method == "OK":
            return kriging(sites, values, query, param)
        return idw(sites, values, query, policy, param), None

    ranking = []
    for candidate in candidates if len(x) >= policy.cv_sites else []:
        try:
            # Spatial blocks at larger n; fit variogram exclusively on training sites.
            folds = (
                np.arange(len(x))
                if len(x) < 2 * policy.kriging_sites
                else (x[:, 0] >= np.median(x[:, 0])).astype(int)
                + 2 * (x[:, 1] >= np.median(x[:, 1]))
            )
            pred = np.empty_like(y)
            for fold in np.unique(folds):
                test = folds == fold
                if not (~test).any():
                    raise ValueError("empty training fold")
                pred[test] = run(candidate, x[~test], y[~test], x[test])[0]
            if np.isfinite(pred).all():
                stats = scores(y, pred)
                ranking.append((stats["rmse"], candidate, stats))
        except (ValueError, np.linalg.LinAlgError):
            continue
    for _, candidate, stats in sorted(ranking, key=lambda row: row[0]) + [(0, candidates[0], None)]:
        try:
            pred, var = run(candidate, x, y, targets)
            return pred, var, candidate, stats
        except (ValueError, np.linalg.LinAlgError):
            continue
    raise ValueError("no supported model")


def png(values, mask, palette):
    low, high = float(values[mask].min()), float(values[mask].max())
    ratio = np.clip((np.nan_to_num(values, nan=low) - low) / (high - low or 1), 0, 1)[..., None]
    rgba = np.zeros((*mask.shape, 4), np.uint8)
    rgba[:, :, :3] = (1 - ratio) * np.array(palette[0]) + ratio * np.array(palette[1])
    rgba[:, :, 3] = mask * 255
    output = io.BytesIO()
    Image.fromarray(rgba).save(output, format="PNG")
    return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode(), [low, high]


@lru_cache(maxsize=32)
def raster(scope, geometry, samples, policy):
    import json

    start = perf_counter()
    outline = shape(json.loads(geometry))
    lon, lat = outline.centroid.coords[0]
    crs = f"+proj=aeqd +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m"
    project = Transformer.from_crs(4326, crs, always_xy=True).transform
    sites = []
    for lng, latitude, value, accuracy in samples:
        xy = np.array(project(lng, latitude))
        if not intersects_xy(outline, lng, latitude):
            continue
        for center, acc, values in sites:
            if np.linalg.norm(xy - center) <= max(accuracy, acc, 1):
                values.append(value)
                break
        else:
            sites.append((xy, accuracy, [value]))
    x = np.array([s[0] for s in sites])
    y = np.array([np.median(s[2]) for s in sites])
    n = len(x)
    unavailable = dict(sites=n, notice="Chưa đủ vị trí độc lập để nội suy.")
    if n < policy.min_sites or n > 128:
        return unavailable
    hull = MultiPoint(x).convex_hull
    if hull.area <= max(1, pdist(x).max() ** 2 * 0.005):
        return unavailable
    merc = Transformer.from_crs(4326, 3857, always_xy=True).transform
    w, s, e, t = transform(merc, outline).bounds
    nearest = cdist(x, x)
    np.fill_diagonal(nearest, np.inf)
    spacing = max(1, np.median(nearest.min(axis=1)) / 3 / np.cos(np.deg2rad(lat)))
    nx, ny = np.clip(np.ceil(np.array([e - w, t - s]) / spacing), 2, 100).astype(int)
    xx, yy = np.meshgrid(
        w + (np.arange(nx) + 0.5) * (e - w) / nx, t - (np.arange(ny) + 0.5) * (t - s) / ny
    )
    px, py = Transformer.from_crs(3857, crs, always_xy=True).transform(xx.ravel(), yy.ravel())
    target = np.column_stack((px, py))
    valid = (
        intersects_xy(hull, px, py)
        & intersects_xy(transform(project, outline), px, py)
        & (cdist(target, x).min(axis=1) <= policy.radius)
    )
    if not valid.any():
        return unavailable
    pred, var, method, cv = prediction(x, y, target[valid], policy)
    if not np.isfinite(pred).all():
        return unavailable

    def layer(values, palette):
        grid = np.full(len(valid), np.nan)
        grid[valid] = values
        return png(grid.reshape(ny, nx), valid.reshape(ny, nx), palette)

    colors = (
        [(235, 248, 255), (8, 74, 155)]
        if scope[2] in ("soil_moisture", "air_humidity")
        else [(255, 244, 172), (174, 39, 23)]
    )
    image, limits = layer(pred, colors)
    result = dict(
        image=image,
        limits=limits,
        colors=["#{:02x}{:02x}{:02x}".format(*tuple(c)) for c in colors],
        bounds=outline.bounds,
        sites=n,
        method=list(method),
        validation=cv,
        elapsed_ms=round((perf_counter() - start) * 1000, 1),
        notice="Ước tính thăm dò" if cv is None else "Ước tính theo phiên đo",
    )
    if var is not None:
        result["uncertainty"], result["sd_limits"] = layer(
            np.sqrt(var), [(255, 255, 255), (96, 28, 120)]
        )
    return result


def regression_kriging(x, y, targets, covariates, target_covariates, family):
    """Research adapter. Inputs must be co-registered, genuinely observed covariates.

    Call inside a held-out spatial fold; never fit the drift using the validation rows.
    No automatic production provider is configured.
    """
    design = np.column_stack([np.ones(len(x)), covariates])
    query = np.column_stack([np.ones(len(targets)), target_covariates])
    if (
        not np.isfinite(design).all()
        or not np.isfinite(query).all()
        or np.linalg.matrix_rank(design) < design.shape[1]
    ):
        raise ValueError("covariates incomplete or collinear")
    beta = np.linalg.lstsq(design, y, rcond=None)[0]
    correction, conditional_variance = kriging(x, y - design @ beta, targets, family)
    return query @ beta + correction, conditional_variance
