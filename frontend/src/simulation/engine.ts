import { metrics } from '../types/domain'
import type { FarmData, HistoryRequest, Measurement, Metric } from '../types/domain'
import { geometryPlots } from '../data/mock/geometry'
export const scenarios = [
  'NORMAL',
  'LOW_SOIL_MOISTURE',
  'HIGH_AIR_TEMPERATURE',
  'ABNORMAL_SOIL_PH',
  'SENSOR_OFFLINE',
  'STALE_DATA',
  'MISSING_SENSOR',
  'INVALID_MEASUREMENT',
] as const
export type Scenario = (typeof scenarios)[number]
export const limits: Record<Metric, readonly [number, number]> = {
  air_temperature: [10, 45],
  air_humidity: [30, 95],
  soil_moisture: [0, 80],
  soil_ph: [3, 9],
}
const normal: Record<Metric, readonly [number, number]> = {
  air_temperature: [23, 28],
  air_humidity: [60, 80],
  soil_moisture: [30, 45],
  soil_ph: [6, 7],
}
const units = {
  air_temperature: '°C',
  air_humidity: '%RH',
  soil_moisture: '%',
  soil_ph: 'pH',
} as const
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}
export class SimulationEngine {
  readonly seed: number
  readonly intervalMs: number
  readonly startAt: number
  private random: () => number
  private now: number
  private nextAt: number
  private running = false
  private speed = 600
  private scenario: Scenario = 'NORMAL'
  private data: FarmData
  private history = new Map<string, Measurement[]>()
  private diagnostics: {
    observedAt: string
    plotId: string
    metric: Metric
    rejectedValue: number
    reason: string
  }[] = []
  private session: { id: string; eventAt: string } | undefined
  private sessionCount = 0
  constructor(options: { seed?: number; intervalSeconds?: number; startAt?: string } = {}) {
    this.seed = options.seed ?? 42
    this.intervalMs = (options.intervalSeconds ?? 600) * 1000
    this.startAt = Date.parse(options.startAt ?? '2026-11-03T00:00:00Z')
    if (
      !Number.isFinite(this.seed) ||
      !Number.isFinite(this.intervalMs) ||
      this.intervalMs < 1000 ||
      !Number.isFinite(this.startAt)
    )
      throw Error('Cấu hình mô phỏng không hợp lệ')
    this.random = seededRandom(this.seed)
    this.now = this.startAt
    this.nextAt = this.now + this.intervalMs
    this.data = this.initialize()
    this.measure(this.now)
  }
  private initialize(): FarmData {
    const plots = geometryPlots.map((p) => ({
      ...structuredClone(p),
      sensorIds: metrics.map((m) => `${p.id}-${m}`),
    }))
    return {
      mode: 'DEMO',
      clockMode: 'simulation',
      referenceTime: new Date(this.now).toISOString(),
      farm: {
        id: 'paw-demo',
        name: 'Khu vườn PAW · DỮ LIỆU MÔ PHỎNG',
        coordinateSystem: 'relative-demo',
        plots,
        sensors: plots.flatMap((p) =>
          metrics.map((metric) => ({
            id: `${p.id}-${metric}`,
            metric,
            plotIds: [p.id],
            expectedIntervalSeconds: this.intervalMs / 1000,
            calibrated: true,
          })),
        ),
      },
      snapshots: plots.map((p) => ({
        plotId: p.id,
        connectivity: 'online',
        expectedIntervalSeconds: this.intervalMs / 1000,
        measurements: {},
      })),
    }
  }
  private range(metric: Metric, target: boolean): readonly [number, number] {
    if (target && this.scenario === 'LOW_SOIL_MOISTURE' && metric === 'soil_moisture')
      return [5, 15]
    if (target && this.scenario === 'HIGH_AIR_TEMPERATURE' && metric === 'air_temperature')
      return [36, 44]
    if (target && this.scenario === 'ABNORMAL_SOIL_PH' && metric === 'soil_ph') return [3, 4.5]
    return normal[metric]
  }
  private measure(at: number) {
    const time = new Date(at).toISOString()
    for (const snapshot of this.data.snapshots) {
      const target = snapshot.plotId === 'A-03'
      snapshot.connectivity =
        target && this.scenario === 'SENSOR_OFFLINE'
          ? 'offline'
          : target && this.scenario === 'STALE_DATA'
            ? 'delayed'
            : 'online'
      delete snapshot.invalidMetrics
      if (target && ['SENSOR_OFFLINE', 'STALE_DATA'].includes(this.scenario)) continue
      const plot = this.data.farm.plots.find((p) => p.id === snapshot.plotId)!
      plot.sensorIds = metrics
        .filter((m) => !(target && this.scenario === 'MISSING_SENSOR' && m === 'soil_ph'))
        .map((m) => `${plot.id}-${m}`)
      for (const metric of metrics) {
        const key = `${plot.id}-${metric}`
        if (target && this.scenario === 'MISSING_SENSOR' && metric === 'soil_ph') {
          delete snapshot.measurements[metric]
          continue
        }
        if (target && this.scenario === 'INVALID_MEASUREMENT' && metric === 'soil_ph') {
          snapshot.invalidMetrics = {
            soil_ph: 'Phép đo không hợp lệ đã bị loại; hiển thị số đo hợp lệ gần nhất.',
          }
          this.diagnostics.push({
            observedAt: time,
            plotId: plot.id,
            metric,
            rejectedValue: 999,
            reason: 'Ngoài giới hạn mô phỏng pH',
          })
          this.diagnostics = this.diagnostics.slice(-100)
          continue
        }
        const [min, max] = this.range(metric, target),
          old = snapshot.measurements[metric]?.value
        const previous = old === undefined || old < min || old > max ? (min + max) / 2 : old
        const value = Number(
          Math.max(
            min,
            Math.min(max, previous + (this.random() - 0.5) * (max - min) * 0.08),
          ).toFixed(3),
        )
        const measurement: Measurement = {
          sensorId: key,
          metric,
          value,
          unit: units[metric],
          observedAt: time,
          receivedAt: time,
          source: 'simulation',
          sourceLabel: `DỮ LIỆU MÔ PHỎNG · seed ${this.seed}`,
          calibrated: true,
          measurement_phase: this.session ? 'PRE_PAW' : 'UNKNOWN',
          ...(this.session
            ? { irrigationEventId: this.session.id, irrigationEventAt: this.session.eventAt }
            : {}),
        }
        snapshot.measurements[metric] = measurement
        const rows = this.history.get(key) ?? []
        if (rows.at(-1)?.observedAt === time) rows[rows.length - 1] = structuredClone(measurement)
        else rows.push(structuredClone(measurement))
        // At default cadence retain 30 days plus current sample. Retention is bounded.
        const capacity = Math.min(10000, Math.ceil((30 * 86400000) / this.intervalMs) + 1)
        this.history.set(key, rows.slice(-capacity))
      }
    }
    const configured = new Set(this.data.farm.plots.flatMap((p) => p.sensorIds))
    this.data.farm.sensors = this.data.farm.plots.flatMap((p) =>
      metrics
        .filter((m) => configured.has(`${p.id}-${m}`))
        .map((metric) => ({
          id: `${p.id}-${metric}`,
          metric,
          plotIds: [p.id],
          expectedIntervalSeconds: this.intervalMs / 1000,
          calibrated: true,
        })),
    )
    this.session = undefined
  }
  start() {
    this.running = true
  }
  pause() {
    this.running = false
  }
  resume() {
    this.running = true
  }
  setSpeed(speed: number) {
    if (!Number.isFinite(speed) || speed < 1 || speed > 3600)
      throw Error('Tốc độ phải từ 1 đến 3600')
    this.speed = speed
  }
  setScenario(scenario: Scenario) {
    if (!scenarios.includes(scenario)) throw Error('Scenario không hợp lệ')
    this.scenario = scenario
    const pending = this.session
    this.session = undefined
    this.measure(this.now)
    this.session = pending
  }
  createPrePawSession() {
    this.sessionCount++
    this.session = {
      id: `demo-session-${this.seed}-${this.now}-${this.sessionCount}`,
      eventAt: new Date(this.now + this.intervalMs * 2).toISOString(),
    }
  }
  advance(realMs: number) {
    if (!Number.isFinite(realMs) || realMs < 0 || (realMs * this.speed) / this.intervalMs > 10000)
      throw Error('Bước thời gian không hợp lệ hoặc quá lớn')
    if (!this.running) return
    this.now += realMs * this.speed
    while (this.nextAt <= this.now) {
      this.measure(this.nextAt)
      this.nextAt += this.intervalMs
    }
    this.data.referenceTime = new Date(this.now).toISOString()
  }
  reset() {
    this.random = seededRandom(this.seed)
    this.now = this.startAt
    this.nextAt = this.now + this.intervalMs
    this.running = false
    this.scenario = 'NORMAL'
    this.speed = 600
    this.history.clear()
    this.diagnostics = []
    this.session = undefined
    this.sessionCount = 0
    this.data = this.initialize()
    this.measure(this.now)
  }
  getFarm() {
    return structuredClone(this.data)
  }
  getHistory(request: HistoryRequest) {
    const duration = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 }[request.range]
    return structuredClone(
      (this.history.get(`${request.plotId}-${request.metric}`) ?? []).filter(
        (m) =>
          Date.parse(m.observedAt) >= this.now - duration &&
          Date.parse(m.observedAt) <= this.now &&
          (request.phase === 'ALL' || m.measurement_phase === request.phase),
      ),
    )
  }
  getInfo() {
    return {
      seed: this.seed,
      intervalSeconds: this.intervalMs / 1000,
      time: new Date(this.now).toISOString(),
      running: this.running,
      speed: this.speed,
      scenario: this.scenario,
      pendingPrePawSession: this.session?.id,
      diagnostics: structuredClone(this.diagnostics),
    }
  }
  exportState() {
    return {
      version: 1,
      ...this.getInfo(),
      data: this.getFarm(),
      history: Object.fromEntries([...this.history].map(([k, v]) => [k, structuredClone(v)])),
    }
  }
}
