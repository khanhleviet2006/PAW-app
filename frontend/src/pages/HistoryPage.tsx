import { useSearchParams } from 'react-router-dom'
import { useFarmData } from '../hooks/useFarmData'
import { TelemetryHistory } from '../features/telemetry-history/TelemetryHistory'
export function HistoryPage() {
  const { data, isPending, error, refetch } = useFarmData()
  const [params, setParams] = useSearchParams()
  const plotId = params.get('plot') ?? 'A-03'
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Diễn biến môi trường</p>
          <h1>Lịch sử quan trắc</h1>
          <p>Theo dõi theo chỉ số, khoảng thời gian và giai đoạn đo.</p>
        </div>
      </div>
      {isPending ? (
        <p role="status">Đang tải khu vườn…</p>
      ) : error ? (
        <div className="surface" role="alert">
          <p>{error.message}</p>
          <button className="button" onClick={() => void refetch()}>
            Thử lại
          </button>
        </div>
      ) : (
        data && (
          <section className="surface history-page">
            <label className="field">
              Khu vực
              <select value={plotId} onChange={(e) => setParams({ plot: e.target.value })}>
                {data.farm.plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            {data.farm.plots.length === 0 ? (
              <p>Chưa có vùng đất được cấu hình.</p>
            ) : data.farm.plots.some((p) => p.id === plotId) ? (
              <TelemetryHistory key={plotId} plotId={plotId} />
            ) : (
              <p role="status">Không tìm thấy khu vực này.</p>
            )}
          </section>
        )
      )}
    </>
  )
}
