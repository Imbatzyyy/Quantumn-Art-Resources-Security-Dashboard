import { expect, test } from '@playwright/test'

for (const portal of ['admin', 'employee']) {
  test(`${portal} uses light by default and restores both saved themes`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    // No fixture theme: exercise the production preference logic.
    await page.goto(`/visual.html?screen=${portal}`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    for (const theme of ['dark', 'light']) {
      await page.getByRole('button', { name: 'Toggle color theme' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await page.reload()
      await expect(page.getByRole('button', { name: 'Toggle color theme' })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    }
  })
}

test('admin sidebar theme applies to desktop, collapsed, and mobile navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/visual.html?screen=admin')
  const sidebar = page.locator('.portal-sidebar')
  await expect(sidebar).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(sidebar.locator('.sidebar-brand-full')).toHaveCSS('filter', 'none')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(sidebar.locator('.sidebar-brand-full')).toBeHidden()
  await expect(sidebar.locator('.sidebar-brand-mark')).toBeVisible()
  await expect(sidebar.getByText('Operations Console', { exact: true })).toBeHidden()
  const collapsedBounds = await sidebar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(collapsedBounds.scrollWidth).toBeLessThanOrEqual(collapsedBounds.clientWidth)
  await page.getByRole('button', { name: 'Toggle color theme' }).click()
  await expect(sidebar).not.toHaveCSS('background-image', 'none')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(sidebar.getByRole('navigation')).toBeVisible()
  await expect(sidebar.locator('.sidebar-brand-full')).toBeVisible()
  await expect(sidebar.locator('.sidebar-brand-mark')).toBeHidden()
  await expect(sidebar.getByText('Operations Console', { exact: true })).toBeVisible()
  await expect(sidebar).not.toHaveCSS('background-image', 'none')
  await sidebar.getByRole('button', { name: 'Close menu' }).click()
  await page.getByRole('button', { name: 'Toggle color theme' }).click()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(sidebar).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(sidebar.getByRole('button', { name: /People Directory/ })).toBeVisible()
})

test('employee branding fits collapsed desktop rail and restores in mobile drawer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/visual.html?screen=employee')
  const sidebar = page.locator('.portal-sidebar')
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  await expect(sidebar.locator('.sidebar-brand-full')).toBeHidden()
  await expect(sidebar.locator('.sidebar-brand-mark')).toBeVisible()
  await expect(sidebar.getByText('People Portal', { exact: true })).toBeHidden()
  const collapsedBounds = await sidebar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(collapsedBounds.scrollWidth).toBeLessThanOrEqual(collapsedBounds.clientWidth)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(sidebar.locator('.sidebar-brand-full')).toBeVisible()
  await expect(sidebar.locator('.sidebar-brand-mark')).toBeHidden()
  await expect(sidebar.getByText('People Portal', { exact: true })).toBeVisible()
})
