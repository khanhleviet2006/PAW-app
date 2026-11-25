import { describe, expect, it } from 'vitest'
import { mockRepository } from '../src/services/adapters/mockRepository'
import { DEMO_NOW } from '../src/data/mock/fixtures'
import type { HistoryRange } from '../src/types/domain'
describe('Lịch sử trước tưới DEMO', () => {
  it.each<HistoryRange>(['24h', '7d', '30d'])(
    'lọc thời gian %s và liên kết PRE_PAW có căn cứ',
    async (range) => {
      const request = {
        plotId: 'A-03',
        metric: 'air_temperature' as const,
        range,
        phase: 'ALL' as const,
      }
      const all = await mockRepository.getHistory(request)
      const pre = await mockRepository.getHistory({ ...request, phase: 'PRE_PAW' })
      expect(all.length).toBeGreaterThan(0)
      expect(pre.length).toBeGreaterThan(0)
      const hours = { '24h': 24, '7d': 168, '30d': 720 }
      for (const m of all)
        expect(Date.parse(m.observedAt)).toBeGreaterThanOrEqual(
          Date.parse(DEMO_NOW) - hours[range] * 3600000,
        )
      for (const m of pre) {
        expect(m.measurement_phase).toBe('PRE_PAW')
        expect(m.irrigationEventId).toMatch(/^demo-/)
        expect(Date.parse(m.observedAt)).toBeLessThan(Date.parse(m.irrigationEventAt!))
      }
      expect(all.at(-1)?.value).toBe(26.7)
      expect(all.at(-1)?.measurement_phase).toBe('UNKNOWN')
    },
  )
  it('không sinh lịch sử cho cảm biến chưa cấu hình', async () => {
    expect(
      await mockRepository.getHistory({
        plotId: 'B-04',
        metric: 'soil_ph',
        range: '30d',
        phase: 'ALL',
      }),
    ).toEqual([])
  })
})
