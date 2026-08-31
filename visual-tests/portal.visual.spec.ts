import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const fixedTime = new Date('2026-08-30T01:30:00.000Z')

const employeeDestinations = [
  { slug: 'my-day', label: 'My Day' },
  { slug: 'time-schedule', label: 'Time & Schedule' },
  { slug: 'leave', label: 'Leave' },
  { slug: 'request-center', label: 'Request Center' },
  { slug: 'action-inbox', label: 'Action Inbox' },
  { slug: 'pay-benefits', label: 'Pay & Benefits' },
  { slug: 'goals-growth', label: 'Goals & Growth' },
  { slug: 'documents', label: 'Documents' },
  { slug: 'hr-help-center', label: 'HR Help Center' },
  { slug: 'my-journey', label: 'My Journey' },
  { slug: 'account-security', label: 'Account Security' },
  { slug: 'my-profile', label: 'My Profile' },
] as const

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

async function navigateEmployeePage(page: Page, label: string, mobile = false) {
  if (label === 'My Day') return
  if (mobile) await page.getByRole('button', { name: 'Open menu' }).click()
  await page.locator('.portal-nav button').filter({ hasText: label }).click()
  await expect(page.locator('.topbar-title strong')).toHaveText(label)
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

  test('admin portal search and attention controls', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Open admin notifications, 3 items need attention' }).click()
    await expect(page.getByLabel('Administrator attention center')).toBeVisible()
    await capture(page, 'admin-attention-menu-desktop.png')

    await page.getByRole('button', { name: 'Open admin notifications, 3 items need attention' }).click()
    await page.getByRole('combobox', { name: 'Find a portal page' }).fill('security')
    await expect(page.getByRole('option', { name: /Security Center/ })).toBeVisible()
    await capture(page, 'admin-portal-search-desktop.png')
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

  test('premium employee goal assignment', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'Add goal' }).click()
    await expect(page.getByRole('dialog', { name: 'Assign employee goal' })).toBeVisible()
    await capture(page, 'assign-employee-goal-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'Add goal' }).click()
    const dialog = page.getByRole('dialog', { name: 'Assign employee goal' })
    await dialog.getByLabel('Goal title').fill('Lead the quarterly operations review')
    await dialog.getByRole('button', { name: 'Leadership' }).click()
    await dialog.getByLabel('Due date').fill('2026-12-15')
    await dialog.getByLabel('Description').fill('Present measurable improvements and document next-quarter actions.')
    await expect(dialog.getByRole('heading', { name: 'Lead the quarterly operations review' })).toBeVisible()
    await capture(page, 'assign-employee-goal-dark-desktop.png')
  })

  test('premium private performance review', async ({ page }) => {
    await prepare(page, 'admin')
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'New review' }).click()
    await expect(page.getByRole('dialog', { name: 'Save performance review draft' })).toBeVisible()
    await capture(page, 'save-performance-review-desktop.png')

    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'New review' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save performance review draft' })
    await dialog.getByLabel('Overall score').fill('94')
    await dialog.getByLabel('Goal progress').fill('91')
    await dialog.getByLabel('Quality').fill('93')
    await dialog.getByLabel('Productivity').fill('92')
    await dialog.getByLabel('Teamwork').fill('96')
    await dialog.getByLabel('Comments').fill('Delivered measurable results and supported team execution.')
    await expect(dialog.getByRole('heading', { name: 'Outstanding' })).toBeVisible()
    await capture(page, 'save-performance-review-dark-desktop.png')
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

    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Request Center', exact: true }).click()
    await page.getByRole('button', { name: 'New request' }).click()
    const dialog = page.getByRole('dialog', { name: 'Create an HR request' })
    await dialog.getByLabel('Request type').selectOption('Payroll Concern')
    await dialog.getByRole('radio', { name: /High/ }).click()
    await dialog.getByLabel('Subject').fill('Review August payslip deduction')
    await dialog.getByLabel('Details').fill('The deduction shown on my August payslip does not match the approved benefits record.')
    await expect(dialog.getByText('Payroll Operations')).toBeVisible()
    await capture(page, 'employee-new-request-dark-desktop.png')
  })

  test('premium employee leave request', async ({ page }) => {
    await prepare(page, 'employee')
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await page.getByRole('button', { name: 'New leave request' }).click()
    await expect(page.getByRole('dialog', { name: 'Request leave' })).toBeVisible()
    await capture(page, 'employee-leave-request-desktop.png')

    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await page.getByRole('button', { name: 'New leave request' }).click()
    const dialog = page.getByRole('dialog', { name: 'Request leave' })
    await dialog.getByLabel('Leave type').selectOption('Vacation')
    await dialog.getByLabel('Start date').fill('2026-09-03')
    await dialog.getByLabel('End date').fill('2026-09-05')
    await dialog.getByLabel('Reason').fill('Family commitment outside the city')
    await expect(dialog.getByLabel('Calculated duration')).toHaveValue('3 days')
    await expect(dialog.getByRole('button', { name: 'Submit leave request' })).toBeEnabled()
    await capture(page, 'employee-leave-request-dark-desktop.png')
  })

  test('premium employee password change', async ({ page }) => {
    await prepare(page, 'employee')
    await page.getByRole('button', { name: 'Account Security' }).click()
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('dialog', { name: 'Change your password' })).toBeVisible()
    await capture(page, 'employee-change-password-desktop.png')

    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'Account Security' }).click()
    await page.getByRole('button', { name: 'Change password' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change your password' })
    await dialog.getByLabel('Current password').fill('Current passphrase for visual test')
    await dialog.getByLabel('New private password').fill('Lavender trains orbit quietly 2026!')
    await dialog.getByLabel('Confirm password').fill('Lavender trains orbit quietly 2026!')
    await expect(dialog.getByText('Passwords match.')).toBeVisible()
    await expect(dialog.getByText('Very strong')).toBeVisible()
    await capture(page, 'employee-change-password-dark-desktop.png')
  })

  test('premium employee profile and private photo editor', async ({ page }) => {
    await prepare(page, 'employee')
    await page.getByRole('button', { name: 'My Profile' }).click()
    await expect(page.getByRole('heading', { name: 'Maya Santos' })).toBeVisible()
    for (const label of ['HR managed', 'Connected']) {
      const status = page.getByText(label, { exact: true })
      await expect(status).toBeVisible()
      const dimensions = await status.evaluate((element) => ({
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
      }))
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
      expect(dimensions.clientWidth).toBeGreaterThan(dimensions.clientHeight)
    }
    await capture(page, 'employee-profile-desktop.png')
    await page.getByRole('button', { name: 'Edit profile' }).click()
    await page.getByLabel('Phone number').fill('+63 917 555 0198')
    await page.getByRole('button', { name: 'Save changes' }).click()
    const saveConfirmation = page.getByRole('dialog', { name: 'Confirm profile changes' })
    await expect(saveConfirmation).toBeVisible()
    await expect(saveConfirmation.getByText('+63 917 555 0198')).toBeVisible()
    await capture(page, 'employee-profile-save-confirmation-desktop.png')
    await saveConfirmation.getByRole('button', { name: 'Keep editing' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    await page.getByRole('button', { name: 'My Profile' }).click()
    await page.getByLabel('Choose profile picture').setInputFiles('assets/images/default-avatar.png')
    const editor = page.getByRole('dialog', { name: 'Crop your profile picture' })
    await expect(editor).toBeVisible()
    await editor.getByLabel('Photo zoom').fill('1.35')
    await editor.getByLabel('Horizontal photo position').fill('18')
    await editor.getByLabel('Vertical photo position').fill('-12')
    await expect(editor.getByLabel('Profile photo crop preview')).toBeVisible()
    await capture(page, 'employee-profile-photo-editor-dark-desktop.png')
  })

  test('admin and employee dark workspaces', async ({ page }) => {
    await prepare(page, 'admin', { width: 1440, height: 900 }, 'dark')
    await capture(page, 'admin-action-center-dark-desktop.png')
    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    await capture(page, 'employee-my-day-dark-desktop.png')
  })

  test('every employee destination remains dark-mode compatible', async ({ page }) => {
    await prepare(page, 'employee', { width: 1440, height: 900 }, 'dark')
    for (const destination of employeeDestinations) {
      await navigateEmployeePage(page, destination.label)
      await capture(page, `employee-${destination.slug}-dark-desktop.png`)
    }
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

  test('admin attention menu', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open admin notifications, 3 items need attention' }).click()
    await expect(page.getByLabel('Administrator attention center')).toBeVisible()
    await capture(page, 'admin-attention-menu-mobile.png')
  })

  test('employee navigation', async ({ page }) => {
    await prepare(page, 'employee', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Portal navigation' })).toBeVisible()
    await capture(page, 'employee-navigation-mobile.png')
  })

  test('employee request creation', async ({ page }) => {
    await prepare(page, 'employee', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Request Center', exact: true }).click()
    await page.getByRole('button', { name: 'New request' }).click()
    await expect(page.getByRole('dialog', { name: 'Create an HR request' })).toBeVisible()
    await capture(page, 'employee-new-request-mobile.png')
  })

  test('employee leave request dialog', async ({ page }) => {
    await prepare(page, 'employee', mobile, 'dark')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Leave', exact: true }).click()
    await page.getByRole('button', { name: 'New leave request' }).click()
    const dialog = page.getByRole('dialog', { name: 'Request leave' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'employee-leave-request-dark-mobile.png')
  })

  test('employee password change dialog', async ({ page }) => {
    await prepare(page, 'employee', mobile, 'dark')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Account Security' }).click()
    await page.getByRole('button', { name: 'Change password' }).click()
    const dialog = page.getByRole('dialog', { name: 'Change your password' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'employee-change-password-dark-mobile.png')
  })

  test('employee profile photo editor on mobile', async ({ page }) => {
    await prepare(page, 'employee', mobile, 'dark')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'My Profile' }).click()
    await page.getByRole('button', { name: 'Edit profile' }).click()
    await page.getByLabel('Phone number').fill('+63 917 555 0198')
    await page.getByRole('button', { name: 'Save changes' }).click()
    const confirmation = page.getByRole('dialog', { name: 'Confirm profile changes' })
    await expect(confirmation).toBeVisible()
    const confirmationBox = await confirmation.boundingBox()
    expect(confirmationBox?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'employee-profile-save-confirmation-dark-mobile.png')
    await confirmation.getByRole('button', { name: 'Keep editing' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByLabel('Choose profile picture').setInputFiles('assets/images/default-avatar.png')
    const editor = page.getByRole('dialog', { name: 'Crop your profile picture' })
    await expect(editor).toBeVisible()
    const box = await editor.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'employee-profile-photo-editor-dark-mobile.png')
  })

  test('every employee destination remains usable in mobile dark mode', async ({ page }) => {
    await prepare(page, 'employee', mobile, 'dark')
    for (const destination of employeeDestinations) {
      await navigateEmployeePage(page, destination.label, true)
      await expectNoHorizontalOverflow(page)
      await expectRenderedContrast(page)
    }

    const accountControls = page.locator('.personal-security-controls article')
    await navigateEmployeePage(page, 'Account Security', true)
    await expect(accountControls.first()).toBeVisible()
    const firstControl = await accountControls.first().boundingBox()
    expect(firstControl?.width ?? 0).toBeGreaterThan(300)
    await capture(page, 'employee-account-security-dark-mobile.png')
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

  test('employee goal assignment dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'Add goal' }).click()
    const dialog = page.getByRole('dialog', { name: 'Assign employee goal' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'assign-employee-goal-mobile.png')
  })

  test('private performance review dialog', async ({ page }) => {
    await prepare(page, 'admin', mobile)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Performance' }).click()
    await page.getByRole('button', { name: 'New review' }).click()
    const dialog = page.getByRole('dialog', { name: 'Save performance review draft' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    expect(box?.width ?? 9999).toBeLessThanOrEqual(mobile.width)
    await capture(page, 'save-performance-review-mobile.png')
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
