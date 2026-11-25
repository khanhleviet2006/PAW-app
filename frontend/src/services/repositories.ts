import type { FarmData, HistoryRequest, Measurement } from '../types/domain'
export interface FarmRepository {
  getFarm(signal?: AbortSignal): Promise<FarmData>
  getHistory(request: HistoryRequest, signal?: AbortSignal): Promise<Measurement[]>
}
