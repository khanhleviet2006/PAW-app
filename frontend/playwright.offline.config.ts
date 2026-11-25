import { defineConfig } from '@playwright/test'
if (!process.env.PAW_E2E_CREDENTIALS)
  throw new Error('Cần PAW_E2E_CREDENTIALS từ backend test fixture server')
export default defineConfig({
  testDir: './e2e-offline',
  outputDir: 'test-results-offline',
  testMatch: 'field-offline.spec.ts',
  workers: 2,
  reporter: 'list',
  use: {
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
    locale: 'vi-VN',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-1920', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'desktop-1366', use: { viewport: { width: 1366, height: 768 } } },
    {
      name: 'mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'mobile-360',
      use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
    },
  ],
})
