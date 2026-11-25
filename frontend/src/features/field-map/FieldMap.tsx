import { useEffect, useRef, useState } from 'react'
import type { Connection, Imagery, MeasurePoint, Points, Snapshot } from './types'
import { waitForRetry } from './repository'
import { displayReading } from './data'
type Surface = {
  image?: string
  bounds?: number[]
  notice: string
  limits?: number[]
  colors?: string[]
  unit?: string
  time?: string
  uncertainty?: string
  sd_limits?: number[]
  sites?: number
}
export function FieldMap(props: {
  config: Connection
  snapshot: Snapshot
  points: Points
  imagery: Imagery
  metric: string
  depth: string
  heatEnabled: boolean
  opacity: number
  showPoints: boolean
  selected: MeasurePoint | undefined
  onSelect: (id: string | undefined) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [zoom, setZoom] = useState<number>()
  const [result, setResult] = useState<{ key: string; data: Surface }>()
  const { onSelect } = props
  const [variance, setVariance] = useState(false)
  const base = props.config.baseUrl + '/v1/farms/' + encodeURIComponent(props.config.farmId)
  const origin = new URL(base).origin
  const latest = props.points.features.reduce<MeasurePoint | undefined>(
    (a, b) => (!a || b.properties.observed_at > a.properties.observed_at ? b : a),
    undefined,
  )
  const session = latest?.properties.session_id
  const fingerprint = session
    ? props.points.features
        .filter((f) => f.properties.session_id === session)
        .map((f) => f.properties.id)
        .sort()
        .join('|')
    : ''
  const key = [base, session, props.metric, props.depth, fingerprint].join('/')
  const surface = result?.key === key ? result.data : undefined
  useEffect(() => {
    if (!session || !props.heatEnabled) return
    const ctrl = new AbortController()
    const params = new URLSearchParams({ metric: props.metric, session_id: session })
    if (props.metric.startsWith('soil_')) params.set('depth', props.depth)
    async function refresh() {
      while (!ctrl.signal.aborted) {
        try {
          const response = await fetch(base + '/surface?' + params, { signal: ctrl.signal })
          if (response.ok) {
            const data: Surface = await response.json()
            if (!ctrl.signal.aborted) setResult({ key, data })
            return
          }
          if (response.status < 500) {
            setResult({ key, data: { notice: 'Không tải được lớp nội suy.' } })
            return
          }
        } catch {
          if (ctrl.signal.aborted) return
        }
        setResult({ key, data: { notice: 'Đang kết nối lại bộ xử lý nội suy…' } })
        await waitForRetry(ctrl.signal)
      }
    }
    void refresh()
    return () => ctrl.abort()
  }, [base, props.metric, props.depth, session, props.heatEnabled, key])
  useEffect(() => {
    function receive(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow || e.origin !== origin) return
      if (e.data?.closed) onSelect(undefined)
      if (typeof e.data?.id === 'string') onSelect(e.data.id)
      if (typeof e.data?.zoom === 'number') setZoom(e.data.zoom)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [origin, onSelect])
  const sd = variance && !!surface?.uncertainty
  useEffect(() => {
    if (!loaded) return
    const p = props.selected
    frame.current?.contentWindow?.postMessage(
      {
        kind: 'paw-map',
        image: props.imagery,
        points: props.points.features,
        current: props.snapshot.nodes,
        showPoints: props.showPoints,
        opacity: props.opacity,
        surface: props.heatEnabled &&
          surface && { ...surface, image: sd ? surface.uncertainty : surface.image },
        selected: p && {
          id: p.properties.id,
          coords: p.geometry.coordinates,
          text:
            p.properties.node_id +
            ' · ' +
            displayReading(p.properties) +
            ' · GPS ' +
            p.geometry.coordinates.join(', '),
        },
      },
      origin,
    )
  }, [loaded, props, origin, surface, sd])
  const limits = sd ? surface?.sd_limits : surface?.limits
  return (
    <>
      <iframe
        title="Bản đồ Leafmap"
        className="leafmap-frame"
        ref={frame}
        src={base + '/leafmap'}
        onLoad={() => setLoaded(true)}
      />
      <span className="field-camera-status">{zoom}×</span>
      {props.heatEnabled && (
        <div className="field-legend" aria-live="polite">
          {surface?.notice ??
            (session ? 'Đang tính nội suy…' : 'Chưa có phiên đo đồng nhất để nội suy.')}
          {limits && (
            <div>
              {limits[0]?.toFixed(2)}{' '}
              <span
                style={{
                  background:
                    'linear-gradient(to right,' +
                    (sd ? 'white,purple' : surface?.colors?.join(',')) +
                    ')',
                }}
              />{' '}
              {limits[1]?.toFixed(2)} {surface?.unit} · {surface?.sites} vị trí ·{' '}
              {new Date(surface!.time!).toLocaleString('vi-VN')}
            </div>
          )}
          {surface?.uncertainty && (
            <label>
              <input
                type="checkbox"
                checked={variance}
                onChange={(e) => setVariance(e.target.checked)}
              />
              Độ lệch chuẩn dự báo
            </label>
          )}
        </div>
      )}
    </>
  )
}
