import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { authEmailTemplates, credentialsEmail, EMAIL_LOGO_URL, invitationEmail } from '../netlify/functions/_shared/email-templates.mjs'

// Fictional values only. No provider API, authentication, or outgoing email.
const values: Record<string, string> = {
  Email: 'avery@example.test', NewEmail: 'avery.new@example.test', OldEmail: 'avery.old@example.test',
  Phone: '+63 917 555 0102', OldPhone: '+63 917 555 0101', Provider: 'Google', FactorType: 'totp', Token: '123456',
  ConfirmationURL: 'https://project.supabase.co/auth/v1/verify?token=fictional&type=recovery&redirect_to=https%3A%2F%2Fquantumnhr.com%2Femployee%2Freset-password',
}
const templates = [
  { id: 'employee', ...credentialsEmail({ employee: { firstName: 'Avery', preferredName: 'Avery', email: values.Email, password: 'Fictional-Test-Password42!' }, employeeCode: 'EMP-TEST', loginUrl: 'https://quantumnhr.com/employee/login' }) },
  { id: 'administrator', ...invitationEmail({ firstName: 'Sierra', roleLabel: 'Security Administrator', setupLink: values.ConfirmationURL.replace('type=recovery', 'type=invite').replace('employee%2Freset-password', 'admin%2Fsetup-password'), appUrl: 'https://quantumnhr.com' }) },
  ...authEmailTemplates.map(t => ({ ...t, html: t.html.replace(/{{\s*\.(\w+)\s*}}/g, (_, key: string) => values[key].replaceAll('&', '&amp;')) })),
]

for (const width of [320, 800]) {
  for (const template of templates) {
    test(`${template.id} email readable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.route('**/*', route => {
        if (route.request().url() === EMAIL_LOGO_URL) return route.fulfill({ contentType: 'image/png', body: readFileSync('assets/images/mainlogo_blue.png') })
        return route.abort()
      })
      await page.setContent(template.html)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByRole('img')).toBeVisible()
      expect(await page.getByRole('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 1000)).toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      expect(await page.locator('body').textContent()).not.toContain('{{')
      const audit = await new AxeBuilder({ page }).withRules(['color-contrast', 'image-alt', 'link-name', 'document-title', 'html-has-lang']).analyze()
      expect(audit.violations).toEqual([])
      if (['employee', 'administrator', 'recovery'].includes(template.id)) {
        await expect(page).toHaveScreenshot(`email-${template.id}-${width}.png`, { fullPage: true })
      }
    })
  }
}

test('the stable public email image serves the original blue logo bytes', async ({ request }) => {
  const response = await request.get('/email-assets/quantumn-art-resources-blue.png')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('image/png')
  expect(await response.body()).toEqual(readFileSync('assets/images/mainlogo_blue.png'))
})
