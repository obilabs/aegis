import { defineConfig, devices } from '@playwright/test'

/**
 * Browser walk-through of a fresh self-hosted install. The specs share one
 * stack and build on each other (setup -> users -> tickets -> restart), so they
 * run serially in one worker, in file-name order. See e2e/README.md.
 */
const baseURL = process.env.AEGIS_E2E_URL || 'http://localhost:18480'

export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: './artifacts/report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
