import type { Connection, Imagery, Points, Snapshot } from './types'
export async function bootstrapViewer(signal: AbortSignal): Promise<Connection> {
  const baseUrl = (import.meta.env.VITE_PAW_API_URL || location.origin).replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/v1/viewer-bootstrap`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    cache: 'no-store',
  })
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? 'Ứng dụng chưa được cấp quyền xem. Vui lòng liên hệ quản trị viên.'
        : 'Chưa kết nối được máy chủ PAW. Hệ thống đang tự kết nối lại…',
    )
  const data = await response.json()
  if (typeof data.farm_id !== 'string' || !data.farm_id.trim())
    throw new Error('Khu quan trắc chưa sẵn sàng. Vui lòng liên hệ quản trị viên.')
  return { baseUrl, farmId: data.farm_id }
}
export const readHeaders = (config: Connection): Record<string, string> =>
  config.token ? { Authorization: `Bearer ${config.token}` } : {}
export function waitForRetry(signal: AbortSignal, ms = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}
export function checkSnapshot(data: unknown): Snapshot {
  const value = data as Snapshot
  if (
    !value ||
    value.schema_version !== '1.0' ||
    !value.farm ||
    value.farm.source !== 'sensor' ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.plots) ||
    !Array.isArray(value.heat_points)
  )
    throw new Error('API không đúng hợp đồng GPS thực hoặc đang trả dữ liệu mô phỏng.')
  return value
}
export function createFieldRepository(config: Connection) {
  const base = `${config.baseUrl}/v1/farms/${encodeURIComponent(config.farmId)}`
  async function get(path: string, signal: AbortSignal) {
    const response = await fetch(`${base}${path}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      headers: readHeaders(config),
      credentials: 'omit',
    })
    if (!response.ok)
      throw new Error(`API PAW trả HTTP ${response.status}. Kiểm tra quyền và kết nối LAN.`)
    return response.json()
  }
  return {
    async snapshot(signal: AbortSignal) {
      return checkSnapshot(await get('/map', signal))
    },
    async imagery(signal: AbortSignal) {
      return (await get('/imagery/active', signal)).item as Imagery | null
    },
    async history(signal: AbortSignal, onPage: (points: Points) => void) {
      let cursor: string | null | undefined
      do {
        const points = (await get(
          `/map-points?limit=1000${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`,
          signal,
        )) as Points
        if (points.type !== 'FeatureCollection' || !Array.isArray(points.features))
          throw new Error('Lịch sử GPS không đúng GeoJSON.')
        onPage(points)
        cursor = points.next_cursor
      } while (cursor)
    },
    async subscribe(
      signal: AbortSignal,
      onData: (snapshot: Snapshot) => void,
      onState: (message: string) => void,
    ) {
      let retry = 500,
        cursor = 0
      while (!signal.aborted) {
        const attempt = new AbortController()
        const offline = () => attempt.abort()
        window.addEventListener('offline', offline)
        let watchdog = setTimeout(() => attempt.abort(), 45000)
        try {
          const response = await fetch(`${base}/events?include_map_points=true&since=${cursor}`, {
            signal: AbortSignal.any([signal, attempt.signal]),
            headers: { ...readHeaders(config), Accept: 'text/event-stream' },
            credentials: 'omit',
          })
          if ([401, 403].includes(response.status))
            throw new AuthError('Quyền truy cập đã hết hoặc bị thu hồi.')
          if (response.status === 409) {
            cursor = 0
            continue
          }
          if (!response.ok || !response.body) throw new Error('Mất kết nối cập nhật PAW.')
          onState('Đang nhận cập nhật trong mạng PAW')
          const reader = response.body.getReader(),
            decoder = new TextDecoder()
          let buffer = ''
          try {
            while (!signal.aborted) {
              const chunk = await reader.read()
              clearTimeout(watchdog)
              watchdog = setTimeout(() => attempt.abort(), 45000)
              if (chunk.done) throw new Error('Luồng cập nhật đã đóng.')
              buffer = (buffer + decoder.decode(chunk.value, { stream: true })).replace(
                /\r\n/g,
                '\n',
              )
              let end: number
              while ((end = buffer.indexOf('\n\n')) >= 0) {
                const block = buffer.slice(0, end)
                buffer = buffer.slice(end + 2)
                const event = parseEvent(block)
                if (event.event === 'auth.revoked')
                  throw new AuthError('Quyền truy cập đã bị thu hồi.')
                if (event.event === 'snapshot' && event.data) {
                  const snapshot = checkSnapshot(JSON.parse(event.data))
                  cursor = snapshot.cursor
                  onData(snapshot)
                  retry = 500
                }
              }
              if (buffer.length > 16_000_000) throw new Error('Gói SSE vượt kích thước cho phép.')
            }
          } finally {
            await reader.cancel().catch(() => {})
            reader.releaseLock()
          }
        } catch (error) {
          if (signal.aborted) return
          onState(
            error instanceof AuthError
              ? error.message
              : 'Mất luồng cập nhật — dữ liệu có thể đã cũ. Đang kết nối lại…',
          )
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              signal.removeEventListener('abort', abort)
              resolve()
            }, retry)
            function abort() {
              clearTimeout(timeout)
              resolve()
            }
            signal.addEventListener('abort', abort, { once: true })
          })
          retry = Math.min(retry * 2, 15000)
        } finally {
          clearTimeout(watchdog)
          window.removeEventListener('offline', offline)
          attempt.abort()
        }
      }
    },
  }
}
class AuthError extends Error {}
export function parseEvent(block: string) {
  let event = '',
    data = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data += (data ? '\n' : '') + line.slice(5).trimStart()
  }
  return { event, data }
}
