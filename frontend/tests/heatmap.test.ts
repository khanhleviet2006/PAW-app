import { describe, expect, it } from 'vitest'
import { demoData } from '../src/data/mock/fixtures'
import { DEFAULT_THRESHOLDS } from '../src/features/environmental-layers/config'
import { contourPath, heatColor, heatPoints, interpolate } from '../src/features/farm-map/heatmap'
describe('Heatmap nội suy DEMO', () => {
  it('giữ chính xác số đo tại điểm neo, không sinh giá trị khi không có điểm', () => {
    expect(interpolate([], 0, 0)).toBeUndefined()
    const points = [
      { plotId: 'a', x: 0, y: 0, value: 20 },
      { plotId: 'b', x: 10, y: 0, value: 30 },
    ]
    expect(interpolate(points, 0, 0)).toBe(20)
    expect(interpolate(points, 5, 0)).toBe(25)
  })
  it('loại offline, stale, thiếu số đo, trạm chung và đất chưa hiệu chuẩn', () => {
    const ids = heatPoints(demoData, 'air_temperature', DEFAULT_THRESHOLDS).map((p) => p.plotId)
    for (const id of ['B-02', 'C-03', 'C-04', 'C-01']) expect(ids).not.toContain(id)
    expect(ids).toContain('A-04')
    const copy = structuredClone(demoData)
    copy.snapshots[2]!.measurements.soil_moisture!.calibrated = false
    expect(
      heatPoints(copy, 'soil_moisture', DEFAULT_THRESHOLDS).map((p) => p.plotId),
    ).not.toContain('A-03')
  })
  it('màu liên tục, giới hạn đúng dải; contour thực sự phụ thuộc số đo', () => {
    expect(heatColor(0, 0, 10)).toBe(heatColor(-100, 0, 10))
    expect(heatColor(10, 0, 10)).toBe(heatColor(100, 0, 10))
    expect(heatColor(5, 0, 10)).not.toBe(heatColor(6, 0, 10))
    const points = heatPoints(demoData, 'air_temperature', DEFAULT_THRESHOLDS)
    expect(contourPath(points, 26)).toContain('M')
    expect(contourPath(points, 26)).not.toBe(contourPath(points, 30))
  })
})
