import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL
if (baseURL !== 'http://127.0.0.1:4175') {
  throw new Error('Mutation QA is local-only and refused a non-local application URL.')
}
if (process.env.QUANTUM_ENVIRONMENT !== 'local' || process.env.SUPABASE_PROJECT_REF !== 'localquantumhrmsqa01') {
  throw new Error('Mutation QA requires the isolated local Supabase project.')
}
const supabaseURL = new URL(process.env.SUPABASE_URL || 'https://invalid.example')
if (!['127.0.0.1', 'localhost', '::1'].includes(supabaseURL.hostname)) {
  throw new Error('Mutation QA refused a non-local Supabase API URL.')
}

export default defineConfig({
  testDir: './mutation-tests',
  outputDir: './test-results/mutations',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['line'], ['html', { outputFolder: 'playwright-report-mutations', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    colorScheme: 'light',
    locale: 'en-PH',
    timezoneId: 'Asia/Manila',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
