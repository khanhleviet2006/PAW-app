import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { DataMode } from '../types/domain'
import { DEFAULT_THRESHOLDS } from '../features/environmental-layers/config'
import { PreferencesContext } from './preferences'
export function PreferencesProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<DataMode>(
    import.meta.env.VITE_DATA_MODE === 'LIVE' ? 'LIVE' : 'DEMO',
  )
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  return (
    <PreferencesContext.Provider value={{ mode, setMode, thresholds, setThresholds }}>
      {children}
    </PreferencesContext.Provider>
  )
}
