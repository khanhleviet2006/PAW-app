import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from '../src/simulation/engine'
import { simulationRuntime as runtime } from '../src/simulation/runtime'
import { mockRepository } from '../src/services/adapters/mockRepository'
import { getRepository } from '../src/services/repositoryFactory'
import { DEFAULT_THRESHOLDS } from '../src/features/environmental-layers/config'
import { measurementStatus } from '../src/features/environmental-layers/status'
afterEach(() => {
  runtime.engine = new SimulationEngine()
  runtime.enabled = false
  vi.restoreAllMocks()
})
describe('Repository cùng nguồn simulation', () => {
  it('farm và history nhận cùng mẫu sau tick, scenario và reset; LIVE không lấy mock', async () => {
    runtime.start()
    runtime.setScenario('HIGH_AIR_TEMPERATURE')
    runtime.pulse(performance.now() + 1000)
    runtime.pause()
    const farm = await mockRepository.getFarm(),
      s = farm.snapshots.find((s) => s.plotId === 'A-03')!
    const rows = await mockRepository.getHistory({
      plotId: 'A-03',
      metric: 'air_temperature',
      range: '24h',
      phase: 'ALL',
    })
    expect(rows.at(-1)).toEqual(s.measurements.air_temperature)
    expect(measurementStatus(s, 'air_temperature', farm.referenceTime, DEFAULT_THRESHOLDS)).toBe(
      'warning',
    )
    await expect(getRepository('LIVE').getFarm()).rejects.toThrow('LIVE chưa sẵn sàng')
    runtime.reset()
    expect((await mockRepository.getFarm()).referenceTime).toBe('2026-11-03T00:00:00.000Z')
  })
  it('wall clock pause/resume không tính cả thời gian đang pause', () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    runtime.start()
    now = 500
    runtime.pause()
    const paused = runtime.engine.getInfo().time
    now = 10000
    runtime.resume()
    runtime.pulse(10500)
    expect(Date.parse(runtime.engine.getInfo().time) - Date.parse(paused)).toBe(300000)
  })
})
