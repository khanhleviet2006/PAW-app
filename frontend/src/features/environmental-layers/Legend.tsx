import { ChevronDown } from 'lucide-react'
import type { Metric } from '../../types/domain'
import { number } from '../../lib/format'
import { heatDomains } from './config'
import { HEAT_COLORS } from '../farm-map/heatmap'
import { metricConfig } from './config'
export function Legend({ metric, statusLayer = false }: { metric: Metric; statusLayer?: boolean }) {
  const { min, max } = heatDomains[metric]

  return (
    <details open className="map-legend" aria-label={`Chú giải ${metricConfig[metric].label}`}>
      <summary aria-label="Đóng hoặc mở chú giải">
        <strong>
          {statusLayer ? 'Trạng thái vùng đất' : metricConfig[metric].label}{' '}
          {!statusLayer && <span>({metricConfig[metric].unit})</span>}
        </strong>
        <ChevronDown size={15} />
      </summary>
      {!statusLayer && (
        <div>
          <div
            className="heat-gradient"
            style={{ background: `linear-gradient(90deg, ${HEAT_COLORS.join(',')})` }}
          />
          <div className="heat-ticks">
            {HEAT_COLORS.map((color, i) => (
              <span key={color}>
                {i === 0 ? '≤' : i === 4 ? '≥' : ''}
                {number(min + ((max - min) * i) / 4)}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="legend-status">
        <span>
          <i style={{ background: '#c78a43' }} />! Cảnh báo (nhãn)
        </span>
        <span>
          <i style={{ background: '#758078' }} />× Mất kết nối
        </span>
        <span>
          <i style={{ background: '#8d93a0' }} />◷ Quá hạn
        </span>
        <span>
          <i style={{ background: '#c6c8b7' }} />— Chưa có dữ liệu
        </span>
      </div>
      <p>{statusLayer ? 'Trạng thái DEMO' : 'Heatmap nội suy IDW · DEMO'}</p>
    </details>
  )
}
