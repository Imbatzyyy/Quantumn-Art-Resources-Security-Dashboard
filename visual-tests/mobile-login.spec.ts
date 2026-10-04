import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const sizes = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
]

async function expectFitsWidth(page: Page) {
  const size = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }))
  expect(size.document).toBeLessThanOrEqual(size.width + 1)
}

test.describe('wide phone landscape', () => {
  test.use({ viewport: { width: 932, height: 430 }, isMobile: true, hasTouch: true })
  for (const portal of ['admin', 'employee']) {
    test(`${portal} keeps the compact layout on a landscape phone`, async ({ page }) => {
      await page.goto(`/visual.html?screen=${portal}-login`)
      await expect(page.getByLabel('Work email')).toBeVisible()
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
      await expect(page.locator('.login-story-content')).toBeHidden()
      await expectFitsWidth(page)
      await expectReadable(page)
      await page.locator('.login-submit').scrollIntoViewIfNeeded()
      await expect(page.locator('.login-submit')).toBeInViewport()
    })
  }
})

async function expectReadable(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(['color-contrast', 'label', 'button-name', 'link-name']).analyze()
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.failureSummary) }))).toEqual([])
}

for (const portal of ['admin', 'employee']) {
  const submitName = portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal'
  for (const size of sizes) {
    test(`${portal} compact mobile login ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=${portal}-login&theme=dark`)
      await expect(page.getByLabel('Work email')).toBeVisible()
      await expect(page.locator('.login-story-content')).toBeHidden()
      await expect(page.locator('.login-story-footer')).toBeHidden()
      await expect(page.getByRole('img', { name: 'Quantumn Art Resources' })).toBeVisible()
      await expect(page.getByLabel('Work email')).toHaveCSS('font-size', '16px')
      await expect(page.getByRole('button', { name: 'Show password' })).toHaveCSS('height', '44px')
      await expectFitsWidth(page)
      await expectReadable(page)
      const button = page.getByRole('button', { name: submitName })
      if (size.height >= 568) {
        const box = await button.boundingBox()
        expect(box!.y + box!.height).toBeLessThanOrEqual(size.height)
      }
      if (size.height >= 568) {
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(size.height + 1)
      }
      if (size.width === 390 || size.width === 320) {
        await expect(page).toHaveScreenshot(`${portal}-login-mobile-${size.width}.png`)
      }
      await page.getByLabel('Password', { exact: true }).fill('fictional-layout-value')
      await page.getByRole('button', { name: 'Show password' }).click()
      await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
      await page.getByRole('button', { name: 'Hide password' }).click()
      await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
      if (portal === 'employee') {
        const recovery = page.getByRole('link', { name: 'Forgot password?' })
        await expect(recovery).toHaveAttribute('href', '/employee/forgot-password')
        const fieldBox = await page.locator('.password-field').boundingBox()
        const recoveryBox = await recovery.boundingBox()
        expect(recoveryBox!.y).toBeGreaterThanOrEqual(fieldBox!.y + fieldBox!.height)
        expect(Math.abs(recoveryBox!.x + recoveryBox!.width - fieldBox!.x - fieldBox!.width)).toBeLessThanOrEqual(1)
      }
    })
  }

  test(`${portal} errors remain readable in a short mobile viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/visual.html?screen=${portal}-login&loginState=error`)
    await page.getByLabel('Work email').fill('visual@example.test')
    await page.getByLabel('Password', { exact: true }).fill('fictional-layout-value')
    // Models reduced usable height, not a claim of physical keyboard testing.
    await page.setViewportSize({ width: 390, height: 360 })
    await expect(page.getByLabel('Work email')).toHaveValue('visual@example.test')
    await page.getByRole('button', { name: submitName }).click()
    await expect(page.getByRole('alert')).toContainText('fictional account')
    await page.getByRole('alert').scrollIntoViewIfNeeded()
    await expectFitsWidth(page)
    await expectReadable(page)
    await page.getByRole('button', { name: submitName }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: submitName })).toBeInViewport()
    await page.setViewportSize({ width: 320, height: 568 })
    await expectFitsWidth(page)
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test(`${portal} mobile authenticator and cancellation stay accessible`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(`/visual.html?screen=${portal}-login&loginState=mfa&theme=dark`)
    await page.getByLabel('Work email').fill('visual@example.test')
    await page.getByLabel('Password', { exact: true }).fill('fictional-layout-value')
    await page.getByRole('button', { name: submitName }).click()
    await expect(page.getByLabel('Authenticator code')).toBeVisible()
    await page.getByLabel('Authenticator code').fill('123456')
    await page.getByRole('button', { name: 'Verify & continue' }).click()
    await expect(page.getByRole('alert')).toContainText('fictional verification code')
    await expectFitsWidth(page)
    await expectReadable(page)
    await page.getByRole('button', { name: 'Use a different account' }).click()
    await expect(page.getByLabel('Work email')).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  })
}
