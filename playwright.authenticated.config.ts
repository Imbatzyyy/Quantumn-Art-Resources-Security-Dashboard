import { defineConfig, devices } from '@playwright/test'
import { validateAuthenticatedE2eConfiguration } from './src/testSupport/authenticatedE2eSafety.js'

const configuration = validateAuthenticatedE2eConfiguration(process.env)

export default defineConfig({
  testDir: './authenticated-tests',
  globalSetup: './authenticated-tests/global.setup.ts',
  outputDir: './test-results/authenticated',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['line'], ['html', { outputFolder: 'playwright-report-authenticated', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: configuration.baseURL,
    colorScheme: 'light',
    locale: 'en-PH',
    timezoneId: 'Asia/Manila',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})

export const authenticatedAccounts = {
  ...configuration.accounts,
}
