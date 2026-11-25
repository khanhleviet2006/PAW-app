import type { Metric } from '../../types/domain'
import type { MeasurePoint, Points, Reading, Snapshot } from './types'
export const EMPTY: Points = { type: 'FeatureCollection', features: [] }
export function mergePoints(old: Points, incoming: Points): Points {
  const records = new Map(old.features.map((f) => [f.properties.id, f]))
  for (const f of incoming.features) {
    if (
      f.geometry.type !== 'Point' ||
      f.geometry.coordinates.length !== 2 ||
      !f.geometry.coordinates.every(Number.isFinite) ||
      Math.abs(f.geometry.coordinates[0]!) > 180 ||
      Math.abs(f.geometry.coordinates[1]!) > 85
    )
      continue
    records.set(f.properties.id, f)
  }
  return { type: 'FeatureCollection', features: [...records.values()] }
}
export function filterPoints(points: Points, metric: Metric, depth: string): Points {
  return {
    ...points,
    features: points.features.filter(
      (f) =>
        f.properties.metric === metric &&
        (!metric.startsWith('soil_') || String(f.properties.depth_cm) === depth),
    ),
  }
}
export function currentHeat(snapshot: Snapshot, metric: Metric, depth: string): Points {
  return {
    type: 'FeatureCollection',
    features: snapshot.heat_points
      .filter(
        (p) =>
          p.metric === metric &&
          (!metric.startsWith('soil_') || String(p.depth_cm) === depth) &&
          p.source === 'sensor' &&
          p.quality === 'valid',
      )
      .map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
        properties: p,
      })),
  }
}
export function selectPoint(points: Points, id: string): MeasurePoint | undefined {
  return points.features.find((p) => p.properties.id === id)
}
export function displayReading(reading: Reading) {
  return `${reading.value.toLocaleString('vi-VN')} ${reading.unit} · ${new Date(reading.observed_at).toLocaleString('vi-VN')}`
}
