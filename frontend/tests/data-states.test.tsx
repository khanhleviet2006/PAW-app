import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../src/app/AppRoutes'
import { mockRepository } from '../src/services/adapters/mockRepository'
import { demoData } from '../src/data/mock/fixtures'
afterEach(() => vi.restoreAllMocks())
describe('Loading, error, retry và empty', () => {
  it('hiện loading, lỗi và thử lại thành công', async () => {
    const user = userEvent.setup()
    vi.spyOn(mockRepository, 'getFarm')
      .mockRejectedValueOnce(new Error('Lỗi dữ liệu kiểm thử'))
      .mockResolvedValue(structuredClone(demoData))
    render(
      <MemoryRouter initialEntries={['/history']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải khu vườn')
    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi dữ liệu kiểm thử')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('combobox', { name: 'Khu vực' })).toBeInTheDocument()
  })
  it('không bịa vùng khi repository trả khu vườn rỗng', async () => {
    vi.spyOn(mockRepository, 'getFarm').mockResolvedValue({
      ...structuredClone(demoData),
      farm: { ...structuredClone(demoData.farm), plots: [], sensors: [] },
      snapshots: [],
    })
    render(
      <MemoryRouter initialEntries={['/history']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Chưa có vùng đất được cấu hình.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Khu A-/ })).not.toBeInTheDocument()
  })
  it('cảm biến chưa cấu hình không có lịch sử giả', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/history?plot=B-04']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Chỉ số' }), 'soil_ph')
    expect(
      await screen.findByText('Chưa có số đo cho chỉ số và khoảng thời gian này.'),
    ).toBeInTheDocument()
  })
})
