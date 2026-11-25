import { createContext, useContext } from 'react'
import type { DataMode, Thresholds } from '../types/domain'
export type Preferences = {
  mode: DataMode
  setMode: (mode: DataMode) => void
  thresholds: Thresholds
  setThresholds: (value: Thresholds) => void
}
export const PreferencesContext = createContext<Preferences | null>(null)
export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('Thiếu PreferencesProvider')
  return value
}
