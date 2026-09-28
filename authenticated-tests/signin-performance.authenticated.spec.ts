import { expect, test } from '@playwright/test'
import { authenticatedAccounts } from '../playwright.authenticated.config.js'
import { capturedLocalCode, resetLocalEmailLimits } from '../scripts/local-email-verification.mjs'

// Local-only, fictional accounts. A fixed request delay exposes serial waterfalls;
// these measurements are not production inbox-delivery guarantees.
for (const portal of ['admin', 'employee'] as const) {
  test(`${portal} sign-in request and transfer budget`, async ({ page }, testInfo) => {
    resetLocalEmailLimits(process.env.SUPABASE_URL!)
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/api/') || url.port === '54321') await new Promise(resolve => setTimeout(resolve, 120))
      await route.continue()
    })
    const requests: { phase: string; path: string }[] = []
    let phase = 'ready'
    let bytes = 0
    const bodies: Promise<void>[] = []
    page.on('request', request => {
      const url = new URL(request.url())
      if (url.port === '54321' || url.pathname.startsWith('/api/signin-email')) requests.push({ phase, path: url.pathname })
    })
    page.on('response', response => {
      // Count decoded data bytes only; never print or save their contents/tokens.
      const url = new URL(response.url())
      if (url.port === '54321' && url.pathname.startsWith('/rest/')) bodies.push(response.body().then(body => { bytes += body.length }).catch(() => undefined))
    })
    const account = authenticatedAccounts[portal]
    await page.goto(`/${portal}/login`)
    await page.getByLabel('Work email').fill(account.email)
    await page.getByLabel('Password', { exact: true }).fill(account.password)
    phase = 'send'
    const sendStart = Date.now()
    await page.getByRole('button', { name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal' }).click()
    await expect(page.getByLabel('Email verification code')).toBeEnabled()
    const readyMs = Date.now() - sendStart
    const code = await capturedLocalCode(new URL(page.url()).origin, account.email, process.env.LOCAL_QA_CAPTURE_TOKEN)
    await page.getByLabel('Email verification code').fill(code!)
    phase = 'verify'
    const verifyStart = Date.now()
    await page.getByRole('button', { name: 'Verify & continue' }).click()
    await expect(page).toHaveURL(new RegExp(`/${portal}/?$`), { timeout: 20_000 })
    const verifiedMs = Date.now() - verifyStart
    await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()
    const readyWorkspaceMs = Date.now() - verifyStart
    await Promise.all(bodies)
    const measurements = { portal, fixedBrowserRequestDelayMs: 120, readyMs, verifiedMs, readyWorkspaceMs, decodedSupabaseRestBytes: bytes, requestsBeforeEmail: requests.filter(r => r.phase === 'send').length, requestsAfterCode: requests.filter(r => r.phase === 'verify').length, paths: requests }
    expect(measurements.requestsBeforeEmail).toBe(2) // Password + one email request.
    expect(measurements.requestsAfterCode).toBeLessThanOrEqual(29)
    const afterCode = requests.filter(r => r.phase === 'verify').map(r => r.path)
    expect(afterCode.filter(path => path.endsWith('/finish_hrms_signin'))).toHaveLength(1)
    expect(afterCode.filter(path => /\/(signin_email_context|get_hrms_identity|record_hrms_session)$/.test(path))).toHaveLength(0)
    expect(afterCode.filter(path => path.endsWith('/profiles'))).toHaveLength(1)
    console.log(`SIGNIN_PERFORMANCE ${JSON.stringify(measurements)}`)
    await testInfo.attach('sign-in-metrics', { contentType: 'application/json', body: JSON.stringify(measurements, null, 2) })
  })
}
