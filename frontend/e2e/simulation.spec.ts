import { expect, test } from '@playwright/test'
test('simulation panel điều khiển history, alerts và reset', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/dev/simulation')
  await expect(page.getByRole('heading', { name: 'Điều khiển mô phỏng cảm biến' })).toBeVisible()
  await expect(page.getByText('DỮ LIỆU MÔ PHỎNG · DEVELOPMENT')).toBeVisible()
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Scenario', exact: true })
    .selectOption('HIGH_AIR_TEMPERATURE')
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await page.getByRole('button', { name: 'Đặt lại', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveValue('NORMAL')
  await page
    .getByRole('combobox', { name: 'Scenario', exact: true })
    .selectOption('HIGH_AIR_TEMPERATURE')
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await page.screenshot({
    path: `docs/screenshots/enduser-simulator-regression-${info.project.name}.png`,
    fullPage: true,
  })
  await page.getByRole('link', { name: 'Xem lịch sử', exact: true }).click()
  await page.getByText(/Xem bảng số liệu/).click()
  const row = page.getByRole('table').locator('tbody tr').first()
  await expect(row).toBeVisible()
  const value = await row.locator('td').nth(1).innerText()
  expect(parseFloat(value.replace(',', '.'))).toBeGreaterThan(32)
  // Use router links, never reload the in-memory engine during a session.
  if (info.project.use.isMobile) {
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'Cảnh báo', exact: true }).click()
  } else await page.getByRole('link', { name: 'Cảnh báo', exact: true }).click()
  await expect(page.locator('.alerts-list')).toContainText('A-03')
  expect(errors).toEqual([])
})
