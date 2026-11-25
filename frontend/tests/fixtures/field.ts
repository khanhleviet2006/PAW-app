// Isolated protocol fixtures; never imported into src or a production entry point.
import type { Snapshot, Points, Imagery } from '../../src/features/field-map/types'
export const reading = {
  id: 'reading-1',
  node_id: 'COT-01',
  sensor_id: 'sensor-temp',
  deployment_id: 'placement-1',
  plot_id: 'A',
  metric: 'air_temperature' as const,
  unit: '°C',
  depth_cm: null,
  value: 26,
  quality: 'valid',
  observed_at: '2026-11-19T08:00:00Z',
  received_at: '2026-11-19T08:00:01Z',
  measurement_phase: 'UNKNOWN',
  source: 'sensor',
}
export const points: Points = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: reading.id,
      geometry: { type: 'Point', coordinates: [108, 11] },
      properties: reading,
    },
  ],
}
export const snapshot: Snapshot = {
  schema_version: '1.0',
  cursor: 1,
  reference_time: reading.observed_at,
  farm: {
    id: 'farm',
    name: 'Protocol test only',
    source: 'sensor',
    thresholds: {
      air_temperature: [18, 32],
      air_humidity: [45, 90],
      soil_moisture: [20, 60],
      soil_ph: [5.5, 7.5],
    },
  },
  plots: [],
  nodes: [],
  sensors: [
    { id: 'soil20', metric: 'soil_moisture', depth_cm: 20 },
    { id: 'soil40', metric: 'soil_moisture', depth_cm: 40 },
  ],
  latest: [reading],
  heat_points: [{ ...reading, longitude: 108, latitude: 11 }],
}
export const imagery: Imagery = {
  id: 'test-only',
  farm_id: 'farm',
  attribution: 'Test pixels',
  license: 'TEST ONLY',
  license_url: 'https://example.invalid/test',
  bounds: [107, 10, 109, 12],
  minzoom: 10,
  maxzoom: 18,
  tiles: [],
}
