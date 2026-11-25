import { usePreferences } from '../app/preferences'
import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { simulationRuntime as runtime } from '../simulation/runtime'
import { scenarios } from '../simulation/engine'
import type { Scenario } from '../simulation/engine'
import { formatTime } from '../lib/format'
export function SimulationPage() {
  const { mode } = usePreferences()
  useSyncExternalStore(runtime.subscribe, runtime.getVersion, runtime.getVersion)
  const info = runtime.engine.getInfo()
  return (
    <section className="surface">
      <p className="badge">DỮ LIỆU MÔ PHỎNG · DEVELOPMENT</p>
      <h1>Điều khiển mô phỏng cảm biến</h1>
      {mode !== 'DEMO' && (
        <p role="alert">
          Hãy chọn DEMO trong Cài đặt để xem dữ liệu mô phỏng. LIVE không tự chuyển nguồn.
        </p>
      )}
      <p>Panel dành cho phát triển; không điều khiển thiết bị hoặc đưa ra quyết định tưới.</p>
      <p role="status">
        {runtime.enabled
          ? info.running
            ? 'Đang chạy'
            : 'Tạm dừng'
          : 'Chưa bắt đầu · đang xem fixture tĩnh'}{' '}
        · {formatTime(info.time)} · seed {info.seed} · Chu kỳ {info.intervalSeconds} giây
      </p>
      <div className="settings-buttons">
        <button
          className="button primary"
          onClick={runtime.start}
          disabled={runtime.enabled || mode !== 'DEMO'}
        >
          Bắt đầu
        </button>
        <button className="button" onClick={runtime.pause} disabled={!info.running}>
          Tạm dừng
        </button>
        <button
          className="button"
          onClick={runtime.resume}
          disabled={!runtime.enabled || info.running}
        >
          Tiếp tục
        </button>
        <button className="button" onClick={runtime.reset}>
          Đặt lại
        </button>
      </div>
      <div className="history-selectors">
        <label>
          Scenario
          <select
            value={info.scenario}
            onChange={(e) => runtime.setScenario(e.target.value as Scenario)}
          >
            {scenarios.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Tốc độ
          <select value={info.speed} onChange={(e) => runtime.setSpeed(Number(e.target.value))}>
            {[1, 60, 600, 3600].map((s) => (
              <option value={s} key={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Scenario tác động lên A-03. MISSING_SENSOR loại cảm biến pH; INVALID_MEASUREMENT loại mẫu pH
        999 khỏi lịch sử và heatmap.
      </p>
      <button className="button" onClick={runtime.prePaw} disabled={!runtime.enabled}>
        Tạo phiên đo trước tưới DEMO
      </button>
      <p>
        {info.pendingPrePawSession
          ? `Chờ mẫu chu kỳ kế tiếp: ${info.pendingPrePawSession}`
          : 'Mẫu mới mặc định UNKNOWN; chỉ một chu kỳ tiếp theo được gắn phiên PRE_PAW khi chủ động tạo phiên.'}
      </p>
      <p>
        Lịch sử bắt đầu từ lúc khởi tạo engine, không bịa dữ liệu quá khứ. Giữ tối đa 30 ngày ở chu
        kỳ mặc định.
      </p>
      <Link className="button soft" to="/map">
        Mở bản đồ quan trắc (dữ liệu thực)
      </Link>
      <Link className="button" to="/history?plot=A-03">
        Xem lịch sử
      </Link>
      <Link className="button" to="/alerts">
        Xem cảnh báo
      </Link>
      <h2>Mẫu bị loại ({info.diagnostics.length})</h2>
      <pre className="simulation-diagnostics">
        {JSON.stringify(info.diagnostics.slice(-5), null, 2)}
      </pre>
    </section>
  )
}
