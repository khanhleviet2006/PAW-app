import { expect, test } from '@playwright/test'

test('map-first, lớp dữ liệu, panel và viewport', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const selected = page.getByRole('button', { name: /^Khu A-03/ })
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await expect(selected).toContainText('26,7')
  const surface = page.locator('.heatmap-surface')
  await expect(surface).toBeVisible()
  await expect(surface.locator('[data-plot-id="B-02"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Công cụ bản đồ', exact: true }).click()
  await page.getByRole('button', { name: 'Ghim Công cụ bản đồ', exact: true }).click()
  const temperatureColor = await surface.locator('rect').first().getAttribute('fill')
  await page.getByRole('button', { name: 'pH đất', exact: true }).click()
  await expect(selected).toContainText('6,4 pH')
  await expect(surface.locator('rect').first()).not.toHaveAttribute('fill', temperatureColor!)
  await expect(surface.locator('[data-plot-id="B-04"]')).toHaveCount(0)
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Nhiệt độ', exact: true }).click()
  const svg = page.getByRole('group', { name: /Sơ đồ khu vườn/ })
  const initial = await svg.getAttribute('viewBox')
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click()
  await expect(svg).not.toHaveAttribute('viewBox', initial!)
  await page.getByRole('button', { name: 'Vừa toàn bộ khu vườn' }).click()
  await expect(svg).toHaveAttribute('viewBox', initial!)
  await page.getByRole('textbox', { name: 'Tìm khu vực' }).fill('B-04')
  await page.getByRole('button', { name: /B-04 · Luống/ }).click()
  await page.getByRole('button', { name: 'Thu gọn Công cụ bản đồ', exact: true }).click()
  await page.getByRole('button', { name: 'Chi tiết B-04', exact: true }).click()
  await page.getByRole('button', { name: 'Ghim Chi tiết B-04', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Chi tiết khu B-04' })
  await expect(panel).toBeVisible()
  if (info.project.name === 'mobile-375')
    await page.getByRole('button', { name: 'Mở rộng chi tiết' }).click()
  await expect(panel.getByRole('article', { name: 'pH đất' })).toContainText('Chưa có cảm biến')
  await page.getByRole('button', { name: 'Đóng chi tiết' }).click()
  await expect(panel).toBeHidden()
  await page.getByRole('button', { name: 'Mở chi tiết B-04' }).click()
  await expect(panel).toBeVisible()
  await page.getByRole('button', { name: 'Mở toàn màn hình' }).click()
  await expect(page.getByLabel('Không gian bản đồ', { exact: true })).toHaveClass(/immersive/)
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Không gian bản đồ', { exact: true })).not.toHaveClass(/immersive/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Khu A-03/ })).toBeVisible()
  await page.screenshot({ path: `docs/screenshots/${info.project.name}.png`, fullPage: true })
  expect(errors).toEqual([])
})

test('kéo bản đồ dừng khi thả chuột, có thể chọn bằng bàn phím', async ({ page }, info) => {
  await page.goto('/')
  const svg = page.getByRole('group', { name: /Sơ đồ khu vườn/ })
  await expect(svg).toBeVisible()
  const box = await svg.boundingBox()
  const initial = await svg.getAttribute('viewBox')
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.55)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width * 0.6 + 30, box!.y + box!.height * 0.55 + 20, {
    steps: 4,
  })
  await page.mouse.up()
  await expect(svg).not.toHaveAttribute('viewBox', initial!)
  if (info.project.use.hasTouch) {
    const beforeTouch = await svg.getAttribute('viewBox')
    const cdp = await page.context().newCDPSession(page)
    const x = box!.x + box!.width * 0.6,
      y = box!.y + box!.height * 0.55
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 20, y: y + 15 }],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + 40, y: y + 30 }],
    })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
    await expect(svg).not.toHaveAttribute('viewBox', beforeTouch!)
  }
  const after = await svg.getAttribute('viewBox')
  await page.mouse.move(box!.x + box!.width * 0.6 + 50, box!.y + box!.height * 0.55 + 40)
  await expect(svg).toHaveAttribute('viewBox', after!)
  const plot = page.getByRole('button', { name: /^Khu A-02/ })
  await plot.focus()
  await page.keyboard.press('Enter')
  await expect(plot).toHaveAttribute('aria-pressed', 'true')
})

test('drawer/sidebar, lịch sử, LIVE không fallback và không tràn', async ({ page }, info) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /^Khu A-03/ })).toBeVisible()
  if (info.project.name === 'mobile-375') {
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Menu điều hướng' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
    await dialog.getByRole('link', { name: 'Lịch sử đo' }).click()
  } else {
    await page.getByRole('button', { name: 'Mở rộng điều hướng' }).click()
    await page.getByRole('button', { name: 'Ghim menu' }).click()
    await expect(page.getByRole('button', { name: 'Bỏ ghim menu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('link', { name: 'Lịch sử đo' }).click()
  }
  await expect(page.getByRole('heading', { name: 'Lịch sử quan trắc' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Khoảng xem', exact: true }).selectOption('7d')
  await page.getByRole('combobox', { name: 'Giai đoạn đo', exact: true }).selectOption('PRE_PAW')
  await expect(page.getByRole('img', { name: /Biểu đồ/ })).toBeVisible()
  await page.getByText(/Xem bảng số liệu/).click()
  await expect(page.getByRole('table')).toContainText('Trước tưới · DEMO')
  await page.getByRole('combobox', { name: 'Khoảng xem', exact: true }).selectOption('30d')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.goto('/settings')
  await page.getByRole('combobox', { name: 'Chế độ dữ liệu', exact: true }).selectOption('LIVE')
  if (info.project.name === 'mobile-375') {
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'Tổng quan', exact: true }).click()
  } else await page.getByRole('link', { name: 'Tổng quan', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('LIVE chưa sẵn sàng')
  await expect(page.getByRole('group', { name: /Sơ đồ khu vườn/ })).toBeHidden()
  await expect(page.getByText('LIVE · Chưa xác minh kết nối')).toBeVisible()
})

test('accessibility cơ bản của bản đồ, lịch sử và cài đặt', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  for (const route of ['/', '/history', '/settings']) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    if (route === '/') await expect(page.getByRole('button', { name: /^Khu A-03/ })).toBeVisible()
    if (route === '/history') await expect(page.getByRole('img', { name: /Biểu đồ/ })).toBeVisible()
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ).toEqual([])
  }
})
