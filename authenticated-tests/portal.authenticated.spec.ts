import { expect, test, type Page } from '@playwright/test'
import { authenticatedAccounts } from '../playwright.authenticated.config.js'

interface BrowserEvidence {
  consoleErrors: string[]
  serverErrors: string[]
}

const observeBrowserEvidence = (page: Page): BrowserEvidence => {
  const evidence: BrowserEvidence = { consoleErrors: [], serverErrors: [] }
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 500) evidence.serverErrors.push(`${response.status()} ${response.url()}`)
  })
  return evidence
}

const signIn = async (page: Page, portal: 'admin' | 'employee') => {
  const account = authenticatedAccounts[portal]
  await page.goto(`/${portal}/login`)
  await page.getByLabel('Work email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: portal === 'admin' ? 'Sign in to Admin Console' : 'Sign in to Employee Portal' }).click()

  const mfaField = page.getByLabel('Authenticator code')
  if (await mfaField.isVisible().catch(() => false)) {
    throw new Error(`The fictional ${portal} account requires MFA. Use an isolated QA identity whose approved test factor can be supplied by the account owner.`)
  }
  await expect(page).toHaveURL(new RegExp(`/${portal}/?$`), { timeout: 20_000 })
}

const expectCleanEvidence = (evidence: BrowserEvidence) => {
  expect(evidence.serverErrors, `Unexpected server failures:\n${evidence.serverErrors.join('\n')}`).toEqual([])
  expect(evidence.consoleErrors, `Unexpected browser errors:\n${evidence.consoleErrors.join('\n')}`).toEqual([])
}

test('fictional administrator can access Admin operations but not the Employee workspace', async ({ page }) => {
  const evidence = observeBrowserEvidence(page)
  await signIn(page, 'admin')

  await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()
  const navigation = page.getByRole('navigation', { name: 'Portal navigation' })
  await expect(navigation.getByRole('button', { name: 'People Directory', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: /Security Center/ })).toBeVisible()

  await page.getByRole('button', { name: 'People Directory', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'People Directory' })).toBeVisible()
  const directoryRoles = page.locator('.people-directory-panel tbody tr td:nth-child(5) .badge')
  await expect(directoryRoles.first()).toBeVisible()
  expect(await directoryRoles.allTextContents()).not.toHaveLength(0)
  for (const role of await directoryRoles.allTextContents()) expect(role).toBe('employee')

  // This fixture is seeded by the local runner; remote QA environments need not have it.
  if (['localhost', '127.0.0.1'].includes(new URL(page.url()).hostname)) {
    const row = page.getByRole('row').filter({ hasText: authenticatedAccounts.employee.email })
    const photo = row.getByRole('img', { name: /profile photo/ })
    await expect(photo).toBeVisible()
    await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    const source = await photo.getAttribute('src')
    expect(source).toContain('/storage/v1/object/sign/profile-avatars/')
    await row.getByRole('button', { name: 'Open profile' }).click()
    const profile = page.getByRole('dialog', { name: 'Employee 360°' })
    const profilePhoto = profile.getByRole('img', { name: /profile photo/ })
    await expect(profilePhoto).toHaveAttribute('src', source!)
    await expect.poll(() => profilePhoto.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    await profile.getByRole('button', { name: 'Done', exact: true }).click()
  }

  await page.goto('/employee')
  await expect(page).toHaveURL(/\/employee\/login$/)
  await expect(page.getByRole('heading', { name: 'Welcome to your workspace' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Portal navigation' })).not.toBeVisible()

  await page.goto('/admin')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  expectCleanEvidence(evidence)
})

test('fictional employee can access only their synchronized self-service workspace', async ({ page }) => {
  const evidence = observeBrowserEvidence(page)
  await signIn(page, 'employee')

  await expect(page.getByRole('heading', { name: /Good day,/ })).toBeVisible()
  const navigation = page.getByRole('navigation', { name: 'Portal navigation' })
  await expect(navigation.getByRole('button', { name: 'Request Center', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Admin Accounts & Roles' })).not.toBeVisible()

  await page.getByRole('button', { name: 'My Profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible()
  await expect(page.getByLabel('Work email')).toHaveValue(authenticatedAccounts.employee.email)

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Administrator sign in' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Portal navigation' })).not.toBeVisible()

  await page.goto('/employee')
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/employee\/login$/)
  expectCleanEvidence(evidence)
})
