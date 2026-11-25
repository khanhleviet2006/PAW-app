import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldMap } from '../src/features/field-map/FieldMap'
import { currentHeat, mergePoints, filterPoints, EMPTY } from '../src/features/field-map/data'
import { checkSnapshot, parseEvent } from '../src/features/field-map/repository'
import type { Snapshot, Points, Imagery } from '../src/features/field-map/types'
const state = vi.hoisted(() => ({ maps: [] as unknown[], styleCalls: vi.fn(), removed: vi.fn() }))
const { FakeMap } = vi.hoisted(() => {
  class FakeSource {
    setData = vi.fn()
  }
  class FakeMap {
    sources = new globalThis.Map<string, FakeSource>()
    layers = new Set<string>()
    canvas = document.createElement('canvas')
    constructor() {
      state.maps.push(this)
    }
    on(name: string) {
      if (name === 'load') queueMicrotask(() => this.loaded?.())
      return this
    }
    loaded?: () => void
    off() {}
    remove() {
      state.removed()
    }
    resize() {}
    zoomIn() {}
    zoomOut() {}
    fitBounds = vi.fn()
    getZoom() {
      return 17
    }
    addSource(id: string) {
      this.sources.set(id, new FakeSource())
    }
    getSource(id: string) {
      return this.sources.get(id)
    }
    removeSource(id: string) {
      this.sources.delete(id)
    }
    addLayer(layer: { id: string }) {
      this.layers.add(layer.id)
    }
    getLayer(id: string) {
      return this.layers.has(id)
    }
    removeLayer(id: string) {
      this.layers.delete(id)
    }
    setLayoutProperty = vi.fn()
    setPaintProperty = vi.fn()
    getCanvas() {
      return this.canvas
    }
  }
  return { FakeMap }
})
vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  Map: class extends FakeMap {
    on(name: string, ...args: unknown[]) {
      if (name === 'load') this.loaded = args[0] as () => void
      return super.on(name)
    }
  },
  Popup: class {
    setLngLat() {
      return this
    }
    setDOMContent() {
      return this
    }
    addTo() {
      return this
    }
    on() {
      return this
    }
    off() {}
    remove() {}
  },
}))
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
const imagery: Imagery = {
  id: 'test-only',
  farm_id: 'f',
  attribution: 'Test fixture',
  license: 'Test only',
  license_url: 'https://example.invalid',
  bounds: [107, 10, 109, 12],
  minzoom: 10,
  maxzoom: 18,
  tiles: [],
}
describe('Field map persistent instance and real-data contract', () => {
  it('updates source data and heat visibility without constructing another map or reloading raster', async () => {
    state.maps = []
    state.removed.mockClear()
    const props = {
      config: { baseUrl: 'http://localhost:8000', farmId: 'f', token: 'test-key' },
      snapshot,
      points,
      heat: points,
      imagery,
      metric: 'air_temperature' as const,
      heatEnabled: true,
      opacity: 0.65,
      onError: vi.fn(),
      selected: undefined,
      onSelect: vi.fn(),
    }
    const view = render(<FieldMap {...props} />)
    await waitFor(() =>
      expect(
        (state.maps[0] as InstanceType<typeof FakeMap>).getSource('field-points'),
      ).toBeDefined(),
    )
    const map = state.maps[0] as InstanceType<typeof FakeMap>,
      raster = map.getSource('paw-satellite')
    const next = mergePoints(points, {
      ...points,
      features: [
        {
          ...points.features[0]!,
          id: 'measure-2',
          properties: { ...reading, id: 'measure-2', value: 28 },
        },
      ],
    })
    await act(async () =>
      view.rerender(
        <FieldMap
          {...props}
          snapshot={{ ...snapshot, cursor: 2 }}
          points={next}
          heatEnabled={false}
        />,
      ),
    )
    expect(state.maps).toHaveLength(1)
    expect(map.getSource('paw-satellite')).toBe(raster)
    expect(map.getSource('field-points')!.setData).toHaveBeenLastCalledWith(next)
    expect(map.setLayoutProperty).toHaveBeenLastCalledWith('field-heat', 'visibility', 'none')
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(state.removed).toHaveBeenCalledOnce()
  })
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
  it('separates depth and metric; only current backend-approved readings enter heatmap', () => {
    expect(filterPoints(points, 'soil_moisture', '20').features).toHaveLength(0)
    expect(currentHeat(snapshot, 'air_temperature', '20').features).toHaveLength(1)
    expect(
      currentHeat(
        { ...snapshot, heat_points: [{ ...snapshot.heat_points[0]!, quality: 'invalid' }] },
        'air_temperature',
        '20',
      ).features,
    ).toHaveLength(0)
    expect(() =>
      checkSnapshot({ ...snapshot, farm: { ...snapshot.farm, source: 'simulation' } }),
    ).toThrow(/mô phỏng/)
    expect(parseEvent('event: snapshot\ndata: {"a":\ndata: 1}')).toEqual({
      event: 'snapshot',
      data: '{"a":\n1}',
    })
  })
})
