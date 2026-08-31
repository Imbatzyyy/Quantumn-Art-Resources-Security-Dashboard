import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { authEmailTemplates, credentialsEmail, EMAIL_LOGO_URL, invitationEmail, supabaseTemplatePatch } from '../../netlify/functions/_shared/email-templates.mjs'

const employee = { firstName: 'Avery', preferredName: 'Avery <QA> & Team', email: 'avery@example.test', password: 'Fictional<&>"Passphrase42!' }
const inviteUrl = 'https://project.supabase.co/auth/v1/verify?token=fictional&type=invite&redirect_to=https%3A%2F%2Fquantumnhr.com%2Fadmin%2Fsetup-password'
const appEmails = [
  { id: 'employee', ...credentialsEmail({ employee, employeeCode: 'EMP-TEST', loginUrl: 'https://quantumnhr.com/employee/login' }) },
  { id: 'administrator', ...invitationEmail({ firstName: 'Sierra', roleLabel: 'Security Administrator', setupLink: inviteUrl, appUrl: 'https://quantumnhr.com' }) },
]
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html')

describe('branded email templates', () => {
  it.each([...appEmails, ...authEmailTemplates])('$id has the original logo, a distinct title, accessible layout, and no unsafe HTML', ({ html }) => {
    const doc = parse(html)
    expect(doc.querySelector('html')).toHaveAttribute('lang', 'en')
    expect(doc.querySelectorAll('h1')).toHaveLength(1)
    expect(doc.querySelector('img')).toHaveAttribute('src', EMAIL_LOGO_URL)
    expect(doc.querySelector('img')).toHaveAttribute('alt', 'Quantumn Art Resources — original blue logo')
    expect(doc.querySelector('img')).toHaveAttribute('width', '220')
    expect(doc.querySelectorAll('script, iframe, form, input, [onclick], [onerror]')).toHaveLength(0)
    expect(html).not.toMatch(/src=["'](?:data:|blob:|\/assets\/|http:)/)
    expect(html).not.toMatch(/undefined|null/)
    expect(new TextEncoder().encode(html).length).toBeLessThan(50_000)
    expect([...doc.querySelectorAll('table')].every(table => table.getAttribute('role') === 'presentation')).toBe(true)
  })

  it('escapes employee details without altering temporary credentials in the text alternative', () => {
    const email = appEmails[0]
    expect(email.text).toContain(`Temporary password: ${employee.password}`)
    const doc = parse(email.html)
    expect(doc.body.textContent).toContain(employee.preferredName)
    expect(doc.body.textContent).toContain(employee.password)
    expect(doc.querySelector('qa')).toBeNull()
    expect(doc.body.textContent).toContain('15 characters')
    expect([...doc.querySelectorAll('a')].filter(a => a.href === 'https://quantumnhr.com/employee/login')).toHaveLength(2)
  })

  it('keeps the Supabase-generated administrator URL identical in the CTA and copyable fallback', () => {
    const email = appEmails[1]
    expect(email.text).toContain(inviteUrl)
    expect([...parse(email.html).querySelectorAll('a')].filter(a => a.href === inviteUrl)).toHaveLength(2)
    expect(email.html).not.toContain(employee.password)
  })

  it.each(['javascript:alert(1)', 'https://name:password@example.test', 'http://example.test'])('rejects unsafe action URLs: %s', loginUrl => {
    expect(() => credentialsEmail({ employee, employeeCode: 'TEST', loginUrl })).toThrow()
  })

  it.each(authEmailTemplates)('$id is generated without drift and has only supported provider placeholders', template => {
    expect(readFileSync(`supabase/templates/${template.id}.html`, 'utf8')).toContain(template.html)
    const allowed = new Set(['Email', 'ConfirmationURL', 'Token', 'NewEmail', 'OldEmail', 'Phone', 'OldPhone', 'Provider', 'FactorType'])
    for (const token of template.html.matchAll(/{{\s*\.(\w+)\s*}}/g)) expect(allowed.has(token[1])).toBe(true)
    if (!template.notification && template.id !== 'reauthentication') {
      expect(template.html.match(/href="{{ .ConfirmationURL }}"/g)).toHaveLength(2)
    }
    if (template.id === 'reauthentication') {
      expect(template.html).toContain('{{ .Token }}')
      expect(template.html).not.toContain('{{ .ConfirmationURL }}')
    }
    if (template.notification) expect(template.html).not.toContain('{{ .ConfirmationURL }}')
  })

  it('defines all 13 Supabase templates without enabling new notifications or changing authentication settings', () => {
    const patch = supabaseTemplatePatch()
    expect(authEmailTemplates).toHaveLength(13)
    expect(Object.keys(patch)).toHaveLength(26)
    expect(Object.keys(patch).every(key => /^mailer_(subjects_|templates_)/.test(key))).toBe(true)
    const config = readFileSync('supabase/config.toml', 'utf8')
    for (const template of authEmailTemplates) expect(config).toContain(`content_path = "./supabase/templates/${template.id}.html"`)
    expect(new Set(authEmailTemplates.map(t => t.subject)).size).toBe(13)
  })
})
