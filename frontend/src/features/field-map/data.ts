import type { MeasurePoint, Points, Reading } from './types'
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
export function filterPoints(points: Points, metric: string, depth: string): Points {
  return {
    ...points,
    features: points.features.filter(
      (f) =>
        f.properties.metric === metric &&
        (!metric.startsWith('soil_') || String(f.properties.depth_cm) === depth),
    ),
  }
}
export function selectPoint(points: Points, id: string): MeasurePoint | undefined {
  return points.features.find((p) => p.properties.id === id)
}
export function displayReading(reading: Reading) {
  return `${reading.value?.toLocaleString('vi-VN') ?? 'Thiếu số đo'} ${reading.unit} · ${new Date(reading.observed_at).toLocaleString('vi-VN')}`
}
