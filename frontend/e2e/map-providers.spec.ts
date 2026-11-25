import { expect, test } from '@playwright/test'
test('no remote basemap requests or fallback on access failure', async ({ page }) => {
  const external: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:5173') {
      external.push(url.href)
      return route.abort()
    }
    return route.continue()
  })
  await page.route('**/v1/viewer-bootstrap', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Unauthorized test fixture' }),
    }),
  )
  await page.goto('/map')
  await expect(page.getByRole('alert')).toContainText('Chưa kết nối được máy chủ PAW')
  await expect(page.locator('.maplibregl-canvas,.leaflet-container,.farm-svg')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Bản đồ nền|Ảnh vệ tinh/ })).toHaveCount(0)
  await expect(page.getByLabel('Mã truy cập', { exact: true })).toHaveCount(0)
  expect(external).toEqual([])
})
