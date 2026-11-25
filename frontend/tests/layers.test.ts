import { describe, expect, it } from 'vitest'
import { demoData, DEMO_NOW } from '../src/data/mock/fixtures'
import { DEFAULT_THRESHOLDS } from '../src/features/environmental-layers/config'
import { colorFor, measurementStatus } from '../src/features/environmental-layers/status'
import { formatMeasurement } from '../src/lib/format'
const status = (id: string) =>
  measurementStatus(
    demoData.snapshots.find((s) => s.plotId === id),
    'air_temperature',
    DEMO_NOW,
    DEFAULT_THRESHOLDS,
  )
describe('Trạng thái và đơn vị', () => {
  it('phân biệt bình thường, cảnh báo, offline, stale và chưa có', () => {
    expect(status('A-03')).toBe('normal')
    expect(status('A-04')).toBe('warning')
    expect(status('B-02')).toBe('offline')
    expect(status('C-03')).toBe('stale')
    expect(status('C-04')).toBe('no-data')
  })
  it('đổi ngưỡng không thay đổi số đo; quá hạn không thành bình thường', () => {
    const s = demoData.snapshots[2]!
    const t = { ...DEFAULT_THRESHOLDS, air_temperature: { min: 18, max: 25 } }
    expect(measurementStatus(s, 'air_temperature', DEMO_NOW, t)).toBe('warning')
    expect(measurementStatus(s, 'air_temperature', '2026-11-02T08:40:00Z', t)).toBe('stale')
    expect(s.measurements.air_temperature?.value).toBe(26.7)
  })
  it('không tô màu như số đo hợp lệ hoặc ghi % cho đất chưa hiệu chuẩn', () => {
    const s = structuredClone(demoData.snapshots[2]!)
    s.measurements.soil_moisture!.calibrated = false
    expect(formatMeasurement(s.measurements.soil_moisture)).toBe('34 raw')
    expect(measurementStatus(s, 'soil_moisture', DEMO_NOW, DEFAULT_THRESHOLDS)).toBe('no-data')
    expect(colorFor(s, 'soil_moisture', DEMO_NOW, DEFAULT_THRESHOLDS)).toBe('#c6c8b7')
  })
})
