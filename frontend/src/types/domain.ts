export const metrics = ['air_temperature', 'air_humidity', 'soil_moisture', 'soil_ph'] as const
export type Metric = (typeof metrics)[number]
export type MeasurementPhase = 'PRE_PAW' | 'UNKNOWN'
export type DataMode = 'DEMO' | 'LIVE'
export type Connectivity = 'online' | 'delayed' | 'offline' | 'unknown'
export type DataStatus = 'normal' | 'warning' | 'offline' | 'no-data' | 'stale'
export type Point = readonly [number, number]
export type Plot = {
  id: string
  name: string
  farmId: string
  areaHa?: number
  geometry: { type: 'polygon'; points: readonly Point[]; label: Point }
  geographicGeometry?: { type: 'Polygon'; coordinates: number[][][] }
  sensorIds: string[]
}
export type Sensor = {
  position?: { latitude: number; longitude: number }
  id: string
  metric: Metric
  plotIds: string[]
  expectedIntervalSeconds: number
  calibrated: boolean
}
export type Measurement = {
  sensorId: string
  metric: Metric
  value: number
  unit: '°C' | '%RH' | '%' | 'pH' | 'raw'
  observedAt: string
  receivedAt?: string
  source: 'simulation' | 'sensor' | 'shared_station'
  sourceLabel: string
  calibrated: boolean
  measurement_phase: MeasurementPhase
  irrigationEventId?: string
  irrigationEventAt?: string
}
export type PlotSnapshot = {
  invalidMetrics?: Partial<Record<Metric, string>>
  plotId: string
  measurements: Partial<Record<Metric, Measurement>>
  connectivity: Connectivity
  expectedIntervalSeconds: number
}
export type Farm = {
  id: string
  name: string
  plots: Plot[]
  sensors: Sensor[]
  coordinateSystem: 'relative-demo' | 'geographic'
}
export type FarmData = {
  clockMode?: 'fixed' | 'simulation'
  farm: Farm
  snapshots: PlotSnapshot[]
  referenceTime: string
  mode: DataMode
}
export type HistoryRange = '24h' | '7d' | '30d'
export type HistoryRequest = {
  plotId: string
  metric: Metric
  range: HistoryRange
  phase: MeasurementPhase | 'ALL'
}
export type Threshold = { min: number; max: number }
export type Thresholds = Record<Metric, Threshold>
