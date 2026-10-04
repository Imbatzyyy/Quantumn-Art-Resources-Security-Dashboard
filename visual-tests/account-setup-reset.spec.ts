import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const theme of ['light', 'dark']) {
  for (const width of [320, 1440]) {
    test(`terms and privacy gate ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=employee&theme=${theme}&firstLogin=1`)
      const dialog = page.getByRole('dialog', { name: 'Secure your employee account' })
      await expect(dialog.getByRole('heading', { name: 'Before you set your password' })).toBeVisible()
      await expect(dialog.getByLabel('New password', { exact: true })).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
      await expect(page).toHaveScreenshot(`account-policies-${theme}-${width}.png`)
      await dialog.getByLabel('I have read and agree to the Terms and Conditions.').check()
      await expect(dialog.getByRole('button', { name: 'Continue to password' })).toBeDisabled()
      await dialog.getByLabel('I have read and acknowledge the Privacy Notice.').check()
      await dialog.getByRole('button', { name: 'Continue to password' }).click()
      await expect(dialog.getByLabel('New password', { exact: true })).toBeVisible()
      await dialog.getByRole('button', { name: 'Review terms & privacy' }).click()
      await expect(dialog.getByRole('heading', { name: 'Terms and Conditions' })).toBeVisible()
      await dialog.getByLabel('I have read and agree to the Terms and Conditions.').uncheck()
      await expect(dialog.getByRole('button', { name: 'Continue to password' })).toBeDisabled()
    })
    test(`admin reset confirmation ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&theme=${theme}`)
      if (width === 320) {
        await page.getByRole('button', { name: 'Open more navigation' }).click()
        await page.getByRole('dialog', { name: 'Explore your portal' }).getByRole('button', { name: 'Admin Accounts & Roles', exact: true }).click()
      } else {
        await page.getByRole('navigation', { name: 'Portal navigation' }).getByRole('button', { name: 'Admin Accounts & Roles', exact: true }).click()
      }
      await page.getByRole('button', { name: 'Reset password for Alex Reyes' }).click()
      const dialog = page.getByRole('dialog', { name: 'Reset administrator password' })
      await expect(dialog.getByText('alex.reyes@quantum.example')).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Send reset email' })).toBeDisabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
      await expect(page).toHaveScreenshot(`admin-reset-confirmation-${theme}-${width}.png`)
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await expect(dialog).toBeHidden()
    })
  }
}
