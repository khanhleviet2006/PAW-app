import { lazy, Suspense, useState } from 'react'
import type { HistoryRange, MeasurementPhase, Metric } from '../../types/domain'
import { metrics } from '../../types/domain'
import { metricConfig } from '../environmental-layers/config'
import { useHistoryData } from '../../hooks/useHistoryData'
import { formatMeasurement, formatTime } from '../../lib/format'
import { usePreferences } from '../../app/preferences'
const HistoryChart = lazy(() => import('./HistoryChart'))
export function TelemetryHistory({
  plotId,
  initialMetric = 'air_temperature',
  compact = false,
}: {
  plotId: string
  initialMetric?: Metric
  compact?: boolean
}) {
  const { mode } = usePreferences()
  const [metric, setMetric] = useState<Metric>(initialMetric)
  const [range, setRange] = useState<HistoryRange>('24h')
  const [phase, setPhase] = useState<MeasurementPhase | 'ALL'>('ALL')
  const { data, isPending, error, refetch } = useHistoryData({ plotId, metric, range, phase })
  return (
    <section
      className={`telemetry-history ${compact ? 'compact' : ''}`}
      aria-label={`Lịch sử khu ${plotId}`}
    >
      <div className="history-heading">
        <h3>Lịch sử số đo</h3>
        <span className="badge">{mode}</span>
      </div>
      <div className="history-selectors">
        <label>
          Chỉ số
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            {metrics.map((m) => (
              <option key={m} value={m}>
                {metricConfig[m].fullLabel}
              </option>
            ))}
          </select>
        </label>
        <label>
          Khoảng xem
          <select value={range} onChange={(e) => setRange(e.target.value as HistoryRange)}>
            <option value="24h">24 giờ</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
          </select>
        </label>
        <label>
          Giai đoạn đo
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value as MeasurementPhase | 'ALL')}
          >
            <option value="ALL">Tất cả số đo</option>
            <option value="PRE_PAW">Trước tưới PAW · DEMO</option>
            <option value="UNKNOWN">Chưa xác định</option>
          </select>
        </label>
      </div>
      <p className="history-note">
        {mode === 'DEMO'
          ? 'Lịch sử mô phỏng riêng. Mẫu “Trước tưới PAW” có liên kết đợt tưới DEMO; dữ liệu khác giữ “Chưa xác định”.'
          : 'Lịch sử trước tưới LIVE chưa được hỗ trợ: cần hợp đồng API và liên kết đợt tưới được xác minh.'}
      </p>
      {isPending ? (
        <p role="status" className="chart-state">
          Đang tải lịch sử…
        </p>
      ) : error ? (
        <div role="alert" className="chart-state">
          <p>Không tải được lịch sử: {error.message}</p>
          <button className="button" onClick={() => void refetch()}>
            Thử lại lịch sử
          </button>
        </div>
      ) : !data?.length ? (
        <p role="status" className="chart-state">
          Chưa có số đo cho chỉ số và khoảng thời gian này.
        </p>
      ) : (
        <>
          <p className="history-count">
            {data.length} số đo · {metricConfig[metric].unit} · {formatTime(data[0]?.observedAt)} →{' '}
            {formatTime(data.at(-1)?.observedAt)}
          </p>
          <Suspense fallback={<p role="status">Đang tải biểu đồ…</p>}>
            <HistoryChart measurements={data} unit={metricConfig[metric].unit} />
          </Suspense>
          <details className="history-table">
            <summary>Xem bảng số liệu ({Math.min(24, data.length)} mẫu gần nhất)</summary>
            <div className="table-scroll">
              <table>
                <caption>Số đo DEMO khu {plotId}; thời gian UTC+7</caption>
                <thead>
                  <tr>
                    <th scope="col">Thời điểm đo</th>
                    <th scope="col">Giá trị</th>
                    <th scope="col">Giai đoạn</th>
                    <th scope="col">Đợt tưới</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .slice(-24)
                    .reverse()
                    .map((m) => (
                      <tr key={`${m.observedAt}-${m.sensorId}`}>
                        <td>{formatTime(m.observedAt)}</td>
                        <td>{formatMeasurement(m)}</td>
                        <td>
                          {m.measurement_phase === 'PRE_PAW'
                            ? 'Trước tưới · DEMO'
                            : 'Chưa xác định'}
                        </td>
                        <td>{m.irrigationEventId ?? 'Chưa có'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  )
}
