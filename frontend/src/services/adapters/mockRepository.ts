import { simulationRuntime } from '../../simulation/runtime'
import { demoData } from '../../data/mock/fixtures'
import type { Measurement } from '../../types/domain'
import type { FarmRepository } from '../repositories'
const hours = { '24h': 24, '7d': 168, '30d': 720 }
export const mockRepository: FarmRepository = {
  async getFarm(signal) {
    signal?.throwIfAborted()
    return simulationRuntime.enabled
      ? simulationRuntime.engine.getFarm()
      : structuredClone(demoData)
  },
  async getHistory(request, signal) {
    signal?.throwIfAborted()
    if (simulationRuntime.enabled) return simulationRuntime.engine.getHistory(request)
    const latest = demoData.snapshots.find((s) => s.plotId === request.plotId)?.measurements[
      request.metric
    ]
    if (!latest) return []
    const start = Date.parse(demoData.referenceTime) - hours[request.range] * 3600000
    const end = Date.parse(latest.observedAt)
    const result: Measurement[] = []
    for (let t = start; t < end; t += 3600000) {
      const absoluteHour = Math.floor(t / 3600000)
      const pre = absoluteHour % 24 === 0
      const swing = request.metric === 'soil_ph' ? 0.15 : 1.8
      result.push({
        ...latest,
        value: Number((latest.value + Math.sin(absoluteHour / 5) * swing).toFixed(1)),
        observedAt: new Date(t).toISOString(),
        receivedAt: new Date(t + 45000).toISOString(),
        measurement_phase: pre ? 'PRE_PAW' : 'UNKNOWN',
        ...(pre
          ? {
              irrigationEventId: `demo-${request.plotId}-${absoluteHour}`,
              irrigationEventAt: new Date(t + 1200000).toISOString(),
            }
          : {}),
      })
    }
    if (end >= start) result.push({ ...latest })
    return result.filter((m) => request.phase === 'ALL' || m.measurement_phase === request.phase)
  },
}
