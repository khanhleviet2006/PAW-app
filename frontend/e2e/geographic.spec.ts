import { expect, test } from '@playwright/test'
test('home, old map and field-map resolve to one end-user satellite screen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  for (const path of ['/', '/map', '/field-map']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/map$/)
    await expect(page.getByRole('heading', { name: 'Bản đồ khu vực quan trắc' })).toBeVisible()
    await expect(page.getByText('PAW — Bản đồ vệ tinh nội bộ')).toBeVisible()
    await expect(page.locator('.nav-links a[href="/field-map"]')).toHaveCount(0)
    await expect(page.getByText('Loại bản đồ', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: /Google|OpenStreetMap|Schematic/ })).toHaveCount(
      0,
    )
    await expect(page.locator('.leaflet-container, .google-farm-map, .farm-svg')).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(errors).toEqual([])
})
