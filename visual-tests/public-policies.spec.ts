import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const theme of ['light', 'dark']) {
  for (const width of [320, 1440]) {
    for (const kind of ['terms', 'privacy']) {
      test(`public ${kind} readable in ${theme} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        const dataRequests: string[] = []
        page.on('request', request => { if (/supabase\.co|\/api\//.test(request.url())) dataRequests.push(request.url()) })
        await page.addInitScript(theme => {
          localStorage.setItem('quantum-hrms-theme', theme)
          document.documentElement.dataset.theme = theme
        }, theme)
        await page.goto(`/${kind}`)
        await expect(page.getByRole('heading', { level: 1, name: kind === 'terms' ? 'Terms and Conditions' : 'Privacy Notice' })).toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.getByRole('alert')).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'quantumnhr@gmail.com' })).toHaveAttribute('href', 'mailto:quantumnhr@gmail.com')
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
        await expect(page).toHaveScreenshot(`public-${kind}-${theme}-${width}.png`)
        expect(dataRequests).toEqual([])
        await page.getByRole('navigation', { name: 'On this page' }).getByRole('link').last().click()
        await expect(page.locator('.account-policy-sections section').last()).toBeInViewport()
        await page.getByRole('link', { name: 'Employee sign in', exact: true }).click()
        await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible()
        await page.getByRole('link', { name: 'Privacy Notice', exact: true }).click()
        await expect(page.getByRole('heading', { level: 1, name: 'Privacy Notice' })).toBeVisible()
      })
    }
  }
}
