import type { DataStatus, Metric, PlotSnapshot, Thresholds } from '../../types/domain'
import { metricPalettes } from './config'
export const statusLabels: Record<DataStatus, string> = {
  normal: 'Bình thường',
  warning: 'Cảnh báo ngưỡng DEMO',
  offline: 'Mất kết nối',
  'no-data': 'Chưa có dữ liệu',
  stale: 'Dữ liệu quá hạn',
}
export const statusSymbols: Record<DataStatus, string> = {
  normal: '✓',
  warning: '!',
  offline: '×',
  'no-data': '—',
  stale: '◷',
}
export function measurementStatus(
  snapshot: PlotSnapshot | undefined,
  metric: Metric,
  referenceTime: string,
  thresholds: Thresholds,
): DataStatus {
  if (snapshot?.connectivity === 'offline') return 'offline'
  if (snapshot?.invalidMetrics?.[metric]) return 'no-data'
  const m = snapshot?.measurements[metric]
  if (!m || !Number.isFinite(m.value) || (metric === 'soil_moisture' && !m.calibrated))
    return 'no-data'
  const age = Date.parse(referenceTime) - Date.parse(m.observedAt)
  // Chu kỳ dự kiến + 5 phút dung sai. Kết nối gateway được giữ riêng.
  if (
    snapshot?.connectivity !== 'online' ||
    !Number.isFinite(age) ||
    age < -60000 ||
    age > (snapshot.expectedIntervalSeconds + 300) * 1000
  )
    return 'stale'
  return m.value < thresholds[metric].min || m.value > thresholds[metric].max ? 'warning' : 'normal'
}
export function colorFor(
  snapshot: PlotSnapshot | undefined,
  metric: Metric,
  reference: string,
  thresholds: Thresholds,
): string {
  const status = measurementStatus(snapshot, metric, reference, thresholds)
  if (status === 'offline') return '#758078'
  if (status === 'stale') return '#8d93a0'
  if (status === 'no-data') return '#c6c8b7'
  if (status === 'warning') return '#c78a43'
  const { min, max } = thresholds[metric]
  const value = snapshot!.measurements[metric]!.value
  return metricPalettes[metric][
    Math.min(2, Math.max(0, Math.floor(((value - min) / (max - min)) * 3)))
  ]!
}
