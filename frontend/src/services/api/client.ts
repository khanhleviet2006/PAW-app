export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export type ApiClient = {
  health: (signal?: AbortSignal) => Promise<unknown>
  nodesStatus: (signal?: AbortSignal) => Promise<unknown>
  latest: (nodeId: string, signal?: AbortSignal) => Promise<unknown>
  telemetry: (
    nodeId: string,
    verifiedParams: URLSearchParams,
    signal?: AbortSignal,
  ) => Promise<unknown>
}
export function createApiClient(baseUrl: string, timeoutMs = 10000): ApiClient {
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    throw new ApiError('Chưa cấu hình địa chỉ API hợp lệ.')
  }
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new ApiError(
      'Địa chỉ API phải là HTTP/HTTPS và không chứa thông tin đăng nhập, query hoặc hash.',
    )
  async function get(path: string, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted()
    const controller = new AbortController()
    const abort = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(
      () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
      timeoutMs,
    )
    try {
      const response = await fetch(`${base.href.replace(/\/$/, '')}${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        credentials: 'omit',
      })
      if (!response.ok)
        throw new ApiError(
          `API trả lỗi HTTP ${response.status}. Vui lòng thử lại hoặc liên hệ người quản trị.`,
          response.status,
        )
      try {
        return (await response.json()) as unknown
      } catch (error) {
        if (controller.signal.aborted) throw error
        throw new ApiError('API không trả JSON hợp lệ; chưa thể đọc dữ liệu.')
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (
        controller.signal.reason instanceof DOMException &&
        controller.signal.reason.name === 'TimeoutError'
      )
        throw new ApiError('API phản hồi quá thời gian chờ. Vui lòng thử lại.')
      if (error instanceof ApiError) throw error
      throw new ApiError('Không kết nối được API. Kiểm tra mạng hoặc liên hệ người quản trị.')
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  return {
    health: (signal) => get('/health', signal),
    nodesStatus: (signal) => get('/v1/nodes/status', signal),
    latest: (id, signal) => get(`/v1/nodes/${encodeURIComponent(id)}/latest`, signal),
    telemetry: (id, params, signal) =>
      get(
        `/v1/nodes/${encodeURIComponent(id)}/telemetry${params.size ? `?${params}` : ''}`,
        signal,
      ),
  }
}
