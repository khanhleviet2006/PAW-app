import { useState } from 'react'
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CheckCircle2,
  Clock3,
  MapPin,
  Radio,
  TriangleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { metrics } from '../../types/domain'
import type { FarmData, Metric, Plot } from '../../types/domain'
import { formatMeasurement, formatTime, number } from '../../lib/format'
import { usePreferences } from '../../app/preferences'
import { metricConfig } from '../environmental-layers/config'
import { measurementStatus, statusLabels, statusSymbols } from '../environmental-layers/status'
import { TelemetryHistory } from '../telemetry-history/TelemetryHistory'
export function AreaDetails({
  plot,
  data,
  metric,
  fullHistory = false,
}: {
  plot: Plot
  data: FarmData
  metric: Metric
  fullHistory?: boolean
}) {
  const { thresholds } = usePreferences()
  const [showHistory, setShowHistory] = useState(false)
  const snapshot = data.snapshots.find((s) => s.plotId === plot.id)
  const measurements = Object.values(snapshot?.measurements ?? {})
  const states = metrics.map((m) => measurementStatus(snapshot, m, data.referenceTime, thresholds))
  const status = states.includes('offline')
    ? 'offline'
    : states.includes('stale')
      ? 'stale'
      : states.includes('warning')
        ? 'warning'
        : states.includes('no-data')
          ? 'no-data'
          : 'normal'
  const observed = measurements
    .map((m) => m.observedAt)
    .sort()
    .at(-1)
  const received = measurements
    .flatMap((m) => (m.receivedAt ? [m.receivedAt] : []))
    .sort()
    .at(-1)
  return (
    <div className="panel-body">
      <div className="plot-meta">
        <span>
          <MapPin size={15} />
          {plot.areaHa === undefined ? 'Chưa có diện tích' : `${number(plot.areaHa, 2)} ha`}
        </span>
        <span>
          <Radio size={15} />
          {plot.sensorIds.length} cảm biến
        </span>
      </div>
      <p className="plot-name">{plot.name}</p>
      <div className={`status-banner status-${status}`}>
        {status === 'normal' ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
        <span>
          {status === 'no-data'
            ? 'Có cảm biến chưa cấu hình / chưa có số đo'
            : statusLabels[status]}
        </span>
      </div>
      <div className="section-heading">
        <h3>Số đo gần nhất</h3>
        <span>{data.mode}</span>
      </div>
      <p className="phase-note">
        Giai đoạn được ghi riêng cho từng số đo; không mặc định trước tưới.
      </p>
      <div className="measurement-list">
        {metrics.map((key) => {
          const { icon: Icon, label } = metricConfig[key]
          const m = snapshot?.measurements[key]
          const state = measurementStatus(snapshot, key, data.referenceTime, thresholds)
          const hasSensor = data.farm.sensors.some(
            (s) => plot.sensorIds.includes(s.id) && s.metric === key,
          )
          return (
            <article
              className={`measurement-card status-${state}`}
              key={key}
              aria-label={metricConfig[key].fullLabel}
            >
              <div className="measurement-value">
                <span>
                  <Icon size={20} />
                  {label}
                </span>
                <strong>{m ? formatMeasurement(m) : '—'}</strong>
              </div>
              <div className="measurement-meta">
                <span>
                  {statusSymbols[state]}{' '}
                  {snapshot?.invalidMetrics?.[key] ??
                    (m ? statusLabels[state] : hasSensor ? 'Chưa có dữ liệu' : 'Chưa có cảm biến')}
                </span>
                {m && <time dateTime={m.observedAt}>{formatTime(m.observedAt)}</time>}
              </div>
              {m && (
                <p className="source-label">
                  {m.sourceLabel} ·{' '}
                  {m.measurement_phase === 'PRE_PAW'
                    ? `Trước tưới DEMO · ${m.irrigationEventId}`
                    : 'Chưa xác định trước tưới'}
                  {key === 'soil_moisture' && !m.calibrated ? ' · Chưa hiệu chuẩn, đơn vị raw' : ''}
                </p>
              )}
            </article>
          )
        })}
      </div>
      <div className="update-times">
        <Clock3 size={16} />
        <div>
          <p>Đo gần nhất: {formatTime(observed)}</p>
          <p>Nhận gần nhất: {formatTime(received)}</p>
          <p>Thời gian hiển thị: UTC+7</p>
        </div>
      </div>
      <button
        className="button soft history-toggle"
        aria-expanded={showHistory}
        onClick={() => setShowHistory(!showHistory)}
      >
        <ChartNoAxesCombined size={19} />
        {showHistory ? 'Ẩn lịch sử khu vực' : 'Xem lịch sử khu vực'}
        <ArrowUpRight size={17} />
      </button>
      {(showHistory || fullHistory) && (
        <TelemetryHistory plotId={plot.id} initialMetric={metric} compact />
      )}
      <Link className="detail-history-link" to={`/history?plot=${encodeURIComponent(plot.id)}`}>
        Mở trang lịch sử đầy đủ <ArrowUpRight size={14} />
      </Link>
      <p className="panel-disclaimer">
        Chỉ quan trắc môi trường. Không tự động đưa ra quyết định tưới PAW.
      </p>
    </div>
  )
}
