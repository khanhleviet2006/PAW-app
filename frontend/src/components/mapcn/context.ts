import { createContext, useContext } from 'react'
import type { Map as MapInstance } from 'maplibre-gl'
export const MapContext = createContext<{ map: MapInstance | null; isLoaded: boolean }>({
  map: null,
  isLoaded: false,
})
export function useMap() {
  return useContext(MapContext)
}
