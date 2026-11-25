import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HoverDock } from '../src/components/ui/HoverDock'
describe('Dock ưu tiên bản đồ', () => {
  it('mở bằng hover, tự thu khi rời và giữ khi ghim', async () => {
    const user = userEvent.setup()
    render(
      <HoverDock label="Công cụ" position="tools">
        <input aria-label="Tìm" />
      </HoverDock>,
    )
    const dock = screen.getByRole('region', { name: 'Công cụ' })
    const trigger = screen.getByRole('button', { name: 'Công cụ' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.mouseEnter(dock)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.mouseLeave(dock)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Ghim Công cụ' }))
    fireEvent.mouseLeave(dock)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })
  it('mở bằng bàn phím và có thao tác thu gọn cho màn hình cảm ứng', async () => {
    const user = userEvent.setup()
    render(
      <HoverDock label="Chú giải" position="legend">
        Nội dung
      </HoverDock>,
    )
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Chú giải' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.click(screen.getByRole('button', { name: 'Thu gọn Chú giải' }))
    expect(screen.getByRole('button', { name: 'Chú giải' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
