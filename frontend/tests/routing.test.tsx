import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../src/app/AppRoutes'
describe('App shell và routing', () => {
  it('mở bản đồ nội bộ và điều hướng lịch sử', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Bản đồ khu vực quan trắc' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Nội bộ PAW/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Lịch sử đo' }))
    expect(screen.getByRole('heading', { name: 'Lịch sử quan trắc' })).toBeInTheDocument()
  })
  it.each(['/', '/map', '/field-map'])('đường dẫn %s chỉ mở một màn hình bản đồ', async (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(
      await screen.findByRole('heading', { name: 'Bản đồ khu vực quan trắc' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Bản đồ quan trắc' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Bản đồ quan trắc' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.queryByText('Loại bản đồ')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Bản đồ GPS offline' })).not.toBeInTheDocument()
  })
  it('ghim và bỏ ghim sidebar', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Mở rộng điều hướng' }))
    await user.click(screen.getByRole('button', { name: 'Ghim menu' }))
    expect(screen.getByRole('button', { name: 'Bỏ ghim menu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Bỏ ghim menu' }))
    expect(screen.queryByRole('button', { name: 'Bỏ ghim menu' })).not.toBeInTheDocument()
  })
  it('mở drawer, giữ focus và đóng bằng Escape', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Mở menu' }))
    const dialog = screen.getByRole('dialog', { name: 'Menu điều hướng' })
    expect(within(dialog).getByRole('button', { name: 'Đóng menu' })).toHaveFocus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(within(dialog).getByRole('link', { name: 'Cài đặt' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở menu' })).toHaveFocus()
  })
  it('hỗ trợ truy cập trực tiếp đường dẫn con', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Lịch sử quan trắc' })).toBeInTheDocument()
  })
  it('có đường về tổng quan khi không tìm thấy trang', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/khong-ton-tai']}>
        <AppRoutes />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Về bản đồ' }))
    expect(
      await screen.findByRole('heading', { name: 'Bản đồ khu vực quan trắc' }),
    ).toBeInTheDocument()
  })
})
