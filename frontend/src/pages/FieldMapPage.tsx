import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, MapPin, Radio, SlidersHorizontal } from 'lucide-react'
import { FieldMap } from '../features/field-map/FieldMap'
import {
  createFieldRepository,
  bootstrapViewer,
  waitForRetry,
} from '../features/field-map/repository'
import {
  EMPTY,
  filterPoints,
  mergePoints,
  selectPoint,
  displayReading,
} from '../features/field-map/data'
import type { Connection, Imagery, Metric, Points, Snapshot } from '../features/field-map/types'
import { metricConfig } from '../features/environmental-layers/config'
import { metrics } from '../types/domain'
export function FieldMapPage() {
  const [connection, setConnection] = useState<Connection>(),
    [snapshot, setSnapshot] = useState<Snapshot>(),
    [points, setPoints] = useState<Points>(EMPTY),
    [imagery, setImagery] = useState<Imagery>()
  const [streamLive, setStreamLive] = useState(false),
    [status, setStatus] = useState('Đang kết nối khu quan trắc…'),
    [error, setError] = useState(''),
    [metric, setMetric] = useState<Metric>('air_temperature'),
    [showPoints, setShowPoints] = useState(true),
    [depth, setDepth] = useState('20'),
    [heatEnabled, setHeatEnabled] = useState(true),
    [opacity, setOpacity] = useState(0.65),
    [selected, setSelected] = useState<string>(),
    [tools, setTools] = useState(false),
    [search, setSearch] = useState('')
  useEffect(() => {
    const controller = new AbortController(),
      signal = controller.signal
    const apply = (data: Snapshot) => {
      setSnapshot(data)
      if (data.map_points) setPoints((old) => mergePoints(old, data.map_points!))
    }
    let historyLoading = false,
      connectedOnce = false
    let repo: ReturnType<typeof createFieldRepository>
    async function loadHistory() {
      if (historyLoading) return
      historyLoading = true
      try {
        while (!signal.aborted) {
          try {
            await repo.history(signal, (page) => {
              if (!signal.aborted) setPoints((old) => mergePoints(old, page))
            })
            if (!signal.aborted) setError('')
            return
          } catch {
            if (signal.aborted) return
            setError('Chưa đồng bộ đầy đủ lịch sử. Hệ thống đang tự thử lại.')
            await waitForRetry(signal)
          }
        }
      } finally {
        historyLoading = false
      }
    }
    async function start() {
      while (!signal.aborted) {
        try {
          const config = await bootstrapViewer(signal)
          repo = createFieldRepository(config)
          const [data, image] = await Promise.all([repo.snapshot(signal), repo.imagery(signal)])
          if (signal.aborted) return
          setConnection(config)
          apply(data)
          setImagery(image ?? undefined)
          await loadHistory()
          setError('')
          await repo.subscribe(signal, apply, (message) => {
            if (signal.aborted) return
            const live = message.startsWith('Đang nhận')
            setStreamLive(live)
            if (live) {
              setError('')
              if (connectedOnce)
                void loadHistory().catch(() =>
                  setError('Chưa đồng bộ đầy đủ lịch sử. Hệ thống đang tự thử lại.'),
                )
              connectedOnce = true
            }
            setStatus(live ? 'Đang cập nhật số đo' : message)
          })
        } catch (err) {
          if (signal.aborted) return
          setStreamLive(false)
          setStatus('Mất kết nối — đang tự kết nối lại…')
          setError(err instanceof Error ? err.message : 'Không kết nối được máy chủ PAW.')
        }
        await waitForRetry(signal)
      }
    }
    void start()
    return () => controller.abort()
  }, [])
  const visible = useMemo(() => filterPoints(points, metric, depth), [points, metric, depth])
  const selectedPoint = useMemo(
    () => (selected ? selectPoint(points, selected) : undefined),
    [points, selected],
  )
  const depths = useMemo(
    () =>
      [
        ...new Set(
          snapshot?.sensors
            .filter((s) => s.metric === metric && s.depth_cm !== null)
            .map((s) => s.depth_cm!) ?? [],
        ),
      ].sort((a, b) => a - b),
    [snapshot, metric],
  )
  const listed = useMemo(
    () =>
      visible.features
        .filter((f) =>
          f.properties.node_id.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
        )
        .sort((a, b) => b.properties.observed_at.localeCompare(a.properties.observed_at))
        .slice(0, 200),
    [visible, search],
  )
  function chooseMetric(next: Metric) {
    setMetric(next)
    setSelected(undefined)
    const first = snapshot?.sensors
      .filter((s) => s.metric === next && s.depth_cm !== null)
      .map((s) => s.depth_cm!)
      .sort((a, b) => a - b)[0]
    if (first !== undefined) setDepth(String(first))
  }
  function pick(id: string | undefined) {
    setSelected(id)
    if (id) {
      setTools(false)
      document
        .getElementById('paw-satellite-region')
        ?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    }
  }
  return (
    <section className="field-workspace user-map" aria-label="Bản đồ quan trắc PAW">
      <header className="field-heading">
        <div>
          <h1>Bản đồ khu vực quan trắc</h1>
          <p>PAW — Bản đồ vệ tinh nội bộ</p>
        </div>
        <div className="field-heading-actions">
          <span className="local-map-badge">Offline</span>
        </div>
      </header>
      {error && (
        <p className="field-warning" role="alert">
          {error}
        </p>
      )}
      <div className="field-map-stage" id="paw-satellite-region" aria-label="Khu vực ảnh vệ tinh">
        {connection && snapshot && imagery ? (
          <FieldMap
            config={connection}
            snapshot={snapshot}
            points={visible}
            showPoints={showPoints}
            depth={depth}
            imagery={imagery}
            metric={metric}
            heatEnabled={heatEnabled}
            opacity={opacity}
            selected={selectedPoint}
            onSelect={pick}
          />
        ) : (
          <div className="field-map-empty" role="status">
            <MapPin size={32} />
            <strong>
              {connection && snapshot
                ? 'Chưa cài đặt dữ liệu ảnh vệ tinh khu vực'
                : 'Đang kết nối khu quan trắc…'}
            </strong>
            <p>
              {connection && snapshot
                ? 'Liên hệ người quản trị để cài đặt ảnh khu vực.'
                : 'Ảnh và số đo được cung cấp qua mạng nội bộ PAW.'}
            </p>
          </div>
        )}
        {snapshot && imagery && (
          <>
            <details className="field-tools" open={tools}>
              <summary
                onClick={(e) => {
                  e.preventDefault()
                  setTools((v) => !v)
                }}
              >
                <SlidersHorizontal size={17} /> Thông số hiển thị
              </summary>
              <div>
                <label>
                  Thông số
                  <select value={metric} onChange={(e) => chooseMetric(e.target.value as Metric)}>
                    {([...metrics, 'solar_radiation'] as Metric[]).map((m) => (
                      <option key={m} value={m}>
                        {m === 'solar_radiation' ? 'Bức xạ mặt trời' : metricConfig[m].fullLabel}
                      </option>
                    ))}
                  </select>
                </label>
                {metric.startsWith('soil_') && (
                  <label>
                    Độ sâu (cm)
                    <select
                      value={depth}
                      onChange={(e) => {
                        setDepth(e.target.value)
                        setSelected(undefined)
                      }}
                    >
                      {depths.map((d) => (
                        <option value={d} key={d}>
                          {d} cm
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={heatEnabled}
                    onChange={(e) => setHeatEnabled(e.target.checked)}
                  />{' '}
                  Hiển thị heatmap
                </label>
                <label>
                  Độ đậm heatmap
                  <input
                    aria-label="Độ đậm heatmap"
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showPoints}
                    onChange={(e) => setShowPoints(e.target.checked)}
                  />
                  Điểm đo lịch sử
                </label>
              </div>
            </details>
          </>
        )}
      </div>
      <footer className="field-footer">
        <h2>
          <MapPin size={18} /> Vị trí đo GPS và phân bố môi trường
        </h2>
        <span className={`field-link-state ${streamLive ? 'connected' : ''}`}>
          <Radio size={14} />
          <span role="status">
            {status}
            {!streamLive && snapshot
              ? ` · Giữ dữ liệu lúc ${new Date(snapshot.reference_time).toLocaleString('vi-VN')}`
              : ''}
          </span>
        </span>
      </footer>
      {snapshot && (
        <details className="field-history">
          <summary>
            <span>
              {visible.features.length} điểm đo đã lưu · {snapshot.nodes.length} cột cảm biến
            </span>
            <ChevronDown size={18} />
          </summary>
          <div>
            <label>
              Tìm cột cảm biến
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập mã cột"
              />
            </label>
            <p>
              Thời gian dữ liệu: {new Date(snapshot.reference_time).toLocaleString('vi-VN')}. Điểm
              cũ được giữ nguyên khi cột di chuyển.
            </p>
            {listed.length === 0 ? (
              <p>Chưa có điểm đo phù hợp.</p>
            ) : (
              <div className="field-point-list">
                {listed.map((f) => (
                  <button
                    className="button"
                    key={f.properties.id}
                    onClick={() => pick(f.properties.id)}
                    disabled={!imagery}
                  >
                    {f.properties.node_id} · {displayReading(f.properties)}
                  </button>
                ))}
              </div>
            )}
            {visible.features.length > 200 && (
              <p>
                Danh sách hiển thị tối đa 200 điểm mới nhất phù hợp bộ lọc. Bản đồ vẫn giữ toàn bộ
                điểm đã tải.
              </p>
            )}
          </div>
        </details>
      )}
    </section>
  )
}
