import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const sizes = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 844, height: 390 },
  { width: 900, height: 700 },
]

for (const portal of ['admin', 'employee'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const size of sizes) {
      test(`${portal} mobile navigation ${theme} ${size.width}x${size.height}`, async ({ page }) => {
        await page.setViewportSize(size)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.goto(`/visual.html?screen=${portal}&theme=${theme}`)
        const bottom = page.getByRole('navigation', { name: `${portal === 'admin' ? 'Administrator' : 'Employee'} mobile navigation` })
        await expect(bottom).toBeVisible()
        await expect(page.locator('.portal-sidebar')).toBeHidden()
        const labels = portal === 'admin' ? ['Center', 'People', 'Approvals', 'Security'] : ['My Day', 'Time', 'Requests', 'Inbox']
        await expect(bottom.getByRole('button')).toHaveCount(5)
        for (const label of labels) {
          const button = bottom.getByRole('button', { name: label, exact: true })
          await expect(button).toBeVisible()
          const box = await button.boundingBox()
          expect(box!.height).toBeGreaterThanOrEqual(44)
          expect(box!.width).toBeGreaterThanOrEqual(44)
        }
        const destination = portal === 'admin' ? { label: 'People', title: 'People Directory' } : { label: 'Requests', title: 'Request Center' }
        await bottom.getByRole('button', { name: destination.label, exact: true }).click()
        await expect(page.locator('.topbar-title strong')).toHaveText(destination.title)
        await expect(bottom.getByRole('button', { name: destination.label, exact: true })).toHaveAttribute('aria-current', 'page')

        await bottom.getByRole('button', { name: 'Open more navigation' }).click()
        const sheet = page.getByRole('dialog', { name: 'Explore your portal' })
        const close = sheet.getByRole('button', { name: 'Close more navigation' })
        await expect(close).toBeFocused()
        await expect(sheet.getByRole('searchbox')).not.toBeFocused()
        // The background is inert and primary destinations are not duplicated.
        await expect(page.locator('.portal-main')).toHaveAttribute('inert', '')
        await expect(sheet.getByRole('button', { name: destination.title, exact: true })).toHaveCount(0)
        await close.press('Shift+Tab')
        await expect(sheet.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused()
        await sheet.getByRole('button', { name: 'Sign out', exact: true }).press('Tab')
        await expect(close).toBeFocused()

        const audit = await new AxeBuilder({ page }).include('#mobile-more-navigation').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width)
        const sheetBox = await sheet.boundingBox()
        expect(sheetBox!.y).toBeGreaterThanOrEqual(0)
        expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(size.height + 1)

        const secondary = portal === 'admin' ? 'Admin Accounts & Roles' : 'My Profile'
        await sheet.getByRole('searchbox', { name: 'Search portal pages' }).fill(secondary)
        await sheet.getByRole('button', { name: secondary, exact: true }).click()
        await expect(sheet).toHaveCount(0)
        await expect(page.locator('.topbar-title strong')).toHaveText(secondary)
        await expect(bottom.getByRole('button', { name: 'Open more navigation' })).toHaveAttribute('aria-current', 'page')

        // Scroll the final content above the fixed bar, including the safe area.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        const contentBottom = await page.locator('.portal-content > *').last().boundingBox()
        const navBox = await bottom.boundingBox()
        expect(contentBottom!.y + contentBottom!.height).toBeLessThanOrEqual(navBox!.y)
      })
    }
  }

  test(`${portal} More closes on desktop resize without resetting page state`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/visual.html?screen=${portal}&theme=light`)
    const more = page.getByRole('button', { name: 'Open more navigation' })
    await more.click()
    await page.getByRole('searchbox', { name: 'Search portal pages' }).fill('documents')
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.getByRole('dialog', { name: 'Explore your portal' })).toHaveCount(0)
    await expect(page.locator('.portal-sidebar')).toBeVisible()
    await expect(more).toBeHidden()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.locator('.portal-sidebar')).toHaveCSS('width', '84px')
    await page.setViewportSize({ width: 390, height: 844 })
    await more.click()
    await expect(page.getByRole('searchbox', { name: 'Search portal pages' })).toHaveValue('')
    await page.getByRole('button', { name: 'Close more navigation', exact: true }).press('Escape')
    await expect(more).toBeFocused()
  })
}
