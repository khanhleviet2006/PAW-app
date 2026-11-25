import { Droplets, FlaskConical, Thermometer, Waves } from 'lucide-react'
import type { Metric, Thresholds } from '../../types/domain'
export const metricConfig = {
  air_temperature: {
    label: 'Nhiệt độ',
    fullLabel: 'Nhiệt độ không khí',
    unit: '°C',
    icon: Thermometer,
    step: 0.1,
  },
  air_humidity: {
    label: 'Độ ẩm không khí',
    fullLabel: 'Độ ẩm không khí',
    unit: '%RH',
    icon: Droplets,
    step: 1,
  },
  soil_moisture: { label: 'Độ ẩm đất', fullLabel: 'Độ ẩm đất', unit: '%', icon: Waves, step: 1 },
  soil_ph: { label: 'pH đất', fullLabel: 'pH đất', unit: 'pH', icon: FlaskConical, step: 0.1 },
} satisfies Record<
  Metric,
  { label: string; fullLabel: string; unit: string; icon: typeof Thermometer; step: number }
>
export const DEFAULT_THRESHOLDS: Thresholds = {
  air_temperature: { min: 18, max: 32 },
  air_humidity: { min: 45, max: 90 },
  soil_moisture: { min: 20, max: 60 },
  soil_ph: { min: 5.5, max: 7.5 },
}
export const dataColors = ['#4d829c', '#38988a', '#79a55f'] as const

export const metricPalettes: Record<Metric, readonly string[]> = {
  air_temperature: ['#3b75aa', '#62a36f', '#b59a39'],
  air_humidity: ['#a49ab7', '#528fb5', '#286b87'],
  soil_moisture: ['#a17a52', '#65865b', '#327d80'],
  soil_ph: ['#a17591', '#759267', '#837c46'],
}

// Display domains are separate from agronomic/demo alert thresholds.
export const heatDomains: Thresholds = {
  air_temperature: { min: 23, max: 28 },
  air_humidity: { min: 50, max: 90 },
  soil_moisture: { min: 20, max: 60 },
  soil_ph: { min: 5.5, max: 7.5 },
}
