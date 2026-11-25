import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Measurement } from '../../types/domain'
import { formatTime, number } from '../../lib/format'
export default function HistoryChart({
  measurements,
  unit,
}: {
  measurements: Measurement[]
  unit: string
}) {
  const data = measurements.map((m) => ({ timestamp: Date.parse(m.observedAt), value: m.value }))
  return (
    <div
      className="history-chart"
      role="img"
      aria-label={`Biểu đồ ${measurements.length} số đo, đơn vị ${unit}; có bảng số liệu bên dưới`}
    >
      <ResponsiveContainer width="100%" height={230} initialDimension={{ width: 600, height: 230 }}>
        <LineChart
          data={data}
          margin={{ top: 15, right: 15, bottom: 5, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="#e3e9df" />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) =>
              new Intl.DateTimeFormat('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
              }).format(new Date(t))
            }
            minTickGap={45}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={42}
            tickFormatter={(v: number) => number(v)}
            domain={['auto', 'auto']}
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={(label) => formatTime(new Date(Number(label)).toISOString())}
            formatter={(value) => [`${number(Number(value))} ${unit}`, 'Số đo']}
            contentStyle={{ borderRadius: 10, borderColor: '#dbe4d6', fontSize: 12 }}
          />
          <Line
            type="linear"
            dataKey="value"
            name="Số đo"
            stroke="#2d7957"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
