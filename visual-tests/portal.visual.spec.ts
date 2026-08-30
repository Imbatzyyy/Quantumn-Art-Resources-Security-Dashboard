import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const fixedTime = new Date('2026-08-30T01:30:00.000Z')

async function prepare(page: Page, screen: string, viewport = { width: 1440, height: 900 }, theme: 'light' | 'dark' = 'light') {
  await page.setViewportSize(viewport)
  await page.clock.setFixedTime(fixedTime)
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.goto(`/visual.html?screen=${screen}`)
  await page.evaluate(() => document.fonts.ready)
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }))
  expect(dimensions.document, `document width ${dimensions.document}px exceeds viewport ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectRenderedContrast(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  if (result.violations.length) {
    throw new Error(result.violations.map((item) => `${item.id}: ${item.nodes.map((node) => node.target.join(' ')).join(', ')}`).join('\n'))
  }
}

async function capture(page: Page, name: string) {
  await expectNoHorizontalOverflow(page)
  await expectRenderedContrast(page)
  await expect(page).toHaveScreenshot(name)
}

test.describe('premium desktop baselines', () => {
  test('admin and employee sign-in pages remain visually distinct', async ({ page }) => {
    await prepare(page, 'admin-login')
    await capture(page, 'admin-login-desktop.png')
    await prepare(page, 'employee-login')
    await capture(page, 'employee-login-desktop.png')
  })

  test('admin action center', async ({ page }) => {
    await prepare(page, 'admin')
    await expect(page.getByRole('heading', { name: 'Good day, Alex.' })).toBeVisible()
    await capture(page, 'admin-action-center-desktop.png')
  })

  test('people directory and employee creation', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'People Directory' }).click()
    await capture(page, 'people-directory-desktop.png')
    await page.getByRole('button', { name: 'Create employee & login' }).click()
    await expect(page.getByRole('dialog', { name: 'Create employee account' })).toBeVisible()
    await capture(page, 'create-employee-desktop.png')
  })

  test('premium lifecycle checklist creation', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'On/Offboarding' }).click()
    await page.getByRole('button', { name: 'Start checklist' }).click()
    await expect(page.getByRole('dialog', { name: 'Start lifecycle checklist' })).toBeVisible()
    await capture(page, 'create-lifecycle-checklist-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'On/Offboarding' }).click()
    await page.getByRole('button', { name: 'Start checklist' }).click()
    await page.getByRole('radio', { name: /Offboarding/ }).click()
    await expect(page.getByText('Offboarding checklist preview')).toBeVisible()
    await capture(page, 'create-lifecycle-checklist-dark-desktop.png')
  })

  test('premium schedule assignment', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Time & Attendance' }).click()
    await page.getByRole('button', { name: 'Assign schedule' }).click()
    await expect(page.getByRole('dialog', { name: 'Assign or update schedule' })).toBeVisible()
    await capture(page, 'assign-schedule-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Time & Attendance' }).click()
    await page.getByRole('button', { name: 'Assign schedule' }).click()
    await page.getByRole('radio', { name: /Remote/ }).click()
    await expect(page.getByText('Approved remote workspace')).toBeVisible()
    await capture(page, 'assign-schedule-dark-desktop.png')
  })

  test('admin accounts and invitation', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Admin Accounts & Roles' }).click()
    await capture(page, 'admin-accounts-desktop.png')
    await page.getByRole('button', { name: 'Invite administrator' }).click()
    await expect(page.getByRole('dialog', { name: 'Invite administrator account' })).toBeVisible()
    await capture(page, 'invite-administrator-desktop.png')
  })

  test('premium announcement publishing', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Communications' }).click()
    await page.getByRole('button', { name: 'New announcement' }).click()
    await expect(page.getByRole('dialog', { name: 'Publish announcement' })).toBeVisible()
    await capture(page, 'publish-announcement-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Communications' }).click()
    await page.getByRole('button', { name: 'New announcement' }).click()
    await page.getByLabel('Title').fill('Quarterly security workshop')
    await page.getByRole('textbox', { name: 'Message' }).fill('Complete the secure-work workshop before Friday.')
    await page.getByRole('radio', { name: /High priority/ }).click()
    await expect(page.getByRole('heading', { name: 'Quarterly security workshop' })).toBeVisible()
    await capture(page, 'publish-announcement-dark-desktop.png')
  })

  test('premium protected HR document publishing', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Documents & Policy' }).click()
    await page.getByRole('button', { name: 'Publish document' }).click()
    await expect(page.getByRole('dialog', { name: 'Publish HR document' })).toBeVisible()
    await capture(page, 'publish-hr-document-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Documents & Policy' }).click()
    await page.getByRole('button', { name: 'Publish document' }).click()
    const dialog = page.getByRole('dialog', { name: 'Publish HR document' })
    await dialog.getByLabel('Title').fill('Remote Work Security Policy')
    await dialog.getByLabel('Filename').fill('remote-work-security-policy.txt')
    await dialog.getByLabel('Document text').fill('Use approved devices and report unfamiliar account activity immediately.')
    await dialog.getByLabel('Sensitive employee record').click()
    await expect(dialog.getByRole('heading', { name: 'Secure delivery preview' })).toBeVisible()
    await capture(page, 'publish-hr-document-dark-desktop.png')
  })

  test('premium performance cycle planning', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'New cycle' }).click()
    await expect(page.getByRole('dialog', { name: 'Create performance cycle' })).toBeVisible()
    await capture(page, 'create-performance-cycle-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'New cycle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create performance cycle' })
    await dialog.getByLabel('Cycle title').fill('Year-End Leadership Review')
    await dialog.getByLabel('Period label').fill('H2 2026')
    await dialog.getByRole('radio', { name: 'Review' }).click()
    await dialog.getByLabel('Start date').fill('2026-10-01')
    await dialog.getByLabel('End date').fill('2026-12-15')
    await expect(dialog.getByText('76 days')).toBeVisible()
    await capture(page, 'create-performance-cycle-dark-desktop.png')
  })

  test('premium payroll draft review', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Payroll Runs' }).click()
    await page.getByRole('button', { name: 'Generate payroll' }).click()
    await expect(page.getByRole('dialog', { name: 'Generate payroll draft' })).toBeVisible()
    await capture(page, 'generate-payroll-draft-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Payroll Runs' }).click()
    await page.getByRole('button', { name: 'Generate payroll' }).click()
    await expect(page.getByRole('dialog', { name: 'Generate payroll draft' })).toBeVisible()
    await capture(page, 'generate-payroll-draft-dark-desktop.png')
  })

  test('premium employee request review', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: /^Approvals/ }).click()
    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page.getByRole('dialog', { name: 'Review request #REQ-204' })).toBeVisible()
    await capture(page, 'review-employee-request-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: /^Approvals/ }).click()
    await page.getByRole('button', { name: 'Review' }).click()
    await page.getByRole('button', { name: /Private handoff/ }).click()
    await expect(page.getByLabel('Private HR handoff note')).toBeVisible()
    await capture(page, 'review-employee-request-dark-desktop.png')
  })

  test('security center and secure alert composer', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Security Center 1', exact: true }).click()
    await capture(page, 'security-center-desktop.png')
    await page.getByRole('button', { name: 'Create alert' }).click()
    await expect(page.getByRole('dialog', { name: 'Create a reviewable security alert' })).toBeVisible()
    await capture(page, 'create-security-alert-desktop.png')
  })

  test('employee workspace and request creation', async ({ page }) => {
    await prepare(page, 'employee')
    await expect(page.getByRole('heading', { name: 'Good day, Maya.' })).toBeVisible()
    await capture(page, 'employee-my-day-desktop.png')
    await page.getByRole('button', { name: 'Request Center', exact: true }).click()
    await capture(page, 'employee-request-center-desktop.png')
    await page.getByRole('button', { name: 'New request' }).click()
    await expect(page.getByRole('dialog', { name: 'Create an HR request' })).toBeVisible()
    await capture(page, 'employee-new-request-desktop.png')
  })

  test('admin and employee dark workspaces', async ({ page }) => {
    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await capture(page, 'admin-action-center-dark-desktop.png')
    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    await capture(page, 'employee-my-day-dark-desktop.png')
  })
})

test.describe('responsive mobile baselines', () => {
  const mobile = { width: 390, height: 844 }

  test('admin navigation', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Portal navigation' })).toBeVisible()
    await capture(page, 'admin-navigation-mobile.png')
  })

  test('employee navigation', async ({ page }) => {
    await prepare(page, 'employee', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Portal navigation' })).toBeVisible()
    await capture(page, 'employee-navigation-mobile.png')
  })

  test('employee creation dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'People Directory' }).click()
    await page.getByRole('button', { name: 'Create employee & login' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create employee account' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'create-employee-mobile.png')
  })

  test('payroll draft dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Payroll Runs' }).click()
    await page.getByRole('button', { name: 'Generate payroll' }).click()
    const dialog = page.getByRole('dialog', { name: 'Generate payroll draft' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'generate-payroll-draft-mobile.png')
  })

  test('lifecycle checklist dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'On/Offboarding' }).click()
    await page.getByRole('button', { name: 'Start checklist' }).click()
    const dialog = page.getByRole('dialog', { name: 'Start lifecycle checklist' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'create-lifecycle-checklist-mobile.png')
  })

  test('schedule assignment dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Time & Attendance' }).click()
    await page.getByRole('button', { name: 'Assign schedule' }).click()
    const dialog = page.getByRole('dialog', { name: 'Assign or update schedule' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'assign-schedule-mobile.png')
  })

  test('announcement publishing dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Communications' }).click()
    await page.getByRole('button', { name: 'New announcement' }).click()
    const dialog = page.getByRole('dialog', { name: 'Publish announcement' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'publish-announcement-mobile.png')
  })

  test('protected HR document publishing dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Documents & Policy' }).click()
    await page.getByRole('button', { name: 'Publish document' }).click()
    const dialog = page.getByRole('dialog', { name: 'Publish HR document' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'publish-hr-document-mobile.png')
  })

  test('performance cycle planning dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'New cycle' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create performance cycle' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'create-performance-cycle-mobile.png')
  })

  test('employee request review dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: /^Approvals/ }).click()
    await page.getByRole('button', { name: 'Review' }).click()
    const dialog = page.getByRole('dialog', { name: 'Review request #REQ-204' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'review-employee-request-mobile.png')
  })
})
