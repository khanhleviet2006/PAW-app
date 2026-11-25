import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { simulationRuntime as runtime } from './runtime'
export function SimulationBridge() {
  const client = useQueryClient()
  useEffect(() => {
    const unsubscribe = runtime.subscribe(() => {
      void client.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] === 'farm' || q.queryKey[0] === 'history') && q.queryKey[1] === 'DEMO',
      })
    })
    const timer = setInterval(() => runtime.pulse(performance.now()), 1000)
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [client])
  return null
}
