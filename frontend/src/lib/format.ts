import type { Measurement } from '../types/domain'
export const number = (value: number, digits = 1) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value)
export function formatMeasurement(m?: Measurement) {
  if (!m) return 'Chưa có dữ liệu'
  const unit = m.metric === 'soil_moisture' && !m.calibrated ? 'raw' : m.unit
  return `${number(m.value)}${unit === 'pH' ? ' pH' : ` ${unit}`}`
}
export function formatTime(value?: string) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
