import { describe, expect, it } from 'vitest'
import { mergePoints, filterPoints, EMPTY } from '../src/features/field-map/data'
import { checkSnapshot, parseEvent } from '../src/features/field-map/repository'
import type { Points, Snapshot } from '../src/features/field-map/types'
const reading = {
  id: 'measure-1',
  node_id: 'node-1',
  sensor_id: 'temp',
  deployment_id: 'place-1',
  plot_id: 'A',
  metric: 'air_temperature' as const,
  unit: '°C',
  depth_cm: null,
  value: 26,
  quality: 'valid',
  observed_at: '2026-11-17T08:00:00Z',
  received_at: '2026-11-17T08:00:01Z',
  measurement_phase: 'UNKNOWN',
  source: 'sensor',
}
const points: Points = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'measure-1',
      geometry: { type: 'Point', coordinates: [108, 11] },
      properties: reading,
    },
  ],
}
const snapshot: Snapshot = {
  schema_version: '1.0',
  cursor: 1,
  reference_time: reading.observed_at,
  farm: {
    id: 'f',
    name: 'Test protocol fixture',
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
  sensors: [],
  latest: [reading],
  heat_points: [{ ...reading, longitude: 108, latitude: 11 }],
}
describe('Field map data contract', () => {
  it('retains old GPS points, deduplicates updates and rejects invalid coordinates', () => {
    expect(mergePoints(points, points).features).toHaveLength(1)
    const next = {
      ...points,
      features: [
        {
          ...points.features[0]!,
          geometry: { type: 'Point' as const, coordinates: [108.1, 11] },
          properties: { ...reading, id: 'measure-2' },
        },
      ],
    }
    const merged = mergePoints(points, next)
    expect(merged.features).toHaveLength(2)
    expect(merged.features[0]!.geometry.coordinates).toEqual([108, 11])
    expect(
      mergePoints(EMPTY, {
        ...next,
        features: [{ ...next.features[0]!, geometry: { type: 'Point', coordinates: [NaN, 11] } }],
      }).features,
    ).toHaveLength(0)
  })
  it('filters by metric and rejects simulated farms', () => {
    expect(filterPoints(points, 'soil_moisture', '20').features).toHaveLength(0)
    expect(() =>
      checkSnapshot({ ...snapshot, farm: { ...snapshot.farm, source: 'simulation' } }),
    ).toThrow(/mô phỏng/)
    expect(parseEvent('event: snapshot\ndata: {"a":\ndata: 1}')).toEqual({
      event: 'snapshot',
      data: '{"a":\n1}',
    })
  })
})
