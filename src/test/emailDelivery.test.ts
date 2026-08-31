import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import createEmployee from '../../netlify/functions/admin-create-employee.mjs'
import inviteAdmin from '../../netlify/functions/admin-invite-account.mjs'
import { EMAIL_LOGO_URL } from '../../netlify/functions/_shared/email-templates.mjs'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const employeeBody = { firstName: 'Avery', lastName: 'Test', preferredName: 'Avery', email: 'avery@example.test', phone: '+63 917 555 0188', department: 'Technology', position: 'QA Analyst', employmentType: 'Full-time', workArrangement: 'Hybrid', workLocation: 'Test Lab', salary: 48000, hireDate: '2026-08-30', temporaryPassword: 'Fictional-only-Password42!' }
const adminBody = { firstName: 'Sierra', lastName: 'Test', email: 'sierra@example.test', role: 'security_admin' }
const actionLink = 'https://project.supabase.co/auth/v1/verify?token=fictional&type=invite&redirect_to=https%3A%2F%2Fquantumnhr.com%2Fadmin%2Fsetup-password'
const request = (path: string, body: unknown, authenticated = true) => new Request(`https://quantumnhr.com${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: 'Bearer fictional-test-token' } : {}) }, body: JSON.stringify(body) })

function query(data: unknown) {
  const promise = Promise.resolve({ data, error: null })
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), ilike: vi.fn().mockReturnThis(), insert: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data, error: null }), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }), then: promise.then.bind(promise) }
}

let profileQueries: ReturnType<typeof query>[]
const deleteUser = vi.fn()
const fetchEmail = vi.fn()

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fictional-service-key')
  vi.stubEnv('SUPABASE_SECRET_KEY', '')
  vi.stubEnv('RESEND_API_KEY', 'fictional-provider-key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'Quantumn Art Resources <test@example.test>')
  vi.stubEnv('APP_URL', 'https://quantumnhr.com')
  vi.stubGlobal('fetch', fetchEmail)
  fetchEmail.mockReset().mockResolvedValue(new Response('{"id":"fictional-email"}', { status: 200 }))
  deleteUser.mockReset().mockResolvedValue({ error: null })
  profileQueries = []
  createClient.mockReturnValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'caller' } } }), admin: {
      createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user' } } }),
      generateLink: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user' }, properties: { action_link: actionLink } } }),
      updateUserById: vi.fn().mockResolvedValue({ error: null }), deleteUser,
    } },
    from: vi.fn((table: string) => {
      if (table !== 'profiles') return query({})
      const index = profileQueries.length
      const result = query(index === 0 ? { employee_code: 'ADM-TEST', first_name: 'Admin', last_name: 'Test', role: 'admin', status: 'Active' } : index === 1 ? null : { employee_code: 'EMP-TEST' })
      profileQueries.push(result)
      return result
    }),
  })
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe.each([
  { label: 'Employee credentials', handler: createEmployee, path: '/api/admin-create-employee', body: employeeBody },
  { label: 'Administrator invitation', handler: inviteAdmin, path: '/api/admin-invite-account', body: adminBody },
])('$label email delivery', ({ handler, path, body }) => {
  it('sends branded HTML and a plain-text alternative to the intended recipient only', async () => {
    const response = await handler(request(path, body))
    expect(response.status).toBe(201)
    expect(fetchEmail).toHaveBeenCalledTimes(1)
    const [url, options] = fetchEmail.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const message = JSON.parse(options.body)
    expect(message.to).toEqual([body.email])
    expect(message.html).toContain(EMAIL_LOGO_URL)
    expect(message.html).toContain('Quantumn Art Resources')
    expect(message.text).toContain('Quantumn Art Resources')
    expect(message.html).not.toContain('fictional-service-key')
    expect(message.html).not.toContain('fictional-provider-key')
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it.each(['rejected', 'network error'])('rolls back a new account on a provider %s', async mode => {
    if (mode === 'rejected') fetchEmail.mockResolvedValue(new Response('{}', { status: 422 }))
    else fetchEmail.mockRejectedValue(new Error('Simulated network failure'))
    const response = await handler(request(path, body))
    expect(response.status).toBe(502)
    expect(deleteUser).toHaveBeenCalledWith('new-user')
    expect(profileQueries.some(q => q.delete.mock.calls.length > 0)).toBe(true)
    expect(await response.text()).not.toContain('fictional-provider-key')
  })

  it('does not send anything without administrator authentication', async () => {
    const response = await handler(request(path, body, false))
    expect(response.status).toBe(401)
    expect(fetchEmail).not.toHaveBeenCalled()
  })
})
