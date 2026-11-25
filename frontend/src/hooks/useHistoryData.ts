import { useQuery } from '@tanstack/react-query'
import type { HistoryRequest } from '../types/domain'
import { getRepository } from '../services/repositoryFactory'
import { usePreferences } from '../app/preferences'
export function useHistoryData(request: HistoryRequest) {
  const { mode } = usePreferences()
  return useQuery({
    queryKey: ['history', mode, request],
    queryFn: ({ signal }) => getRepository(mode).getHistory(request, signal),
    staleTime: mode === 'DEMO' ? Infinity : 30000,
  })
}
