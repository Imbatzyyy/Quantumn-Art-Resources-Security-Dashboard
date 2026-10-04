import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

const pages = ['Dashboard', 'People Directory', 'Time & Attendance', 'Approvals', 'Onboarding & Offboarding', 'Payroll', 'Performance', 'Documents & Policies', 'Announcements', 'Reports & Analytics', 'Security Center', 'Admin Accounts', 'My Account Security']
const securityTabs = ['Overview', 'Alerts', 'Sign-in sessions', 'Audit log', 'Vulnerability scans', 'Safeguards']
const fixedTime = new Date('2026-09-01T01:30:00Z')

type Step = (page: Page) => Promise<unknown>
const click = (name: string | RegExp): Step => (page) => page.getByRole('button', { name, exact: typeof name === 'string' }).first().click({ timeout: 5_000 })
const tab = (name: string | RegExp): Step => (page) => page.getByRole('tab', { name }).first().click({ timeout: 5_000 })
const forms: Array<{ page: string; label: string; steps: Step[] }> = [
  { page: 'People Directory', label: 'Add employee', steps: [click('Add employee')] },
  { page: 'People Directory', label: 'Edit employee', steps: [click(/^Open /), click('Edit employee')] },
  { page: 'Time & Attendance', label: 'Assign shifts', steps: [click('Assign shifts')] },
  { page: 'Approvals', label: 'Approve leave', steps: [click('Approve')] },
  { page: 'Approvals', label: 'Review request', steps: [tab(/^HR requests/), click(/^Review /)] },
  { page: 'Onboarding & Offboarding', label: 'Start checklist', steps: [click('Start checklist')] },
  { page: 'Payroll', label: 'Generate payroll', steps: [click('Generate payroll')] },
  { page: 'Payroll', label: 'Payroll stage change', steps: [click(/^Move to /)] },
  { page: 'Payroll', label: 'Payslip preview', steps: [click(/^Preview payslip for /)] },
  { page: 'Performance', label: 'New cycle', steps: [click('New cycle')] },
  { page: 'Performance', label: 'Add goal', steps: [click('Add goal')] },
  { page: 'Performance', label: 'New review', steps: [click('New review')] },
  { page: 'Documents & Policies', label: 'Publish document', steps: [click('Publish document')] },
  { page: 'Documents & Policies', label: 'Document acknowledgements', steps: [click(/^Open Information Security Policy/)] },
  { page: 'Announcements', label: 'New announcement', steps: [click('New announcement')] },
  { page: 'Security Center', label: 'Create alert', steps: [click('Create alert')] },
  { page: 'Admin Accounts', label: 'Invite administrator', steps: [click('Invite administrator')] },
]

async function navigate(page: Page, name: string) {
  const accessibleName = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    const sheet = page.getByRole('dialog', { name: 'All pages' })
    if (!await sheet.isVisible()) await page.getByRole('button', { name: 'Open more navigation', exact: true }).click()
    await sheet.getByRole('searchbox', { name: 'Search portal pages' }).fill(name)
    await sheet.getByRole('navigation', { name: 'All portal pages' }).getByRole('button', { name: accessibleName }).click()
  } else {
    await page.getByRole('navigation', { name: 'Portal navigation' }).getByRole('button', { name: accessibleName }).click()
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
    for (const element of document.querySelectorAll<HTMLElement>('.badge, .button, .tabs [role="tab"], .stat-card strong, .stat-card p')) {
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
  await page.evaluate(() => { (document.querySelector('.modal-content') ?? document.scrollingElement)!.scrollTop = 0 })
  for (let segment = 0; segment < 40; segment++) {
    await audit(page, `${label} section ${segment + 1}`)
    const more = await page.evaluate(() => {
      const surface = document.querySelector('.modal-content') ?? document.scrollingElement!
      if (surface.scrollTop + surface.clientHeight >= surface.scrollHeight - 2) return false
      surface.scrollTop = Math.min(surface.scrollTop + surface.clientHeight * .8, surface.scrollHeight - surface.clientHeight)
      return true
    })
    if (!more) return
  }
  throw new Error(`Unexpectedly long surface: ${label}`)
}

async function auditSecurityTabs(page: Page, label: string) {
  for (const name of securityTabs.slice(1)) {
    await page.getByRole('tablist', { name: 'Security Center sections' }).getByRole('tab', { name: new RegExp(`^${name}`) }).click()
    await auditFullSurface(page, `${label} / ${name}`)
  }
}

const closeDialogs = async (page: Page) => {
  for (let open = await page.getByRole('dialog').count(); open > 0; open -= 1) {
    const dialog: Locator = page.getByRole('dialog').last()
    const close = dialog.getByRole('button', { name: 'Close dialog', exact: true })
    if (await close.count()) await close.click()
    else await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(open - 1)
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`empty admin pages ${theme}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto(`/visual.html?screen=admin&audit=empty&theme=${theme}`)
    for (const name of pages) {
      await navigate(page, name)
      await auditFullSurface(page, `Empty ${name} ${theme}`)
      if (name === 'Security Center') await auditSecurityTabs(page, `Empty Security ${theme}`)
    }
  })

  test(`short landscape viewport and form resizing ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
    await page.goto(`/visual.html?screen=admin&theme=${theme}`)
    await page.getByRole('button', { name: /^Notifications/ }).click()
    const attention = await page.getByLabel('Items that need attention').boundingBox()
    expect(attention!.y + attention!.height).toBeLessThanOrEqual(390)
    await page.getByRole('button', { name: /^Notifications/ }).click()
    await navigate(page, 'People Directory')
    await page.getByRole('button', { name: 'Add employee', exact: true }).first().click()
    const dialog = page.getByRole('dialog')
    const box = await dialog.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(391)
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
      test.setTimeout(300_000)
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(fixedTime)
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&theme=${theme}`)
      await page.evaluate(() => document.fonts.ready)
      for (const name of pages) {
        await navigate(page, name)
        await auditFullSurface(page, `${name} ${theme} ${width}`)
        if (name === 'Security Center') await auditSecurityTabs(page, `Security ${theme} ${width}`)
      }
    })

    test(`admin detail tabs and utilities ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(fixedTime)
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&theme=${theme}`)
      await page.getByRole('button', { name: /^Notifications/ }).click()
      await audit(page, `Admin attention ${theme} ${width}`)
      await page.getByRole('button', { name: /^Notifications/ }).click()
      const search = page.getByRole('combobox', { name: /^Search people/ })
      if (await search.isVisible()) {
        await search.fill('ma')
        await audit(page, `Global search ${theme} ${width}`)
        await search.press('Escape')
      }
      await page.getByRole('button', { name: 'Dark mode' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light')
      await page.getByRole('button', { name: 'Dark mode' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await navigate(page, 'People Directory')
      await page.getByRole('button', { name: /^Open / }).first().click()
      for (const name of ['Overview', 'Attendance', 'Leave', 'Pay & benefits', 'Growth', 'Documents', 'Activity', 'Account access']) {
        await page.getByRole('tab', { name, exact: true }).click()
        await auditFullSurface(page, `Employee profile ${name} ${theme} ${width}`)
      }
      await page.getByRole('tab', { name: 'Pay & benefits', exact: true }).click()
      await page.getByRole('button', { name: 'Add benefit', exact: true }).click()
      await auditFullSurface(page, `Benefit form ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await navigate(page, 'People Directory')
      await page.getByRole('button', { name: 'Org chart' }).click()
      await auditFullSurface(page, `Org chart ${theme} ${width}`)
      await navigate(page, 'Time & Attendance')
      await page.getByRole('tab', { name: 'Weekly roster' }).click()
      await auditFullSurface(page, `Weekly roster ${theme} ${width}`)
      await navigate(page, 'Approvals')
      await page.getByRole('tab', { name: 'History' }).click()
      await auditFullSurface(page, `Approval history ${theme} ${width}`)
      await navigate(page, 'Security Center')
      await page.locator('.security-priority-list > button').first().click()
      await auditFullSurface(page, `Investigation ${theme} ${width}`)
      await page.getByLabel('Next status', { exact: false }).selectOption('Resolved')
      await auditFullSurface(page, `Investigation resolution ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await page.getByRole('tablist', { name: 'Security Center sections' }).getByRole('tab', { name: 'Sign-in sessions' }).click()
      await page.getByRole('button', { name: 'Review & revoke', exact: true }).first().click()
      await auditFullSurface(page, `Session detail ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
      await page.getByRole('tablist', { name: 'Security Center sections' }).getByRole('tab', { name: 'Vulnerability scans' }).click()
      await page.locator('.zap-findings-table > button').first().click()
      await auditFullSurface(page, `Vulnerability detail ${theme} ${width}`)
      await page.getByRole('button', { name: 'Close dialog' }).click()
    })

    test(`all admin forms ${theme} ${width}`, async ({ page }) => {
      test.setTimeout(600_000)
      await page.setViewportSize({ width, height: 900 })
      await page.clock.setFixedTime(fixedTime)
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/visual.html?screen=admin&theme=${theme}`)
      for (const form of forms) {
        await navigate(page, form.page)
        for (const step of form.steps) await step(page)
        const dialog = page.getByRole('dialog').last()
        await expect(dialog).toBeVisible()
        await auditFullSurface(page, `${form.label} ${theme} ${width}`)
        if (form.label === 'Invite administrator') {
          for (const radio of await dialog.getByRole('radio').all()) {
            await radio.check()
            await audit(page, `Role choice ${await radio.getAttribute('value')} ${theme} ${width}`)
          }
        }
        if (form.label === 'Add goal') {
          for (const button of await dialog.locator('.rf-chips button').all()) {
            await button.click()
            await audit(page, `Goal category ${await button.innerText()} ${theme} ${width}`)
          }
        }
        await closeDialogs(page)
      }
    })
  }
}
