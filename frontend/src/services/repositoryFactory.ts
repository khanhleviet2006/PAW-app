import type { DataMode } from '../types/domain'
import type { FarmRepository } from './repositories'
import { createLiveRepository } from './adapters/liveRepository'
import { mockRepository } from './adapters/mockRepository'
// LIVE cố ý đóng cho tới khi có OpenAPI và mapper đã xác minh.
// Không nhập fixtures DEMO vào liveRepository, không fallback sau lỗi.
export function getRepository(mode: DataMode): FarmRepository {
  return mode === 'DEMO' ? mockRepository : createLiveRepository()
}
