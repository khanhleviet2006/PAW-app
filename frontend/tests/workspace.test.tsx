import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldMapPage } from '../src/pages/FieldMapPage'
import { imagery, points, reading, snapshot } from './fixtures/field'
import type { Snapshot } from '../src/features/field-map/types'
const state = vi.hoisted(() => ({
  image: null as unknown,
  failures: 0,
  onState: undefined as undefined | ((message: string) => void),
  apply: undefined as undefined | ((value: Snapshot) => void),
}))
vi.mock('../src/features/field-map/repository', () => ({
  bootstrapViewer: async () => {
    if (state.failures-- > 0) throw new Error('Máy chủ tạm ngừng')
    return { baseUrl: location.origin, farmId: 'farm' }
  },
  waitForRetry: async () => new Promise<void>((resolve) => setTimeout(resolve, 30)),
  createFieldRepository: () => ({
    snapshot: async () => snapshot,
    imagery: async () => state.image,
    history: async (_signal: AbortSignal, apply: (value: unknown) => void) => apply(points),
    subscribe: async (
      _signal: AbortSignal,
      apply: (value: Snapshot) => void,
      onState: (message: string) => void,
    ) => {
      state.onState = onState
      state.apply = apply
      onState('Đang nhận cập nhật trong mạng PAW')
      await new Promise<void>((resolve) =>
        _signal.addEventListener('abort', () => resolve(), { once: true }),
      )
    },
  }),
}))
vi.mock('../src/features/field-map/FieldMap', () => ({
  FieldMap: (props: {
    points: typeof points
    metric: string
    heatEnabled: boolean
    opacity: number
    selected?: (typeof points.features)[0]
  }) => (
    <div
      data-testid="maplibre"
      data-points={JSON.stringify(props.points)}
      data-metric={props.metric}
      data-heat={props.heatEnabled}
      data-opacity={props.opacity}
    >
      {props.selected && (
        <p role="dialog">
          Điểm đo {props.selected.properties.node_id} ·{' '}
          {props.selected.geometry.coordinates.join(',')}
        </p>
      )}
    </div>
  ),
}))
beforeEach(() => {
  state.failures = 0
  state.onState = undefined
  state.image = null
  state.apply = undefined
})
async function connect() {
  const user = userEvent.setup()
  render(<FieldMapPage />)
  await screen.findByText('Đang cập nhật số đo')
  return user
}
describe('Màn hình bản đồ người dùng thống nhất', () => {
  it('tự thử lại khi backend chưa sẵn sàng, không cần thao tác', async () => {
    state.failures = 1
    state.image = imagery
    render(<FieldMapPage />)
    expect(await screen.findByText('Máy chủ tạm ngừng')).toBeInTheDocument()
    await screen.findByTestId('maplibre')
    await screen.findByText('Đang cập nhật số đo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('mất kết nối giữ bản đồ và điểm cũ, phục hồi không remount', async () => {
    state.image = imagery
    await connect()
    const map = await screen.findByTestId('maplibre')
    const before = map.getAttribute('data-points')
    await act(async () =>
      state.onState?.('Mất luồng cập nhật — dữ liệu có thể đã cũ. Đang kết nối lại…'),
    )
    expect(screen.getByTestId('maplibre')).toBe(map)
    expect(map.getAttribute('data-points')).toBe(before)
    await act(async () => state.onState?.('Đang nhận cập nhật trong mạng PAW'))
    expect(screen.getByTestId('maplibre')).toBe(map)
  })
  it('thiếu ảnh hiện thông báo chính xác, không dựng nền hoặc engine thay thế', async () => {
    await connect()
    expect(await screen.findByText('Chưa cài đặt dữ liệu ảnh vệ tinh khu vực')).toBeInTheDocument()
    expect(screen.queryByTestId('maplibre')).not.toBeInTheDocument()
    expect(screen.queryByText('Loại bản đồ')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Ảnh vệ tinh đã lưu')).not.toBeInTheDocument()
  })
  it('chỉ cho chọn thông số và độ sâu, bật tắt/đổi độ đậm heatmap', async () => {
    state.image = imagery
    const user = await connect()
    await screen.findByTestId('maplibre')
    await user.click(screen.getByText('Thông số hiển thị'))
    await user.selectOptions(screen.getByLabelText('Thông số'), 'soil_moisture')
    expect(screen.getByLabelText('Độ sâu (cm)')).toHaveValue('20')
    await user.selectOptions(screen.getByLabelText('Độ sâu (cm)'), '40')
    await user.click(screen.getByLabelText('Hiển thị heatmap'))
    expect(screen.getByTestId('maplibre')).toHaveAttribute('data-heat', 'false')
    expect(screen.queryByLabelText('Ảnh vệ tinh đã lưu')).not.toBeInTheDocument()
    expect(screen.queryByText(/Google|OpenStreetMap|Schematic/)).not.toBeInTheDocument()
  })
  it('dữ liệu mới thêm điểm nhưng không đổi tọa độ điểm lịch sử', async () => {
    state.image = imagery
    await connect()
    await screen.findByTestId('maplibre')
    await act(async () =>
      state.apply?.({
        ...snapshot,
        cursor: 2,
        map_points: {
          ...points,
          features: [
            {
              ...points.features[0]!,
              id: 'reading-2',
              geometry: { type: 'Point', coordinates: [108.1, 11.1] },
              properties: { ...reading, id: 'reading-2' },
            },
          ],
        },
      }),
    )
    await waitFor(() => {
      const data = JSON.parse(screen.getByTestId('maplibre').getAttribute('data-points')!)
      expect(data.features).toHaveLength(2)
      expect(data.features[0].geometry.coordinates).toEqual([108, 11])
    })
  })
  it('tự mở bản đồ, xem số đo và không hiển thị thông tin truy cập', async () => {
    state.image = imagery
    const user = await connect()
    await screen.findByTestId('maplibre')
    await user.click(screen.getByText(/1 điểm đo đã lưu/))
    await user.click(screen.getByRole('button', { name: /COT-01/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('108,11')
    expect(screen.queryByText('Truy cập khu quan trắc')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Mã truy cập')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở bản đồ' })).not.toBeInTheDocument()
  })
})
