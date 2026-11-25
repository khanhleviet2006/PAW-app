import { useQuery } from '@tanstack/react-query'
import { getRepository } from '../services/repositoryFactory'
import { usePreferences } from '../app/preferences'
export function useFarmData() {
  const { mode } = usePreferences()
  return useQuery({
    queryKey: ['farm', mode],
    queryFn: ({ signal }) => getRepository(mode).getFarm(signal),
    staleTime: mode === 'DEMO' ? Infinity : 30000,
  })
}
