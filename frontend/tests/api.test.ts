import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/services/api/client'
import { createLiveRepository } from '../src/services/adapters/liveRepository'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('API client và ranh giới LIVE', () => {
  it('giữ payload unknown, encode node và truyền query đã được xác minh', async () => {
    const fetcher = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ arbitrary: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetcher)
    const client = createApiClient('https://example.test/api/')
    expect(await client.latest('node/a')).toEqual({ arbitrary: true })
    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/api/v1/nodes/node%2Fa/latest',
      expect.objectContaining({ credentials: 'omit' }),
    )
    await client.telemetry('n', new URLSearchParams({ verified: 'yes' }))
    expect(fetcher).toHaveBeenLastCalledWith(
      'https://example.test/api/v1/nodes/n/telemetry?verified=yes',
      expect.any(Object),
    )
  })
  it('không lộ body lỗi HTTP và không chấp nhận JSON hỏng', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private server details', { status: 503 })),
    )
    await expect(createApiClient('https://example.test').health()).rejects.toThrow('HTTP 503')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>not json</html>')))
    await expect(createApiClient('https://example.test').health()).rejects.toThrow('JSON hợp lệ')
  })
  it('lỗi mạng có thông báo rõ', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    await expect(createApiClient('https://example.test').health()).rejects.toThrow(
      'Không kết nối được API',
    )
  })
  it('timeout và hủy từ caller đều được truyền tới fetch', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            })
          }),
      ),
    )
    const timeout = createApiClient('https://example.test', 50).health()
    const assertion = expect(timeout).rejects.toThrow('quá thời gian chờ')
    await vi.advanceTimersByTimeAsync(51)
    await assertion
    const abort = new AbortController()
    const pending = createApiClient('https://example.test').health(abort.signal)
    const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    abort.abort()
    await cancelled
  })
  it('từ chối credentials trong base URL và LIVE không có mapper không gọi mạng', async () => {
    expect(() => createApiClient('https://user:secret@example.test')).toThrow(
      'không chứa thông tin đăng nhập',
    )
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(
      createLiveRepository(createApiClient('https://example.test')).getFarm(),
    ).rejects.toThrow('LIVE chưa sẵn sàng')
    await expect(
      createLiveRepository().getHistory({
        plotId: 'A-03',
        metric: 'soil_ph',
        range: '24h',
        phase: 'PRE_PAW',
      }),
    ).rejects.toThrow('Không có dữ liệu DEMO thay thế')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
