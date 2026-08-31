import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const pages = ['Action Center', 'People Directory', 'Time & Attendance', 'Approvals', 'On/Offboarding', 'Payroll Runs', 'Performance', 'Documents & Policy', 'Analytics & Reports', 'Communications', 'Security Center', 'Admin Accounts & Roles']
const securityTabs = ['Overview', 'Alerts', 'Sessions', 'Audit trail', 'Vulnerability testing', 'Security controls']
const forms = [
  { page: 'People Directory', buttons: ['Create employee & login'] },
  { page: 'People Directory', buttons: ['Open profile', 'Edit employee'] },
  { page: 'Time & Attendance', buttons: ['Assign schedule'] },
  { page: 'Approvals', buttons: ['Review'] },
  { page: 'On/Offboarding', buttons: ['Start checklist'] },
  { page: 'Payroll Runs', buttons: ['Generate payroll'] },
  { page: 'Payroll Runs', buttons: ['Advance to Validation'] },
  { page: 'Performance', buttons: ['New cycle'] },
  { page: 'Performance', buttons: ['Add goal'] },
  { page: 'Performance', buttons: ['New review'] },
  { page: 'Documents & Policy', buttons: ['Publish document'] },
  { page: 'Communications', buttons: ['New announcement'] },
  { page: 'Security Center', buttons: ['Create alert'] },
  { page: 'Admin Accounts & Roles', buttons: ['Invite administrator'] },
]

async function navigate(page: Page, name: string) {
  const accessibleName = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    const sheet = page.getByRole('dialog', { name: 'Explore your portal' })
    if (!await sheet.isVisible()) await page.getByRole('button', { name: 'Open more navigation', exact: true }).click()
    await sheet.getByRole('searchbox', { name: 'Search portal pages' }).fill(name)
    await sheet.getByRole('navigation', { name: 'All portal pages' }).getByRole('button', { name: accessibleName }).click()
  } else {
    await page.getByRole('navigation', { name: 'Portal navigation' }).getByRole('button', { name }).click()
  }
}

async function audit(page: Page, label: string) {
  const violations = (await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()).violations
  const failures = violations.flatMap((violation) => violation.nodes.map((node) => `${node.target.join(' ')}: ${node.failureSummary}`))
  const layout = await page.evaluate(() => {
    const problems: string[] = []
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`Page overflow: ${document.documentElement.scrollWidth} / ${innerWidth}`)
    const dialog = document.querySelector<HTMLElement>('.modal')
    if (dialog && dialog.scrollWidth > dialog.clientWidth + 2) {
      const edge = dialog.getBoundingClientRect().right
      const overflowing = [...dialog.querySelectorAll<HTMLElement>('*')].filter((el) => el.getBoundingClientRect().right > edge + 1).map((el) => `${el.tagName}.${el.className}`).slice(0, 8)
      problems.push(`Dialog overflow: ${dialog.scrollWidth} / ${dialog.clientWidth}: ${overflowing.join(', ')}`)
    }
    for (const element of document.querySelectorAll<HTMLElement>('.badge, .button, .security-tabs button, .stat-card strong, .stat-card p')) {
      if (!element.getClientRects().length) continue
      if (element.scrollWidth > element.clientWidth + 2) problems.push(`Clipped content: ${element.className} (${element.textContent?.trim().slice(0, 60)})`)
    }
    return problems
  })
  expect.soft([...failures, ...layout], label).toEqual([])
}

async function auditFullSurface(page: Page, label: string) {
  // Contrast checks depend on rendered visibility: also scan the middle and
  // bottom of long pages/dialogs, rather than only their first viewport.
  await page.evaluate(() => { (document.querySelector('.modal') ?? document.scrollingElement)!.scrollTop = 0 })
  for (let segment = 0; segment < 30; segment++) {
    await audit(page, `${label} section ${segment + 1}`)
    const more = await page.evaluate(() => {
      const surface = document.querySelector('.modal') ?? document.scrollingElement!
      if (surface.scrollTop + surface.clientHeight >= surface.scrollHeight - 2) return false
      surface.scrollTop = Math.min(surface.scrollTop + surface.clientHeight * .8, surface.scrollHeight - surface.clientHeight)
      return true
    })
    if (!more) return
  }
  throw new Error(`Unexpectedly long surface: ${label}`)
}

for (const theme of ['light', 'dark'] as const) {
  test(`empty admin pages ${theme}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto(`/visual.html?screen=admin&audit=empty&theme=${theme}`)
    for (const name of pages) {
      await navigate(page, name)
      await auditFullSurface(page, `Empty ${name} ${theme}`)
      if (name === 'Security Center') {
        for (const tab of securityTabs.slice(1)) {
          await page.getByRole('navigation', { name: 'Security operations sections' }).getByRole('button', { name: tab, exact: true }).click()
          await auditFullSurface(page, `Empty Security / ${tab} ${theme}`)
        }
      }
    }
  })

  test(`short landscape viewport and form resizing ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto(`/visual.html?screen=admin&audit=1&theme=${theme}`)
    await page.getByRole('button', { name: /Open admin notifications/ }).click()
    const attention = await page.getByLabel('Administrator attention center').boundingBox()
    expect(attention!.y + attention!.height).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: /Open admin notifications/ }).click()
    await navigate(page, 'People Directory')
    await page.getByRole('button', { name: 'Create employee & login', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const box = await dialog.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(390)
    await page.getByLabel('First name', { exact: true }).fill('Maya')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByLabel('First name', { exact: true })).toHaveValue('Maya')
    await expect(page.getByLabel('First name', { exact: true })).toHaveCSS('font-size', '16px')
    await dialog.getByRole('button', { name: 'Create employee & login', exact: true }).scrollIntoViewIfNeeded()
    await audit(page, `Landscape to portrait form footer ${theme}`)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  })

  for (const width of [1440, 768, 390, 320]) {
    test(`all admin destinations and security tabs ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(new Date('2026-08-30T01:30:00Z'))
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&audit=1&theme=${theme}`)
      await page.evaluate(() => document.fonts.ready)
      for (const name of pages) {
        await navigate(page, name)
        await auditFullSurface(page, `${name} ${theme} ${width}`)
        if (name === 'Security Center') {
          for (const tab of securityTabs.slice(1)) {
            await page.getByRole('navigation', { name: 'Security operations sections' }).getByRole('button', { name: tab, exact: true }).click()
            await auditFullSurface(page, `Security / ${tab} ${theme} ${width}`)
          }
        }
      }
    })
  }
  for (const width of [1440, 768, 390, 320]) {
    test(`admin detail tabs and utilities ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(new Date('2026-08-30T01:30:00Z'))
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&audit=1&theme=${theme}`)
      await page.getByRole('button', { name: /Open admin notifications/ }).click()
      await audit(page, `Admin attention ${theme} ${width}`)
      await page.getByRole('button', { name: /Open admin notifications/ }).click()
      const search = page.getByRole('combobox', { name: 'Find a portal page' })
      if (await search.isVisible()) {
        await search.fill('security')
        await audit(page, `Navigation search ${theme} ${width}`)
        await search.press('Escape')
      }
      await page.getByRole('button', { name: 'Toggle color theme' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light')
      await page.getByRole('button', { name: 'Toggle color theme' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await navigate(page, 'People Directory')
      await page.getByRole('button', { name: 'Open profile', exact: true }).first().click()
      for (const name of ['Overview', 'Attendance', 'Pay & benefits', 'Growth', 'Documents', 'Account access']) {
        await page.getByRole('tab', { name, exact: true }).click()
        await auditFullSurface(page, `Employee 360 ${name} ${theme} ${width}`)
      }
      await page.getByRole('tab', { name: 'Pay & benefits', exact: true }).click()
      await page.getByRole('button', { name: 'Add benefit', exact: true }).click()
      await auditFullSurface(page, `Benefit form ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await navigate(page, 'Security Center')
      await page.locator('.security-priority-list > button').first().click()
      await auditFullSurface(page, `Investigation ${theme} ${width}`)
      await page.getByLabel('Next status', { exact: false }).selectOption('Resolved')
      await auditFullSurface(page, `Investigation resolution ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await page.getByRole('navigation', { name: 'Security operations sections' }).getByRole('button', { name: 'Sessions', exact: true }).click()
      await page.getByRole('button', { name: 'Review & revoke', exact: true }).click()
      await auditFullSurface(page, `Session detail ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await page.getByRole('navigation', { name: 'Security operations sections' }).getByRole('button', { name: 'Vulnerability testing', exact: true }).click()
      await page.locator('.zap-findings-table > button').first().click()
      await auditFullSurface(page, `Vulnerability detail ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
    })

    test(`all admin forms ${theme} ${width}`, async ({ page }, testInfo) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(new Date('2026-08-30T01:30:00Z'))
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&audit=1&theme=${theme}`)
      for (const form of forms) {
        await navigate(page, form.page)
        for (const name of form.buttons) await page.getByRole('button', { name, exact: true }).first().click({ timeout: 5_000 })
        const dialog = page.getByRole('dialog').last()
        await expect(dialog).toBeVisible()
        if (form.buttons.at(-1) === 'Create employee & login') await page.screenshot({ path: testInfo.outputPath('employee-form-top.png') })
        await auditFullSurface(page, `${form.buttons.at(-1)} ${theme} ${width}`)
        if (form.buttons.at(-1) === 'Create employee & login') await page.screenshot({ path: testInfo.outputPath('employee-form-footer.png') })
        if (form.buttons.at(-1) === 'Invite administrator') {
          for (const label of await dialog.locator('.admin-role-selector > label').all()) {
            await label.click()
            await audit(page, `Role choice ${await label.innerText()} ${theme} ${width}`)
          }
        }
        if (form.buttons.at(-1) === 'Add goal') {
          for (const button of await dialog.locator('.goal-category-suggestions button').all()) {
            await button.click()
            await audit(page, `Goal category ${await button.innerText()} ${theme} ${width}`)
          }
        }
        await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click()
      }
    })
  }
}
