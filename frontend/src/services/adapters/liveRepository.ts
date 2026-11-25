import type { FarmData, HistoryRequest, Measurement } from '../../types/domain'
import type { ApiClient } from '../api/client'
import type { FarmRepository } from '../repositories'
// Chỉ hiện thực hợp đồng này sau khi đọc OpenAPI thật và kiểm tra payload.
// Không cung cấp mapper mặc định dựa trên schema phỏng đoán.
export type VerifiedReadContract = {
  openApiVersion: string
  nodeIds: readonly string[]
  nodeIdForPlot: (plotId: string) => string
  mapFarm: (status: unknown, latestByNode: Readonly<Record<string, unknown>>) => FarmData
  telemetryParams: (request: HistoryRequest) => URLSearchParams
  mapHistory: (payload: unknown, request: HistoryRequest) => Measurement[]
}
export class IntegrationUnavailableError extends Error {
  constructor() {
    super(
      'LIVE chưa sẵn sàng. Chưa xác minh OpenAPI, dữ liệu và liên kết cảm biến với vùng đất. Không có dữ liệu DEMO thay thế.',
    )
    this.name = 'IntegrationUnavailableError'
  }
}
export function createLiveRepository(
  client?: ApiClient,
  contract?: VerifiedReadContract,
): FarmRepository {
  function verified() {
    if (!client || !contract?.openApiVersion || !contract.nodeIds.length)
      throw new IntegrationUnavailableError()
    return { client, contract }
  }
  return {
    async getFarm(signal) {
      const { client: api, contract: schema } = verified()
      const [status, readings] = await Promise.all([
        api.nodesStatus(signal),
        Promise.all(schema.nodeIds.map(async (id) => [id, await api.latest(id, signal)] as const)),
      ])
      const data = schema.mapFarm(status, Object.fromEntries(readings))
      if (data.mode !== 'LIVE') throw new Error('Adapter LIVE trả sai nguồn dữ liệu.')
      return data
    },
    async getHistory(request, signal) {
      const { client: api, contract: schema } = verified()
      const id = schema.nodeIdForPlot(request.plotId)
      if (!schema.nodeIds.includes(id)) throw new Error('Chưa xác minh cảm biến của khu vực này.')
      return schema.mapHistory(
        await api.telemetry(id, schema.telemetryParams(request), signal),
        request,
      )
    },
  }
}
