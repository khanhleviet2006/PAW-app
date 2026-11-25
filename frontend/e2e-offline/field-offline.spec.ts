import process from 'node:process'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
const credentialsFile = process.env.PAW_E2E_CREDENTIALS
// Dedicated test server is opt-in. Production builds never seed these fixtures.
test('LAN-only Leafmap keeps GPS history, popup and map instance during SSE updates', async ({
  page,
  request,
}, info) => {
  const config = JSON.parse(readFileSync(credentialsFile!, 'utf8'))[info.project.name] as {
    farm: string
    node: string
    sensor: string
    viewer: string
    operator: string
    gateway: string
  }
  let restReads = 0
  const origin = 'http://127.0.0.1:18082',
    external: string[] = [],
    tileRequests: string[] = [],
    errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
      external.push(url.href)
      return route.abort()
    }
    if (
      url.pathname.endsWith('/map') ||
      url.pathname.endsWith('/map-points') ||
      url.pathname.endsWith('/imagery/active')
    )
      restReads++
    if (url.pathname.includes('/imagery/') && url.pathname.endsWith('.png'))
      tileRequests.push(url.href)
    return route.continue()
  })
  await page.goto(`${origin}/field-map`)
  await expect(page.getByRole('button', { name: 'Mở bản đồ' })).toHaveCount(0)
  await expect(page.locator('.field-link-state')).toContainText('Đang cập nhật số đo')
  await expect(page).toHaveURL(/\/map$/)
  await expect(page.getByText('Loại bản đồ', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Ảnh vệ tinh đã lưu' })).toHaveCount(0)
  await expect(
    page.frameLocator('iframe[title="Bản đồ Leafmap"]').locator('.leaflet-container'),
  ).toBeVisible()
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0)
  const frame = page.frameLocator('iframe[title="Bản đồ Leafmap"]')
  await frame.locator('.leaflet-interactive').last().click()
  await expect(frame.getByLabel('Thông tin điểm đo')).toContainText('108.005, 11.005')
  await frame.locator('.leaflet-popup-close-button').click()
  const startingZoom = await page.locator('.field-camera-status').innerText()
  await frame.locator('.leaflet-control-zoom-in').click()
  await expect.poll(() => page.locator('.field-camera-status').innerText()).not.toBe(startingZoom)
  await frame.locator('.leaflet-control-zoom-out').click()
  await expect.poll(() => page.locator('.field-camera-status').innerText()).toBe(startingZoom)
  await page.getByText('Thông số hiển thị', { exact: true }).click()
  await expect(page.getByText(`1 điểm đo đã lưu · 1 cột cảm biến`, { exact: true })).toBeVisible()
  const canvas = await page
    .frameLocator('iframe[title="Bản đồ Leafmap"]')
    .locator('.leaflet-container')
    .elementHandle()
  const camera = await page.locator('.field-camera-status').textContent()
  const beforeTiles = tileRequests.length
  const beforeReads = restReads
  const stamp = new Date().toISOString()
  const gps = await request.post(`${origin}/v1/gateway/ingest`, {
    headers: { Authorization: `Bearer ${config.gateway}` },
    data: {
      event_id: `gps-${info.project.name}-${Date.now()}`,
      node_id: config.node,
      node_observed_at: stamp,
      source: 'sensor',
      position: { longitude: 108.0055, latitude: 11.0055, accuracy_m: 3, observed_at: stamp },
    },
  })
  expect(gps.ok()).toBeTruthy()
  const placement = await request.post(`${origin}/v1/nodes/${config.node}/deployments`, {
    headers: { Authorization: `Bearer ${config.operator}` },
    data: { position_id: (await gps.json()).position_id },
  })
  expect(placement.ok()).toBeTruthy()
  const time = new Date().toISOString()
  const packet = {
    event_id: `reading-${info.project.name}-${Date.now()}`,
    node_id: config.node,
    node_observed_at: time,
    source: 'sensor',
    readings: [
      {
        sensor_id: config.sensor,
        session_id: config.farm + '-pre',
        value: 28,
        observed_at: time,
        deployment_id: (await placement.json()).id,
      },
    ],
  }
  const response = await request.post(`${origin}/v1/gateway/ingest`, {
    headers: { Authorization: `Bearer ${config.gateway}` },
    data: packet,
  })
  expect(response.ok()).toBeTruthy()
  await expect(page.getByText(`2 điểm đo đã lưu · 1 cột cảm biến`, { exact: true })).toBeVisible()
  await expect(
    page.frameLocator('iframe[title="Bản đồ Leafmap"]').locator('.leaflet-container'),
  ).toHaveCount(1)
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true)
  expect(await page.locator('.field-camera-status').textContent()).toBe(camera)
  expect(tileRequests.length).toBe(beforeTiles)
  expect(restReads).toBe(beforeReads)
  await page.getByLabel('Hiển thị heatmap').uncheck()
  await page.getByLabel('Hiển thị heatmap').check()
  await page.getByLabel('Độ đậm heatmap').fill('0.45')
  await page.getByText(`2 điểm đo đã lưu · 1 cột cảm biến`, { exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`${config.node} · 26`) }).click()
  await expect(frame.getByLabel('Thông tin điểm đo')).toContainText('108.005, 11.005')
  await page.context().setOffline(true)
  await expect(page.locator('.field-link-state')).toContainText(/Mất|kết nối lại/)
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true)
  await expect(page.getByText('2 điểm đo đã lưu · 1 cột cảm biến', { exact: true })).toBeVisible()
  const missedTime = new Date().toISOString()
  const missed = await request.post(`${origin}/v1/gateway/ingest`, {
    headers: { Authorization: `Bearer ${config.gateway}` },
    data: {
      ...packet,
      event_id: `missed-${info.project.name}-${Date.now()}`,
      node_observed_at: missedTime,
      readings: [{ ...packet.readings[0], value: 27, observed_at: missedTime }],
    },
  })
  expect(missed.ok()).toBeTruthy()
  await page.context().setOffline(false)
  await expect(page.locator('.field-link-state')).toContainText('Đang cập nhật số đo')
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true)
  await expect(page.getByText('3 điểm đo đã lưu · 1 cột cảm biến', { exact: true })).toBeVisible()
  await expect(frame.locator('.leaflet-image-layer')).toHaveCount(0)
  const thirdTime = new Date().toISOString()
  const thirdGps = await request.post(origin + '/v1/gateway/ingest', {
    headers: { Authorization: 'Bearer ' + config.gateway },
    data: {
      ...packet,
      event_id: 'third-gps',
      node_observed_at: thirdTime,
      readings: [],
      position: { longitude: 108.0056, latitude: 11.0047, accuracy_m: 3, observed_at: thirdTime },
    },
  })
  expect(thirdGps.ok()).toBeTruthy()
  const thirdPlace = await request.post(origin + '/v1/nodes/' + config.node + '/deployments', {
    headers: { Authorization: 'Bearer ' + config.operator },
    data: { position_id: (await thirdGps.json()).position_id },
  })
  expect(thirdPlace.ok()).toBeTruthy()
  const observed = new Date().toISOString()
  const third = await request.post(origin + '/v1/gateway/ingest', {
    headers: { Authorization: 'Bearer ' + config.gateway },
    data: {
      ...packet,
      event_id: 'third-reading',
      node_observed_at: observed,
      readings: [
        {
          ...packet.readings[0],
          deployment_id: (await thirdPlace.json()).id,
          value: 29,
          observed_at: observed,
        },
      ],
    },
  })
  expect(third.ok()).toBeTruthy()
  await expect(page.locator('.field-legend')).toContainText('3 vị trí')
  await expect(frame.locator('.leaflet-image-layer')).toBeAttached()
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true)
  expect(await page.locator('.field-camera-status').textContent()).toBe(camera)
  expect(external).toEqual([])
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: `docs/screenshots/enduser-map-test-${info.project.name}.png`,
    fullPage: true,
  })
})

test('no installed satellite shows exact notice and no alternative basemap', async ({
  page,
}, info) => {
  const origin = 'http://127.0.0.1:18082',
    external: string[] = [],
    tiles: string[] = []
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
      external.push(url.href)
      return route.abort()
    }
    if (url.pathname.endsWith('.png') && url.pathname.includes('/imagery/')) tiles.push(url.href)
    return route.continue()
  })
  let bootAttempts = 0
  await page.route('**/v1/viewer-bootstrap', (route) =>
    ++bootAttempts === 1 ? route.abort() : route.continue(),
  )
  await page.route('**/imagery/active', (route) => route.fulfill({ json: { item: null } }))
  await page.goto(`${origin}/map`)
  await expect(
    page.getByText('Chưa cài đặt dữ liệu ảnh vệ tinh khu vực', { exact: true }),
  ).toBeVisible()
  await expect(page.locator('iframe[title="Bản đồ Leafmap"]')).toHaveCount(0)
  await expect(page.getByText('Loại bản đồ', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox')).toHaveCount(0)
  expect(external).toEqual([])
  expect(tiles).toEqual([])
  expect(bootAttempts).toBeGreaterThan(1)
  await page.screenshot({
    path: `docs/screenshots/enduser-no-imagery-${info.project.name}.png`,
    fullPage: true,
  })
})
