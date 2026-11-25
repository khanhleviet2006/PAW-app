import { metrics } from '../../types/domain'
import type { FarmData, Measurement, Metric, PlotSnapshot, Sensor } from '../../types/domain'
import { geometryPlots } from './geometry'
export const DEMO_NOW = '2026-11-02T07:40:00.000Z'
export const DEMO_OBSERVED = '2026-11-02T07:32:00.000Z'
const values: Record<Metric, number[]> = {
  air_temperature: [24.1, 25.3, 26.7, 35.8, 24, 25.1, 25.9, 26.3, 23.8, 24.9, 25.6, 26],
  air_humidity: [74, 73, 72, 55, 76, 71, 70, 73, 78, 75, 72, 74],
  soil_moisture: [38, 36, 34, 24, 40, 35, 33, 37, 42, 38, 36, 35],
  soil_ph: [6.3, 6.5, 6.4, 6.1, 6.2, 6.6, 6.4, 6.5, 6.3, 6.2, 6.4, 6.1],
}
const units = {
  air_temperature: '°C',
  air_humidity: '%RH',
  soil_moisture: '%',
  soil_ph: 'pH',
} as const
const sensors: Sensor[] = []
const snapshots: PlotSnapshot[] = []
const plots = geometryPlots.map((plot, index) => {
  const sensorIds: string[] = []
  const measurements: Partial<Record<Metric, Measurement>> = {}
  if (plot.id !== 'C-04')
    for (const metric of metrics) {
      if (plot.id === 'B-04' && metric === 'soil_ph') continue
      const shared =
        plot.id === 'C-01' && (metric === 'air_temperature' || metric === 'air_humidity')
      const sensorId = shared ? `station-${metric}` : `${plot.id}-${metric}`
      const observedAt =
        plot.id === 'B-02'
          ? '2026-11-02T05:32:00.000Z'
          : plot.id === 'C-03'
            ? '2026-11-02T06:32:00.000Z'
            : DEMO_OBSERVED
      sensorIds.push(sensorId)
      sensors.push({
        id: sensorId,
        metric,
        plotIds: [plot.id],
        expectedIntervalSeconds: 600,
        calibrated: true,
      })
      measurements[metric] = {
        sensorId,
        metric,
        value: values[metric][index]!,
        unit: units[metric],
        observedAt,
        receivedAt: new Date(Date.parse(observedAt) + 45000).toISOString(),
        source: shared ? 'shared_station' : 'simulation',
        sourceLabel: shared
          ? 'Trạm không khí dùng chung · mô phỏng'
          : `Cảm biến ${plot.id} · mô phỏng`,
        calibrated: true,
        measurement_phase: 'UNKNOWN',
      }
    }
  snapshots.push({
    plotId: plot.id,
    measurements,
    connectivity:
      plot.id === 'B-02'
        ? 'offline'
        : plot.id === 'C-03'
          ? 'delayed'
          : plot.id === 'C-04'
            ? 'unknown'
            : 'online',
    expectedIntervalSeconds: 600,
  })
  return { ...plot, sensorIds }
})
export const demoData: FarmData = {
  mode: 'DEMO',
  referenceTime: DEMO_NOW,
  farm: { id: 'paw-demo', name: 'Khu vườn PAW', plots, sensors, coordinateSystem: 'relative-demo' },
  snapshots,
}
