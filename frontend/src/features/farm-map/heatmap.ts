import type { FarmData, Metric, Thresholds } from '../../types/domain'
import { measurementStatus } from '../environmental-layers/status'
export type HeatPoint = { plotId: string; x: number; y: number; value: number }
export const HEAT_COLORS = ['#6934bd', '#277fba', '#00b5a8', '#24d654', '#e1ee14'] as const
export function heatPoints(data: FarmData, metric: Metric, thresholds: Thresholds): HeatPoint[] {
  return data.farm.plots.flatMap((plot) => {
    const snapshot = data.snapshots.find((s) => s.plotId === plot.id)
    const measurement = snapshot?.measurements[metric]
    const status = measurementStatus(snapshot, metric, data.referenceTime, thresholds)
    if (
      !measurement ||
      !['normal', 'warning'].includes(status) ||
      measurement.source === 'shared_station'
    )
      return []
    return [
      {
        plotId: plot.id,
        x: plot.geometry.label[0],
        y: plot.geometry.label[1],
        value: measurement.value,
      },
    ]
  })
}
// IDW p=2; anchors are simulated plot centroids, NOT actual sensor/GPS positions.
export function interpolate(points: HeatPoint[], x: number, y: number): number | undefined {
  let numerator = 0,
    denominator = 0
  for (const point of points) {
    const distanceSquared = (point.x - x) ** 2 + (point.y - y) ** 2
    if (distanceSquared < 0.000001) return point.value
    const weight = 1 / distanceSquared
    numerator += point.value * weight
    denominator += weight
  }
  return denominator ? numerator / denominator : undefined
}
export function heatColor(value: number, min: number, max: number): string {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min))) * (HEAT_COLORS.length - 1)
  const index = Math.min(HEAT_COLORS.length - 2, Math.floor(t)),
    fraction = t - index
  const a = HEAT_COLORS[index]!,
    b = HEAT_COLORS[index + 1]!
  const rgb = [1, 3, 5].map((offset) =>
    Math.round(
      parseInt(a.slice(offset, offset + 2), 16) * (1 - fraction) +
        parseInt(b.slice(offset, offset + 2), 16) * fraction,
    ),
  )
  return `rgb(${rgb.join(',')})`
}
// Marching squares, linear interpolation on edges; ambiguous cells use stable edge pairing.
export function contourPath(points: HeatPoint[], level: number, step = 24): string {
  let path = ''
  for (let y = 48; y < 720; y += step)
    for (let x = 72; x < 1032; x += step) {
      const corners = [
        [x, y],
        [x + step, y],
        [x + step, y + step],
        [x, y + step],
      ] as const
      const values = corners.map(([cx, cy]) => interpolate(points, cx, cy))
      const hits: [number, number][] = []
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4,
          a = values[edge],
          b = values[next]
        if (a === undefined || b === undefined || a < level === b < level || a === b) continue
        const fraction = (level - a) / (b - a),
          start = corners[edge]!,
          end = corners[next]!
        hits.push([
          start[0] + fraction * (end[0] - start[0]),
          start[1] + fraction * (end[1] - start[1]),
        ])
      }
      for (let i = 0; i + 1 < hits.length; i += 2)
        path += `M${hits[i]![0].toFixed(1)},${hits[i]![1].toFixed(1)}L${hits[i + 1]![0].toFixed(1)},${hits[i + 1]![1].toFixed(1)}`
    }
  return path
}
