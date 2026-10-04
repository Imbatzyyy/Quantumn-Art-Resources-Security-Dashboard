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

test('admin sidebar theme applies to desktop and the mobile navigation surface', async ({ page }) => {
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
  await expect(sidebar).toBeHidden()
  await page.getByRole('button', { name: 'Open more navigation' }).click()
  const sheet = page.getByRole('dialog', { name: 'Explore your portal' })
  await expect(sheet.getByText('Administrator workspace', { exact: true })).toBeVisible()
  await expect(sheet).toHaveCSS('background-color', 'rgb(23, 32, 45)')
  await sheet.getByRole('button', { name: 'Close more navigation' }).click()
  await page.getByRole('button', { name: 'Toggle color theme' }).click()
  await page.getByRole('button', { name: 'Open more navigation' }).click()
  await expect(sheet).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(sheet.getByRole('button', { name: 'Time & Attendance', exact: true })).toBeVisible()
})

test('employee branding fits the collapsed desktop rail and mobile navigation stays role-specific', async ({ page }) => {
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
  await expect(sidebar).toBeHidden()
  await page.getByRole('button', { name: 'Open more navigation' }).click()
  const sheet = page.getByRole('dialog', { name: 'Explore your portal' })
  await expect(sheet.getByText('Employee workspace', { exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'My Profile', exact: true })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Admin Accounts & Roles', exact: true })).toHaveCount(0)
})
