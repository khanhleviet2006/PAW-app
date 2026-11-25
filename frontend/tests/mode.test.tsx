import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../src/app/AppRoutes'
describe('Chế độ dữ liệu và ngưỡng', () => {
  it('LIVE lỗi không hiển thị số đo DEMO còn trong cache', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/history']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('combobox', { name: 'Chỉ số' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Cài đặt' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chế độ dữ liệu' }), 'LIVE')
    expect(screen.getByText('LIVE · Chưa xác minh kết nối')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Lịch sử đo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('LIVE chưa sẵn sàng')
    expect(screen.queryByRole('combobox', { name: 'Chỉ số' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không có dữ liệu DEMO thay thế')
    await user.click(screen.getByRole('link', { name: 'Cài đặt' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Chế độ dữ liệu' }), 'DEMO')
    await user.click(screen.getByRole('link', { name: 'Lịch sử đo' }))
    expect(await screen.findByRole('combobox', { name: 'Chỉ số' })).toBeInTheDocument()
  })
  it('kiểm tra ngưỡng, áp dụng và hiện cảnh báo tương ứng', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    const max = screen.getByRole('spinbutton', { name: 'Nhiệt độ — cao' })
    await user.clear(max)
    await user.type(max, '10')
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByText(/Ngưỡng không hợp lệ/)).toBeInTheDocument()
    await user.clear(max)
    await user.type(max, '25')
    await user.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByText(/Đã áp dụng ngưỡng/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Cảnh báo' }))
    const alerts = await screen.findByRole('heading', { name: 'Cảnh báo môi trường' })
    expect(alerts).toBeInTheDocument()
    const temperature = screen
      .getAllByRole('link', { name: /A-03/ })
      .find((link) => link.textContent?.includes('Nhiệt độ'))!
    expect(temperature).toHaveTextContent('26,7 °C')
  })
})
