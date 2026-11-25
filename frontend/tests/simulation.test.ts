import { describe, expect, it } from 'vitest'
import { SimulationEngine, seededRandom, limits, scenarios } from '../src/simulation/engine'
import { metrics } from '../src/types/domain'
import { measurementStatus } from '../src/features/environmental-layers/status'
import { DEFAULT_THRESHOLDS } from '../src/features/environmental-layers/config'
import { heatPoints } from '../src/features/farm-map/heatmap'
const request = {
  plotId: 'A-03',
  metric: 'air_temperature' as const,
  range: '30d' as const,
  phase: 'ALL' as const,
}
const target = (e: SimulationEngine) => e.getFarm().snapshots.find((s) => s.plotId === 'A-03')!
describe('Simulation Engine', () => {
  it('seed tái lập, seed khác sinh chuỗi khác, đọc không sinh dữ liệu', () => {
    const a = new SimulationEngine({ seed: 7 }),
      b = new SimulationEngine({ seed: 7 }),
      c = new SimulationEngine({ seed: 8 })
    for (const e of [a, b, c]) {
      e.start()
      e.advance(10000)
    }
    expect(a.exportState()).toEqual(b.exportState())
    expect(a.getFarm()).not.toEqual(c.getFarm())
    expect(a.getFarm()).toEqual(a.getFarm())
    expect(JSON.parse(JSON.stringify(a.exportState()))).toEqual(a.exportState())
    const x = seededRandom(9),
      y = seededRandom(9)
    expect(Array.from({ length: 10 }, x)).toEqual(Array.from({ length: 10 }, y))
  })
  it('12 ID ổn định, đủ 4 chỉ số và biến thiên giới hạn', () => {
    const e = new SimulationEngine()
    const ids = e.getFarm().farm.plots.map((p) => p.id)
    expect(ids).toHaveLength(12)
    e.start()
    for (let step = 0; step < 100; step++) {
      e.advance(1000)
      for (const s of e.getFarm().snapshots)
        for (const metric of metrics) {
          const m = s.measurements[metric]!
          expect(Number.isFinite(m.value)).toBe(true)
          expect(m.value).toBeGreaterThanOrEqual(limits[metric][0])
          expect(m.value).toBeLessThanOrEqual(limits[metric][1])
        }
    }
    expect(e.getFarm().farm.plots.map((p) => p.id)).toEqual(ids)
    const rows = e.getHistory(request)
    for (let i = 1; i < rows.length; i++)
      expect(Math.abs(rows[i]!.value - rows[i - 1]!.value)).toBeLessThanOrEqual(0.201)
  })
  it('chu kỳ 600 giây, tốc độ, phần dư, pause/resume không rò thời gian', () => {
    const e = new SimulationEngine()
    e.setSpeed(1)
    e.start()
    e.advance(599999)
    expect(e.getHistory(request)).toHaveLength(1)
    e.advance(1)
    expect(e.getHistory(request)).toHaveLength(2)
    const paused = e.exportState()
    e.pause()
    e.advance(500000)
    expect(e.getFarm()).toEqual(paused.data)
    e.resume()
    e.setSpeed(600)
    e.advance(1000)
    expect(e.getHistory(request)).toHaveLength(3)
    const rows = e.getHistory(request)
    expect(Date.parse(rows[1]!.observedAt) - Date.parse(rows[0]!.observedAt)).toBe(600000)
  })
  it('reset tái lập đúng baseline, scenario và đồng hồ', () => {
    const e = new SimulationEngine()
    const initial = e.exportState()
    e.start()
    e.advance(5000)
    e.setScenario('HIGH_AIR_TEMPERATURE')
    e.reset()
    expect(e.exportState()).toEqual(initial)
  })
  it.each(scenarios)('scenario %s xác định và không làm sai vùng khác', (scenario) => {
    const a = new SimulationEngine({ seed: 17 }),
      b = new SimulationEngine({ seed: 17 })
    for (const e of [a, b]) {
      e.setScenario(scenario)
      e.start()
      e.advance(4000)
    }
    expect(a.exportState()).toEqual(b.exportState())
    const s = target(a),
      data = a.getFarm()
    const status = (metric: (typeof metrics)[number]) =>
      measurementStatus(s, metric, data.referenceTime, DEFAULT_THRESHOLDS)
    if (scenario === 'NORMAL') for (const m of metrics) expect(status(m)).toBe('normal')
    if (scenario === 'LOW_SOIL_MOISTURE') {
      expect(s.measurements.soil_moisture!.value).toBeLessThan(20)
      expect(status('soil_moisture')).toBe('warning')
    }
    if (scenario === 'HIGH_AIR_TEMPERATURE') {
      expect(s.measurements.air_temperature!.value).toBeGreaterThan(32)
      expect(status('air_temperature')).toBe('warning')
    }
    if (scenario === 'ABNORMAL_SOIL_PH') {
      expect(s.measurements.soil_ph!.value).toBeLessThan(5.5)
      expect(status('soil_ph')).toBe('warning')
    }
    if (scenario === 'SENSOR_OFFLINE') expect(status('soil_ph')).toBe('offline')
    if (scenario === 'STALE_DATA') {
      expect(status('soil_ph')).toBe('stale')
      expect(Date.parse(s.measurements.soil_ph!.observedAt)).toBeLessThan(
        Date.parse(data.referenceTime) - 900000,
      )
    }
    if (scenario === 'MISSING_SENSOR') {
      expect(s.measurements.soil_ph).toBeUndefined()
      expect(data.farm.plots.find((p) => p.id === 'A-03')!.sensorIds).not.toContain('A-03-soil_ph')
      expect(status('soil_ph')).toBe('no-data')
    }
    if (scenario === 'INVALID_MEASUREMENT') {
      expect(s.invalidMetrics?.soil_ph).toBeTruthy()
      expect(a.getInfo().diagnostics.length).toBeGreaterThan(0)
      expect(a.getHistory({ ...request, metric: 'soil_ph' }).some((m) => m.value === 999)).toBe(
        false,
      )
      expect(heatPoints(data, 'soil_ph', DEFAULT_THRESHOLDS).some((p) => p.plotId === 'A-03')).toBe(
        false,
      )
    }
    const other = data.snapshots.find((p) => p.plotId === 'B-01')!
    for (const m of metrics)
      expect(measurementStatus(other, m, data.referenceTime, DEFAULT_THRESHOLDS)).toBe('normal')
  })
  it('chuyển scenario và trở lại NORMAL khôi phục sensor và không nhân đôi sample cùng thời điểm', () => {
    const e = new SimulationEngine()
    for (const s of scenarios) e.setScenario(s)
    e.setScenario('NORMAL')
    expect(target(e).invalidMetrics).toBeUndefined()
    expect(target(e).measurements.soil_ph).toBeDefined()
    expect(e.getHistory(request)).toHaveLength(1)
  })
  it('snapshot/history cùng nguồn và không rò bản sao đã chỉnh sửa', () => {
    const e = new SimulationEngine()
    e.start()
    e.advance(3000)
    for (const plot of e.getFarm().farm.plots)
      for (const metric of metrics)
        expect(e.getHistory({ ...request, plotId: plot.id, metric }).at(-1)).toEqual(
          e.getFarm().snapshots.find((s) => s.plotId === plot.id)!.measurements[metric],
        )
    const copy = e.getFarm()
    copy.snapshots.length = 0
    expect(e.getFarm().snapshots).toHaveLength(12)
  })
  it('PRE_PAW chỉ cho chu kỳ gắn phiên DEMO, chu kỳ khác UNKNOWN', () => {
    const e = new SimulationEngine()
    e.createPrePawSession()
    e.setScenario('NORMAL')
    expect(target(e).measurements.air_temperature!.measurement_phase).toBe('UNKNOWN')
    e.start()
    e.advance(2000)
    const pre = e.getHistory({ ...request, phase: 'PRE_PAW' })
    expect(pre).toHaveLength(1)
    expect(pre[0]!.irrigationEventId).toMatch(/^demo-session-/)
    expect(Date.parse(pre[0]!.irrigationEventAt!)).toBeGreaterThan(Date.parse(pre[0]!.observedAt))
    expect(target(e).measurements.air_temperature!.measurement_phase).toBe('UNKNOWN')
  })
  it('từ chối cấu hình và thời gian sai', () => {
    expect(() => new SimulationEngine({ intervalSeconds: 0 })).toThrow()
    const e = new SimulationEngine()
    expect(() => e.setSpeed(0)).toThrow()
    expect(() => e.advance(-1)).toThrow()
  })
})
