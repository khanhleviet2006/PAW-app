import { Link } from 'react-router-dom'
import { Bell, ChevronRight } from 'lucide-react'
import { useFarmData } from '../hooks/useFarmData'
import { usePreferences } from '../app/preferences'
import { metrics } from '../types/domain'
import {
  measurementStatus,
  statusLabels,
  statusSymbols,
} from '../features/environmental-layers/status'
import { metricConfig } from '../features/environmental-layers/config'
import { formatMeasurement, formatTime } from '../lib/format'
export function AlertsPage() {
  const { data, isPending, error, refetch } = useFarmData()
  const { thresholds } = usePreferences()
  const alerts =
    data?.snapshots.flatMap((snapshot) =>
      metrics.flatMap((metric) => {
        const status = measurementStatus(snapshot, metric, data.referenceTime, thresholds)
        return status === 'normal'
          ? []
          : [
              {
                plotId: snapshot.plotId,
                metric,
                status,
                measurement: snapshot.measurements[metric],
                reason: snapshot.invalidMetrics?.[metric],
              },
            ]
      }),
    ) ?? []
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tình trạng cần chú ý</p>
          <h1>Cảnh báo môi trường</h1>
          <p>Cảnh báo dựa trên ngưỡng minh họa và trạng thái dữ liệu; không phải chỉ dẫn tưới.</p>
        </div>
        <Bell size={25} />
      </div>
      {isPending ? (
        <p role="status">Đang tải cảnh báo…</p>
      ) : error ? (
        <div className="surface" role="alert">
          <p>{error.message}</p>
          <button className="button" onClick={() => void refetch()}>
            Thử lại
          </button>
        </div>
      ) : (
        <section className="surface">
          <div className="history-heading">
            <h2>{alerts.length} mục cần chú ý</h2>
            <span className="badge">{data?.mode}</span>
          </div>
          <div className="alerts-list">
            {alerts.length ? (
              alerts.map((a) => (
                <Link
                  className={`alert-row status-${a.status}`}
                  key={`${a.plotId}-${a.metric}`}
                  to={`/map?plot=${a.plotId}`}
                >
                  <span className="alert-symbol">{statusSymbols[a.status]}</span>
                  <span>
                    <strong>
                      Khu {a.plotId} · {metricConfig[a.metric].label}
                    </strong>
                    <small>
                      {a.reason ?? statusLabels[a.status]} · {formatMeasurement(a.measurement)}
                      <br />
                      {formatTime(a.measurement?.observedAt)}
                    </small>
                  </span>
                  <ChevronRight size={18} />
                </Link>
              ))
            ) : (
              <p role="status">Không có mục cần chú ý theo ngưỡng hiện tại.</p>
            )}
          </div>
        </section>
      )}
    </>
  )
}
