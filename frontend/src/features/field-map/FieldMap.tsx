import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Polygon } from 'geojson'
import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl'
import { Map, MapControls, MapPopup } from '../../components/mapcn/Map'
import { useMap } from '../../components/mapcn/context'
import type { Connection, Imagery, MeasurePoint, Points, Snapshot } from './types'
import type { Metric } from '../../types/domain'
import { displayReading } from './data'
import { readHeaders } from './repository'
export function FieldMap(props: {
  config: Connection
  snapshot: Snapshot
  points: Points
  heat: Points
  imagery: Imagery | undefined
  metric: Metric
  heatEnabled: boolean
  opacity: number
  onError: (message: string) => void
  selected: MeasurePoint | undefined
  onSelect: (id: string | undefined) => void
}) {
  const origin = useMemo(() => new URL(props.config.baseUrl).origin, [props.config.baseUrl])
  return (
    <Map
      onError={props.onError}
      transformRequest={(url) => {
        const parsed = new URL(url, location.origin)
        if (parsed.origin !== origin)
          throw new Error('Bản đồ offline từ chối nguồn ngoài máy chủ PAW.')
        return { url: parsed.href, headers: readHeaders(props.config) }
      }}
    >
      <Layers {...props} />
    </Map>
  )
}
function Layers(props: Parameters<typeof FieldMap>[0]) {
  const { map, isLoaded } = useMap(),
    fitted = useRef(false)
  const callback = useRef(props.onSelect)
  useEffect(() => {
    callback.current = props.onSelect
  }, [props.onSelect])
  const [cameraStatus, setCameraStatus] = useState('')
  useEffect(() => {
    if (!map || !isLoaded) return
    for (const id of ['field-plots', 'field-points', 'field-heat', 'field-nodes'])
      map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({
      id: 'field-plots',
      type: 'line',
      source: 'field-plots',
      paint: { 'line-color': '#e6ffe5', 'line-width': 2 },
    })
    map.addLayer({
      id: 'field-heat',
      type: 'heatmap',
      source: 'field-heat',
      paint: {
        'heatmap-weight': ['get', 'weight'],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 18, 50],
        'heatmap-intensity': 0.8,
        'heatmap-opacity': 0.7,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(56,68,180,0)',
          0.15,
          '#6934bd',
          0.4,
          '#277fba',
          0.6,
          '#00b5a8',
          0.8,
          '#24d654',
          1,
          '#e1ee14',
        ],
      },
    })
    map.addLayer({
      id: 'field-points',
      type: 'circle',
      source: 'field-points',
      paint: {
        'circle-radius': 7,
        'circle-color': ['case', ['==', ['get', 'quality'], 'valid'], '#155f42', '#98542a'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    })
    map.addLayer({
      id: 'field-nodes',
      type: 'circle',
      source: 'field-nodes',
      paint: {
        'circle-radius': 11,
        'circle-color': ['case', ['==', ['get', 'connectivity'], 'online'], '#ffffff', '#7e8581'],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#155f42',
        'circle-opacity': 0.7,
      },
    })
    const click = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id
      if (typeof id === 'string') callback.current(id)
    }
    map.on('click', 'field-points', click)
    const move = () => setCameraStatus(`${map.getZoom().toFixed(1)}×`)
    map.on('moveend', move)
    return () => {
      map.off('click', 'field-points', click)
      map.off('moveend', move)
      for (const id of ['field-nodes', 'field-points', 'field-heat', 'field-plots']) {
        if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(id)) map.removeSource(id)
      }
    }
  }, [map, isLoaded])
  useEffect(() => {
    if (!map || !isLoaded) return
    if (map.getLayer('paw-satellite')) map.removeLayer('paw-satellite')
    if (map.getSource('paw-satellite')) map.removeSource('paw-satellite')
    if (!props.imagery) return
    const image = props.imagery
    const tileUrl = `${props.config.baseUrl}/v1/farms/${encodeURIComponent(props.config.farmId)}/imagery/${encodeURIComponent(image.id)}/{z}/{x}/{y}.png`
    map.addSource('paw-satellite', {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
      bounds: image.bounds,
      minzoom: image.minzoom,
      maxzoom: image.maxzoom,
      attribution: image.attribution,
    })
    map.addLayer({ id: 'paw-satellite', type: 'raster', source: 'paw-satellite' }, 'field-plots')
  }, [map, isLoaded, props.imagery, props.config.baseUrl, props.config.farmId])
  useEffect(() => {
    if (!map || !isLoaded) return
    const plots: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: props.snapshot.plots.map((p) => ({
        type: 'Feature',
        geometry: p.geometry,
        properties: { id: p.id },
      })),
    }
    ;(map.getSource('field-plots') as GeoJSONSource).setData(plots)
    ;(map.getSource('field-points') as GeoJSONSource).setData(props.points)
    const [low, high] = props.snapshot.farm.thresholds[props.metric]
    ;(map.getSource('field-heat') as GeoJSONSource).setData({
      ...props.heat,
      features: props.heat.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          weight: 0.1 + 0.9 * Math.max(0, Math.min(1, (f.properties.value - low) / (high - low))),
        },
      })),
    })
    ;(map.getSource('field-nodes') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: props.snapshot.nodes
        .filter((n) => n.position)
        .map((n) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [n.position!.longitude, n.position!.latitude] },
          properties: { id: n.id, connectivity: n.connectivity },
        })),
    })
  }, [map, isLoaded, props.snapshot, props.points, props.heat, props.metric])
  useEffect(() => {
    if (map && isLoaded) {
      map.setLayoutProperty('field-heat', 'visibility', props.heatEnabled ? 'visible' : 'none')
      map.setPaintProperty('field-heat', 'heatmap-opacity', props.opacity)
    }
  }, [map, isLoaded, props.heatEnabled, props.opacity])
  function fit() {
    const coords = props.points.features.map((f) => f.geometry.coordinates)
    for (const p of props.snapshot.plots)
      for (const ring of p.geometry.coordinates) coords.push(...ring)
    if (!coords.length && props.imagery) {
      const [w, s, e, n] = props.imagery.bounds
      coords.push([w, s], [e, n])
    }
    if (!coords.length || !map) return false
    const xs = coords.map((p) => p[0]!),
      ys = coords.map((p) => p[1]!)
    map.fitBounds(
      [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ],
      { padding: 50, maxZoom: 18, duration: 0 },
    )
    return true
  }
  useEffect(() => {
    if (map && isLoaded && !fitted.current) fitted.current = fit()
  })
  return (
    <>
      <MapControls onFit={fit} />
      <span className="field-camera-status">{cameraStatus}</span>
      {props.selected && (
        <MapPopup
          longitude={props.selected.geometry.coordinates[0]!}
          latitude={props.selected.geometry.coordinates[1]!}
          onClose={() => props.onSelect(undefined)}
        >
          <small>Điểm đo đã lưu</small>
          <strong>{props.selected.properties.node_id}</strong>
          <p>{displayReading(props.selected.properties)}</p>
          <p>
            Chất lượng:{' '}
            {{
              valid: 'Hợp lệ',
              invalid: 'Không hợp lệ',
              moving: 'Đang di chuyển',
              stabilizing: 'Đang ổn định',
              uncalibrated: 'Chưa hiệu chuẩn',
            }[props.selected.properties.quality] ?? 'Chưa xác định'}{' '}
            ·{' '}
            {props.selected.properties.measurement_phase === 'PRE_PAW'
              ? 'Phiên đo trước tưới'
              : 'Chưa gắn phiên tưới'}
          </p>
          <p>
            Độ sâu:{' '}
            {props.selected.properties.depth_cm === null
              ? 'Không áp dụng'
              : `${props.selected.properties.depth_cm} cm`}
          </p>
          <p>
            GPS: {props.selected.geometry.coordinates.join(', ')} · Sai số{' '}
            {props.selected.properties.accuracy_m} m
          </p>
          <details>
            <summary>Thông tin lần đặt cột</summary>
            <p>{props.selected.properties.deployment_id}</p>
          </details>
        </MapPopup>
      )}
    </>
  )
}
