import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { authenticatedAccounts } from '../playwright.authenticated.config.js'
import { capturedLocalCode, resetLocalEmailLimits, verifyLocalFixtureSession } from '../scripts/local-email-verification.mjs'

function authenticatorCode(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.toUpperCase().replace(/=+$/, '')].map(c => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('')
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(byte => parseInt(byte, 2)))
  const time = Buffer.alloc(8)
  time.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const digest = createHmac('sha1', key).update(time).digest()
  return String((digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1000000).padStart(6, '0')
}

for (const portal of ['admin', 'employee'] as const) {
  test(`${portal} can retry an offline workspace after verification without another email`, async ({ page }) => {
    resetLocalEmailLimits(process.env.SUPABASE_URL!)
    await page.setViewportSize({ width: 320, height: 700 })
    let emailRequests = 0
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/signin-email') emailRequests++ })
    await page.route('**/rest/v1/profiles?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Local QA offline fixture"}' }))
    const account = authenticatedAccounts[portal]
    await page.goto(`/${portal}/login`)
    await page.getByLabel('Work email').fill(account.email)
    await page.getByLabel('Password', { exact: true }).fill(account.password)
    await page.getByRole('button', { name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal' }).click()
    await expect(page.getByLabel('Email verification code')).toBeEnabled()
    const code = await capturedLocalCode(new URL(page.url()).origin, account.email, process.env.LOCAL_QA_CAPTURE_TOKEN)
    await page.getByLabel('Email verification code').fill(code!)
    await page.getByRole('button', { name: 'Verify & continue' }).click()
    await expect(page).toHaveURL(new RegExp(`/${portal}/?$`))
    // Preserve the SDK's bounded transient-error retries before offering ours.
    await expect(page.getByRole('alert')).toContainText('Your records could not load', { timeout: 15_000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Confirm sign out' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.unroute('**/rest/v1/profiles?*')
    await page.getByRole('button', { name: 'Try loading again' }).click()
    await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()
    expect(emailRequests).toBe(2) // One send and one verification, not a resend.
  })
  test(`${portal} still requires its enrolled authenticator after email verification`, async ({ page }) => {
    const apiUrl = process.env.SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    resetLocalEmailLimits(apiUrl)
    const options = { auth: { persistSession: false, autoRefreshToken: false } }
    const service = createClient(apiUrl, serviceRoleKey, options)
    const client = createClient(apiUrl, process.env.SUPABASE_PUBLISHABLE_KEY!, options)
    const account = authenticatedAccounts[portal]
    const login = await client.auth.signInWithPassword(account)
    expect(login.error).toBeNull()
    await verifyLocalFixtureSession({ apiUrl, serviceRoleKey }, service, login.data.session)
    const { data: factor, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Local email verification QA' })
    expect(error).toBeNull()
    try {
      expect((await client.auth.mfa.challengeAndVerify({ factorId: factor!.id, code: authenticatorCode(factor!.totp.secret) })).error).toBeNull()
      resetLocalEmailLimits(apiUrl)
      await page.goto(`/${portal}/login`)
      await page.getByLabel('Work email').fill(account.email)
      await page.getByLabel('Password', { exact: true }).fill(account.password)
      await page.getByRole('button', { name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal' }).click()
      await expect(page.getByLabel('Email verification code')).toBeEnabled()
      const code = await capturedLocalCode(new URL(page.url()).origin, account.email, process.env.LOCAL_QA_CAPTURE_TOKEN)
      await page.getByLabel('Email verification code').fill(code!)
      await page.getByRole('button', { name: 'Verify & continue' }).click()
      await expect(page.getByLabel('Authenticator code')).toBeEnabled()
      await expect(page.getByRole('heading', { name: 'One more security check' })).toBeVisible()
      await expect(page).toHaveURL(new RegExp(`/${portal}/verify-email$`))
      await page.getByLabel('Authenticator code').fill(authenticatorCode(factor!.totp.secret))
      await page.getByRole('button', { name: 'Verify & continue' }).click()
      await expect(page).toHaveURL(new RegExp(`/${portal}/?$`), { timeout: 20_000 })
    } finally {
      await service.auth.admin.mfa.deleteFactor({ userId: login.data.user!.id, id: factor!.id })
      await client.auth.signOut({ scope: 'local' })
    }
  })
  for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light']] as const) {
    test(`${portal} email verification is enforced and readable at ${width}px in ${theme}`, async ({ page }) => {
      resetLocalEmailLimits(process.env.SUPABASE_URL!)
      await page.setViewportSize({ width, height: 850 })
      await page.addInitScript(mode => localStorage.setItem('quantum-hrms-theme', mode), theme)
      const account = authenticatedAccounts[portal]
      await page.goto(`/${portal}/login`)
      await page.getByLabel('Work email').fill(account.email)
      await page.getByLabel('Password', { exact: true }).fill(account.password)
      await page.getByRole('button', { name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal' }).click()
      await expect(page).toHaveURL(new RegExp(`/${portal}/verify-email$`))
      const input = page.getByLabel('Email verification code')
      await expect(input).toBeEnabled()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.getByRole('button', { name: 'Send a new code' })).toBeDisabled()
      const code = await capturedLocalCode(new URL(page.url()).origin, account.email, process.env.LOCAL_QA_CAPTURE_TOKEN)
      expect(code).toMatch(/^\d{6}$/)
      const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
      await input.fill(wrong)
      await page.getByRole('button', { name: 'Verify & continue' }).click()
      await expect(page.getByRole('alert')).toContainText('incorrect')
      // The protected route cannot unlock a password-only session.
      await page.goto(`/${portal}`)
      await expect(page).toHaveURL(new RegExp(`/${portal}/login$`))
      await page.goto(`/${portal}/verify-email`)
      await expect(input).toBeEnabled()
      await page.reload()
      await expect(input).toBeEnabled()
      expect(await capturedLocalCode(new URL(page.url()).origin, account.email, process.env.LOCAL_QA_CAPTURE_TOKEN)).toBe(code)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(audit.violations).toEqual([])
      await page.screenshot({ path: `test-results/email-${portal}-${width}-${theme}.png`, fullPage: true })
      await input.fill(code!)
      await page.getByRole('button', { name: 'Verify & continue' }).click()
      await expect(page).toHaveURL(new RegExp(`/${portal}/?$`), { timeout: 20_000 })
      await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()
    })
  }
}
