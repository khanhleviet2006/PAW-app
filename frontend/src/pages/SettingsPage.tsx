import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, RotateCcw, Save, Settings2 } from 'lucide-react'
import { usePreferences } from '../app/preferences'
import { DEFAULT_THRESHOLDS, metricConfig } from '../features/environmental-layers/config'
import { metrics } from '../types/domain'
import { createApiClient } from '../services/api/client'
export function SettingsPage() {
  const { mode, setMode, thresholds, setThresholds } = usePreferences()
  const [draft, setDraft] = useState(() => structuredClone(thresholds))
  const [message, setMessage] = useState('')
  const [probe, setProbe] = useState('')
  const [probing, setProbing] = useState(false)
  const baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? ''
  function save(event: FormEvent) {
    event.preventDefault()
    if (
      metrics.some(
        (m) =>
          !Number.isFinite(draft[m].min) ||
          !Number.isFinite(draft[m].max) ||
          draft[m].min >= draft[m].max,
      )
    ) {
      setMessage('Ngưỡng không hợp lệ: giá trị thấp phải nhỏ hơn giá trị cao.')
      return
    }
    setThresholds(structuredClone(draft))
    setMessage('Đã áp dụng ngưỡng minh họa cho phiên làm việc này.')
  }
  async function checkHealth() {
    setProbing(true)
    setProbe('Đang kiểm tra kết nối…')
    try {
      await createApiClient(baseUrl).health()
      setProbe('API /health trả HTTP thành công. Chưa xác minh schema, số đo hoặc lịch sử LIVE.')
    } catch (error) {
      setProbe(error instanceof Error ? error.message : 'Không kết nối được API.')
    } finally {
      setProbing(false)
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Tùy chỉnh không gian</p>
          <h1>Cài đặt</h1>
          <p>Ngưỡng hiển thị trong chế độ mô phỏng.</p>
        </div>
        <Settings2 size={25} />
      </div>
      <div className="settings-grid">
        {import.meta.env.DEV && (
          <section className="surface">
            <h2>Nguồn dữ liệu</h2>
            <p className="settings-note">
              DEMO dùng số liệu mô phỏng cố định. LIVE chỉ dùng dữ liệu thật sau khi hợp đồng API
              được xác minh.
            </p>
            <label className="field">
              Chế độ dữ liệu
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value === 'LIVE' ? 'LIVE' : 'DEMO')}
              >
                <option value="DEMO">DEMO — Mô phỏng</option>
                <option value="LIVE">LIVE — Chưa tích hợp</option>
              </select>
            </label>
            <div className="integration-note">
              <AlertCircle size={19} />
              <p>
                LIVE chưa sẵn sàng. Không tự chuyển sang DEMO khi API lỗi. Cần người quản trị hoàn
                tất tích hợp để xem số đo thật.
              </p>
            </div>
            <button
              className="button"
              disabled={!baseUrl || probing}
              onClick={() => void checkHealth()}
            >
              Kiểm tra kết nối API
            </button>
            <p className="settings-note">
              {baseUrl
                ? 'Đã cấu hình địa chỉ API. Kiểm tra kết nối không đồng nghĩa dữ liệu LIVE đã được xác minh.'
                : 'Chưa cấu hình địa chỉ API. Xem hướng dẫn dành cho người quản trị trong README.'}
            </p>
            <p role="status" className="settings-note">
              {probe}
            </p>
          </section>
        )}
        <section className="surface">
          <h2>Ngưỡng màu minh họa</h2>
          <p className="settings-note">
            Các ngưỡng này chỉ phục vụ DEMO và được giữ trong phiên hiện tại. Không phải khuyến nghị
            nông học hoặc ngưỡng kích hoạt tưới.
          </p>
          <form onSubmit={save}>
            <div className="threshold-head">
              <span>Chỉ số</span>
              <span>Thấp</span>
              <span>Cao</span>
            </div>
            {metrics.map((metric) => (
              <fieldset className="threshold-row" key={metric}>
                <legend className="sr-only">{metricConfig[metric].label}</legend>
                <span>
                  {metricConfig[metric].label}
                  <small>{metricConfig[metric].unit}</small>
                </span>
                {(['min', 'max'] as const).map((edge) => (
                  <label key={edge}>
                    <span className="sr-only">
                      {metricConfig[metric].label} — {edge === 'min' ? 'thấp' : 'cao'}
                    </span>
                    <input
                      type="number"
                      required
                      step={metricConfig[metric].step}
                      value={Number.isNaN(draft[metric][edge]) ? '' : draft[metric][edge]}
                      onChange={(e) => {
                        setDraft({
                          ...draft,
                          [metric]: { ...draft[metric], [edge]: e.target.valueAsNumber },
                        })
                        setMessage('')
                      }}
                    />
                  </label>
                ))}
              </fieldset>
            ))}
            <div className="settings-buttons">
              <button className="button primary" type="submit">
                <Save size={17} />
                Áp dụng
              </button>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setDraft(structuredClone(DEFAULT_THRESHOLDS))
                  setThresholds(structuredClone(DEFAULT_THRESHOLDS))
                  setMessage('Đã khôi phục ngưỡng DEMO mặc định.')
                }}
              >
                <RotateCcw size={17} />
                Mặc định
              </button>
            </div>
            <p role="status" className="settings-note">
              {message}
            </p>
          </form>
        </section>
      </div>
    </>
  )
}
