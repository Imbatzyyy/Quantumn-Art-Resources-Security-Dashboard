import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Tuesday, 9:30 AM in Manila. Fixture records are relative to "today".
const fixedTime = new Date('2026-09-01T01:30:00.000Z')
const desktop = { width: 1440, height: 900 }
const mobile = { width: 390, height: 844 }
type Theme = 'light' | 'dark'

const adminPages = [
  ['dashboard', 'Good morning, Alex'],
  ['people', 'People Directory'],
  ['people/EMP001', 'Maya Santos'],
  ['time', 'Time & Attendance'],
  ['approvals', 'Approvals'],
  ['onboarding', 'Onboarding & Offboarding'],
  ['payroll', 'Payroll'],
  ['performance', 'Performance'],
  ['documents', 'Documents & Policies'],
  ['announcements', 'Announcements'],
  ['reports', 'Reports & Analytics'],
  ['security', 'Security Center'],
  ['admin-accounts', 'Admin Accounts'],
  ['my-security', 'My Account Security'],
] as const

const employeePages = [
  ['my-day', 'Good morning, Maya'],
  ['time', 'Time & Schedule'],
  ['leave', 'Leave'],
  ['requests', 'Request Center'],
  ['inbox', 'Inbox'],
  ['pay', 'Pay & Benefits'],
  ['growth', 'Goals & Growth'],
  ['documents', 'Documents'],
  ['help', 'HR Help Center'],
  ['journey', 'My Journey'],
  ['security', 'Account Security'],
  ['profile', 'My Profile'],
] as const

async function open(page: Page, screen: string, path: string, theme: Theme = 'light', viewport = desktop, extra = '') {
  await page.setViewportSize(viewport)
  await page.clock.setFixedTime(fixedTime)
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.goto(`/visual.html?screen=${screen}&theme=${theme}&path=${encodeURIComponent(path)}${extra}`)
  await page.evaluate(() => document.fonts.ready)
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }))
  expect(dimensions.document, `document width ${dimensions.document}px exceeds viewport ${dimensions.viewport}px`).toBeLessThanOrEqual(dimensions.viewport + 1)
}

async function expectRenderedContrast(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).withRules(['color-contrast'])
  const result = await (include ? builder.include(include) : builder).analyze()
  expect(result.violations.flatMap((item) => item.nodes.map((node) => `${node.target.join(' ')}: ${node.failureSummary}`))).toEqual([])
}

async function capture(page: Page, name: string) {
  await expectNoHorizontalOverflow(page)
  await expectRenderedContrast(page)
  await expect(page).toHaveScreenshot(name)
}

for (const theme of ['light', 'dark'] as const) {
  for (const [size, viewport] of [['desktop', desktop], ['mobile', mobile]] as const) {
    for (const [path, heading] of adminPages) {
      test(`admin ${path} ${theme} ${size}`, async ({ page }) => {
        await open(page, 'admin', `/admin/${path}`, theme, viewport)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
        await capture(page, `admin-${path.replace('/', '-')}-${theme}-${size}.png`)
      })
    }
    for (const [path, heading] of employeePages) {
      test(`employee ${path} ${theme} ${size}`, async ({ page }) => {
        await open(page, 'employee', `/employee/${path}`, theme, viewport)
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
        await capture(page, `employee-${path}-${theme}-${size}.png`)
      })
    }
  }
}

const dialogs: Array<{ name: string; screen: 'admin' | 'employee'; path: string; dialog: string; open?: (page: Page) => Promise<unknown> }> = [
  { name: 'employee-leave-request', screen: 'employee', path: '/employee/leave?new=1', dialog: 'Request leave' },
  { name: 'employee-new-request', screen: 'employee', path: '/employee/requests?new=Attendance%20Correction', dialog: 'Create an HR request' },
  { name: 'employee-request-detail', screen: 'employee', path: '/employee/requests?request=REQ-204', dialog: 'Request #REQ-204' },
  { name: 'employee-payslip', screen: 'employee', path: '/employee/pay?payslip=PAY-3-EMP001', dialog: 'Payslip · August 2026' },
  { name: 'employee-document', screen: 'employee', path: '/employee/documents?doc=DOC-101', dialog: 'Information Security Policy' },
  { name: 'employee-change-password', screen: 'employee', path: '/employee/security', dialog: 'Change your password', open: (page) => page.getByRole('button', { name: 'Change password' }).click() },
  { name: 'employee-profile-phone', screen: 'employee', path: '/employee/profile', dialog: 'Confirm profile changes', open: async (page) => {
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Phone number').fill('+63 917 555 0199')
    await page.getByRole('button', { name: 'Save changes' }).click()
  } },
  { name: 'admin-add-employee', screen: 'admin', path: '/admin/people?new=1', dialog: 'Add employee' },
  { name: 'admin-edit-employee', screen: 'admin', path: '/admin/people/EMP001', dialog: 'Edit Maya Santos', open: (page) => page.getByRole('button', { name: 'Edit employee' }).click() },
  { name: 'admin-benefit', screen: 'admin', path: '/admin/people/EMP001?tab=pay', dialog: 'Add benefit record', open: (page) => page.getByRole('button', { name: 'Add benefit' }).click() },
  { name: 'admin-assign-shifts', screen: 'admin', path: '/admin/time', dialog: 'Assign shifts', open: async (page) => {
    await page.getByRole('button', { name: 'Assign shifts' }).click()
    await page.getByText('Repeat this shift').click()
  } },
  { name: 'admin-approve-leave', screen: 'admin', path: '/admin/approvals', dialog: 'Approve leave', open: (page) => page.getByRole('button', { name: 'Approve' }).first().click() },
  { name: 'admin-review-request', screen: 'admin', path: '/admin/approvals?view=requests&request=REQ-205', dialog: 'Review request #REQ-205' },
  { name: 'admin-start-checklist', screen: 'admin', path: '/admin/onboarding', dialog: 'Start lifecycle checklist', open: (page) => page.getByRole('button', { name: 'Start checklist' }).first().click() },
  { name: 'admin-generate-payroll', screen: 'admin', path: '/admin/payroll', dialog: 'Generate payroll draft', open: (page) => page.getByRole('button', { name: 'Generate payroll' }).click() },
  { name: 'admin-payslip-preview', screen: 'admin', path: '/admin/payroll', dialog: 'Payslip preview · August 2026', open: (page) => page.getByRole('button', { name: 'Preview payslip for Ana Cruz' }).click() },
  { name: 'admin-review-draft', screen: 'admin', path: '/admin/performance', dialog: 'Save performance review draft', open: (page) => page.getByRole('button', { name: 'New review' }).first().click() },
  { name: 'admin-assign-goal', screen: 'admin', path: '/admin/performance', dialog: 'Assign employee goal', open: (page) => page.getByRole('button', { name: 'Add goal' }).first().click() },
  { name: 'admin-new-cycle', screen: 'admin', path: '/admin/performance', dialog: 'Create performance cycle', open: (page) => page.getByRole('button', { name: 'New cycle' }).first().click() },
  { name: 'admin-publish-document', screen: 'admin', path: '/admin/documents', dialog: 'Publish HR document', open: (page) => page.getByRole('button', { name: 'Publish document' }).first().click() },
  { name: 'admin-document-acknowledgements', screen: 'admin', path: '/admin/documents?doc=DOC-101', dialog: 'Information Security Policy' },
  { name: 'admin-announcement', screen: 'admin', path: '/admin/announcements', dialog: 'Publish announcement', open: (page) => page.getByRole('button', { name: 'New announcement' }).first().click() },
  { name: 'admin-security-alert', screen: 'admin', path: '/admin/security', dialog: 'Create a reviewable security alert', open: (page) => page.getByRole('button', { name: 'Create alert' }).click() },
  { name: 'admin-invite', screen: 'admin', path: '/admin/admin-accounts', dialog: 'Invite administrator account', open: (page) => page.getByRole('button', { name: 'Invite administrator' }).click() },
  { name: 'employee-cancel-leave', screen: 'employee', path: '/employee/leave', dialog: 'Cancel leave request', open: (page) => page.getByRole('button', { name: /^Cancel vacation leave from/ }).first().click() },
  { name: 'employee-document-file', screen: 'employee', path: '/employee/documents?doc=DOC-104', dialog: 'Employment Contract' },
  { name: 'admin-reject-leave', screen: 'admin', path: '/admin/approvals', dialog: 'Reject leave', open: (page) => page.getByRole('button', { name: 'Reject' }).first().click() },
  { name: 'admin-leave-allowances', screen: 'admin', path: '/admin/approvals', dialog: 'Leave allowances', open: (page) => page.getByRole('button', { name: 'Leave allowances' }).click() },
  { name: 'admin-edit-announcement', screen: 'admin', path: '/admin/announcements', dialog: 'Edit announcement', open: (page) => page.getByRole('button', { name: 'Edit Quarterly town hall' }).click() },
  { name: 'admin-delete-announcement', screen: 'admin', path: '/admin/announcements', dialog: 'Delete announcement', open: (page) => page.getByRole('button', { name: 'Delete Quarterly town hall' }).click() },
  { name: 'admin-manage-account', screen: 'admin', path: '/admin/admin-accounts', dialog: 'Manage Sierra Navarro', open: (page) => page.getByRole('button', { name: 'Manage access for Sierra Navarro' }).click() },
]

for (const item of dialogs) {
  for (const [theme, size, viewport] of [['light', 'desktop', desktop], ['dark', 'mobile', mobile]] as const) {
    test(`dialog ${item.name} ${theme} ${size}`, async ({ page }) => {
      await open(page, item.screen, item.path, theme, viewport)
      await item.open?.(page)
      const dialog = page.getByRole('dialog', { name: item.dialog })
      await expect(dialog).toBeVisible()
      await page.waitForTimeout(150)
      await expectNoHorizontalOverflow(page)
      await expectRenderedContrast(page, '[role="dialog"]')
      await expect(page).toHaveScreenshot(`dialog-${item.name}-${theme}-${size}.png`)
    })
  }
}

test.describe('portal shell', () => {
  test('administrator search finds people, requests, and pages', async ({ page }) => {
    await open(page, 'admin', '/admin/dashboard')
    const search = page.getByRole('combobox', { name: /^Search people/ })
    await search.fill('ma')
    const results = page.getByRole('listbox', { name: 'Search results' })
    await expect(results.getByRole('group', { name: 'People' })).toContainText('Maya Santos')
    await expect(results.getByRole('group', { name: 'HR requests' })).toBeVisible()
    await expectRenderedContrast(page, '#portal-search-results')
    await expect(page).toHaveScreenshot('shell-admin-search.png')
    await search.press('ArrowDown')
    await search.press('ArrowDown')
    await search.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Maya Santos' })).toBeVisible()
  })

  for (const portal of ['admin', 'employee'] as const) {
    test(`${portal} notifications panel`, async ({ page }) => {
      await open(page, portal, portal === 'admin' ? '/admin/dashboard' : '/employee/my-day')
      await page.getByRole('button', { name: /^Notifications/ }).click()
      const panel = page.getByLabel(portal === 'admin' ? 'Items that need attention' : 'Notifications', { exact: true })
      await expect(panel).toBeVisible()
      await expectRenderedContrast(page, '.shell-popover')
      await expect(page).toHaveScreenshot(`shell-${portal}-notifications.png`)
    })

    test(`${portal} collapsed sidebar is remembered`, async ({ page }) => {
      await open(page, portal, `/${portal}`)
      await page.getByRole('button', { name: 'Collapse sidebar' }).click()
      await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
      await expect(page).toHaveScreenshot(`shell-${portal}-collapsed.png`)
      await page.reload()
      await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
      await expect(page.locator('.shell-sidebar')).toHaveCSS('width', '68px')
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`${portal} sign-out confirmation ${theme}`, async ({ page }) => {
        await open(page, portal, `/${portal}`, theme)
        await page.getByRole('button', { name: 'Sign out', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: 'Confirm sign out' })
        await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
        await expectRenderedContrast(page, '[role="dialog"]')
        await expect(page).toHaveScreenshot(`shell-${portal}-signout-${theme}.png`)
        await dialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(dialog).toHaveCount(0)
      })
    }

    test(`${portal} mobile More sheet`, async ({ page }) => {
      await open(page, portal, `/${portal}`, 'light', mobile)
      await page.getByRole('button', { name: 'Open more navigation' }).click()
      await expect(page.getByRole('dialog', { name: 'All pages' })).toBeVisible()
      await expectRenderedContrast(page, '#mobile-more-navigation')
      await expect(page).toHaveScreenshot(`shell-${portal}-more-sheet.png`)
    })
  }

  test('employee calendar and leave planning views', async ({ page }) => {
    await open(page, 'employee', '/employee/time?view=calendar')
    await expect(page.getByRole('table', { name: /Your schedule, leave, and holidays/ })).toBeVisible()
    await capture(page, 'employee-time-calendar.png')
    await open(page, 'employee', '/employee/leave')
    await page.getByRole('tab', { name: 'Calendar' }).click()
    await capture(page, 'employee-leave-calendar.png')
  })

  test('administrator roster, org chart, and history views', async ({ page }) => {
    await open(page, 'admin', '/admin/time')
    await page.getByRole('tab', { name: 'Weekly roster' }).click()
    await capture(page, 'admin-time-roster.png')
    await open(page, 'admin', '/admin/people?view=org')
    await capture(page, 'admin-people-org-chart.png')
    await open(page, 'admin', '/admin/approvals?view=history')
    await capture(page, 'admin-approvals-history.png')
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`sign-in pages ${theme}`, async ({ page }) => {
      for (const portal of ['admin', 'employee'] as const) {
        await open(page, `${portal}-login`, '/', theme)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await capture(page, `${portal}-login-${theme}-desktop.png`)
      }
    })
  }

  test('first sign-in password setup stays light and readable', async ({ page }) => {
    await open(page, 'employee', '/employee', 'light', desktop, '&firstLogin=1')
    await expect(page.getByRole('dialog', { name: 'Secure your employee account' })).toBeVisible()
    await expectRenderedContrast(page, '[role="dialog"]')
    await expect(page).toHaveScreenshot('employee-first-login-light.png')
  })

  test('administrator invitation setup is readable on desktop and mobile', async ({ page }) => {
    for (const [size, viewport] of [['desktop', desktop], ['mobile', mobile]] as const) {
      await open(page, 'admin-invite', '/', 'light', viewport)
      await expect(page.getByRole('heading', { name: 'Create your private password' })).toBeVisible()
      await capture(page, `admin-invite-setup-${size}.png`)
    }
  })
})
