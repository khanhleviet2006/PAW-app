import { metrics } from '../../types/domain'
import type { Metric } from '../../types/domain'
import { metricConfig } from './config'
export function LayerSwitcher({
  metric,
  onChange,
}: {
  metric: Metric
  onChange: (metric: Metric) => void
}) {
  return (
    <div className="layer-switcher" role="group" aria-label="Lớp dữ liệu">
      <span className="layer-label">Lớp hiển thị</span>
      {metrics.map((key) => {
        const { icon: Icon, label } = metricConfig[key]
        return (
          <button key={key} aria-pressed={metric === key} onClick={() => onChange(key)}>
            <Icon size={17} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
