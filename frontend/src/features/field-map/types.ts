import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { Metric as DemoMetric } from '../../types/domain'
export type Metric = DemoMetric | 'solar_radiation'
export type Connection = { baseUrl: string; farmId: string; token?: string }
export type Reading = {
  id: string
  node_id: string
  session_id?: string | null
  sensor_id: string
  deployment_id: string | null
  plot_id: string | null
  metric: Metric
  unit: string
  depth_cm: number | null
  value: number | null
  quality: string
  observed_at: string
  received_at: string
  measurement_phase: string
  source: string
  status?: string
  accuracy_m?: number
}
export type MeasurePoint = Feature<Point, Reading>
export type Points = FeatureCollection<Point, Reading> & {
  next_cursor?: string | null
  truncated?: boolean
}
export type Snapshot = {
  schema_version: string
  cursor: number
  reference_time: string
  farm: {
    id: string
    name: string
    source: string
    thresholds: Partial<Record<Metric, [number, number]>>
  }
  plots: { id: string; name: string; geometry: Polygon }[]
  nodes: {
    id: string
    name: string
    connectivity: string
    placement_state: string
    position: { longitude: number; latitude: number } | null
    deployment: { id: string; plot_id: string | null } | null
  }[]
  sensors: { id: string; metric: Metric; depth_cm: number | null }[]
  latest: Reading[]
  heat_points: (Reading & { longitude: number; latitude: number })[]
  map_points?: Points
}
export type Imagery = {
  id: string
  farm_id: string
  attribution: string
  license: string
  license_url: string
  bounds: [number, number, number, number]
  minzoom: number
  maxzoom: number
  tiles: string[]
}
