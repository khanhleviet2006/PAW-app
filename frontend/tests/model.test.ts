import { describe, expect, it } from 'vitest'
import { mockRepository } from '../src/services/adapters/mockRepository'
describe('Hợp đồng DEMO', () => {
  it('ổn định, geometry độc lập và ID cảm biến hợp lệ', async () => {
    const a = await mockRepository.getFarm(),
      b = await mockRepository.getFarm()
    expect(a).toEqual(b)
    expect(a.farm.plots).toHaveLength(12)
    expect(new Set(a.farm.plots.map((p) => p.id)).size).toBe(12)
    for (const p of a.farm.plots) {
      expect(p.geometry.points.length).toBeGreaterThanOrEqual(3)
      for (const id of p.sensorIds)
        expect(a.farm.sensors.some((s) => s.id === id && s.plotIds.includes(p.id))).toBe(true)
    }
    a.farm.plots.length = 0
    expect((await mockRepository.getFarm()).farm.plots).toHaveLength(12)
  })
  it('không lấp số đo cho vùng thiếu cảm biến, không tự gắn PRE_PAW', async () => {
    const data = await mockRepository.getFarm()
    expect(data.snapshots.find((s) => s.plotId === 'C-04')?.measurements).toEqual({})
    expect(data.snapshots.find((s) => s.plotId === 'B-04')?.measurements.soil_ph).toBeUndefined()
    for (const s of data.snapshots)
      for (const m of Object.values(s.measurements)) expect(m.measurement_phase).toBe('UNKNOWN')
  })
})
