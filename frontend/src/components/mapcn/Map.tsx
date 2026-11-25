// Adapted MapCN Map/Controls/Popup subset (MIT), upstream fd8ce8f.
// PAW changes: local worker, no Carto/CDN defaults, fixed style and one instance per mount.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as maplibre from 'maplibre-gl'
import type { MapOptions, StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Minus, Plus, LocateFixed } from 'lucide-react'
import { MapContext, useMap } from './context'
maplibre.setWorkerUrl(workerUrl)
const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#dce5dc' } }],
}
export function Map({
  children,
  transformRequest,
  onError,
}: {
  children: ReactNode
  transformRequest: MapOptions['transformRequest']
  onError: (message: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const options = useRef({ transformRequest, onError })
  const [value, setValue] = useState<{ map: maplibre.Map | null; isLoaded: boolean }>({
    map: null,
    isLoaded: false,
  })
  useEffect(() => {
    if (!container.current) return
    const map = new maplibre.Map({
      container: container.current,
      style: EMPTY_STYLE,
      center: [0, 0],
      zoom: 1,
      renderWorldCopies: false,
      transformRequest: options.current.transformRequest,
      attributionControl: { compact: true },
    })
    map.on('load', () => setValue({ map, isLoaded: true }))
    map.on('error', () =>
      options.current.onError(
        'Không tải được bản đồ hoặc tile nội bộ. Kiểm tra bộ ảnh và quyền truy cập PAW.',
      ),
    )
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [])
  return (
    <MapContext.Provider value={value}>
      <div className="paw-mapcn" ref={container}>
        {value.map && children}
      </div>
    </MapContext.Provider>
  )
}
export function MapControls({ onFit }: { onFit: () => void }) {
  const { map } = useMap()
  return (
    <div className="mapcn-controls" aria-label="Điều khiển bản đồ GPS">
      <button aria-label="Phóng to GPS" onClick={() => map?.zoomIn()}>
        <Plus />
      </button>
      <button aria-label="Thu nhỏ GPS" onClick={() => map?.zoomOut()}>
        <Minus />
      </button>
      <button aria-label="Vừa các điểm GPS" onClick={onFit}>
        <LocateFixed />
      </button>
    </div>
  )
}
export function MapPopup({
  longitude,
  latitude,
  children,
  onClose,
}: {
  longitude: number
  latitude: number
  children: ReactNode
  onClose: () => void
}) {
  const { map } = useMap()
  const container = useMemo(() => document.createElement('div'), [])
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!map) return
    const popup = new maplibre.Popup({ offset: 12, maxWidth: '300px', closeButton: false })
      .setLngLat([longitude, latitude])
      .setDOMContent(container)
      .addTo(map)
    const handleClose = () => close.current()
    popup.on('close', handleClose)
    // React portal content may grow after addTo; re-evaluate the popup anchor.
    const observer = new ResizeObserver(() => popup.setLngLat([longitude, latitude]))
    observer.observe(container)
    return () => {
      observer.disconnect()
      popup.off('close', handleClose)
      popup.remove()
    }
  }, [map, container, longitude, latitude])
  return createPortal(
    <section className="field-popup" aria-label="Thông tin điểm đo">
      <button className="icon-button" onClick={onClose} aria-label="Đóng thông tin điểm">
        ×
      </button>
      {children}
    </section>,
    container,
  )
}
