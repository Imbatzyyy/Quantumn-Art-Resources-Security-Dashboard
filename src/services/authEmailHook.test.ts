import { describe, expect, it, vi, afterEach } from 'vitest'
import { Webhook } from 'standardwebhooks'
import { Buffer } from 'node:buffer'
import hook, { authHookMessages } from '../../netlify/functions/auth-email-hook.mjs'
const opts = { supabaseUrl: 'https://project.supabase.co', appUrl: 'https://quantumnhr.com', role: 'employee' }
const user = { id: 'test-user', email: 'old@example.test', new_email: 'new@example.test', phone: '+639123456789' }
const mail = (type: string) => ({ user, email_data: { email_action_type: type, token: '123456', token_hash: 'oldhash', redirect_to: 'https://evil.example.test' } })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('provider-auth email delivery', () => {
  it('accepts a valid signed provider event, sends the branded message and fails visibly on delivery failure', async () => {
    const secret = 'whsec_' + Buffer.from('local-test-webhook-secret-32bytes').toString('base64')
    vi.stubEnv('AUTH_EMAIL_HOOK_SECRET', secret)
    vi.stubEnv('SUPABASE_URL', opts.supabaseUrl)
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-service-test-only')
    vi.stubEnv('RESEND_API_KEY', 'local-resend-test-only')
    vi.stubEnv('RESEND_FROM_EMAIL', 'Quantum HRMS <local@example.test>')
    const deliveries: { body: string; key: string | null }[] = []
    let failure = false
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith(opts.supabaseUrl)) return Response.json({ role: 'employee' })
      deliveries.push({ body: String(init?.body), key: new Headers(init?.headers).get('idempotency-key') })
      return Response.json(failure ? { error: 'Unavailable' } : { id: 'accepted-local-delivery' }, { status: failure ? 503 : 200 })
    }))
    const id = 'signed-delivery', time = new Date(), body = JSON.stringify(mail('recovery'))
    const signed = () => new Request('https://quantumnhr.com/api/auth-email-hook', { method: 'POST', body, headers: { 'webhook-id': id, 'webhook-timestamp': String(Math.floor(time.getTime()/1000)), 'webhook-signature': new Webhook(secret).sign(id, time, body) } })
    expect((await hook(signed())).status).toBe(200)
    expect(deliveries[0].body).toContain('quantumn-art-resources-blue.png')
    failure = true
    expect((await hook(signed())).status).toBe(503)
    expect(deliveries[1].key).toBe(deliveries[0].key)
  })
  for (const type of ['signup','invite','recovery','magiclink','email_change','reauthentication','password_changed_notification','email_changed_notification','phone_changed_notification','identity_linked_notification','identity_unlinked_notification','mfa_factor_enrolled_notification','mfa_factor_unenrolled_notification']) {
    it(`renders ${type} with the blue brand logo and no unresolved variables`, () => {
      const messages = authHookMessages(mail(type), opts)
      expect(messages.length).toBeGreaterThan(0)
      for (const message of messages) { expect(message.html).toContain('quantumn-art-resources-blue.png'); expect(message.html).not.toContain('{{'); expect(message.html).not.toContain('evil.example.test') }
    })
  }
  it('suppresses direct public administrator recovery without blocking employee recovery', () => {
    expect(authHookMessages(mail('recovery'), { ...opts, role: 'admin' })).toEqual([])
    expect(authHookMessages(mail('recovery'), { ...opts, role: undefined })).toEqual([])
    expect(authHookMessages(mail('recovery'), opts)).toHaveLength(1)
  })
  it('uses the correct token/hash pair for both secure email-change recipients', () => {
    const payload = mail('email_change')
    const result = authHookMessages({ ...payload, email_data: { ...payload.email_data, token: '111111', token_new: '222222', token_hash: 'newhash', token_hash_new: 'oldhash' } }, opts)
    expect(result[0].to).toBe(user.email); expect(result[0].html).toContain('token=oldhash')
    expect(result[1].to).toBe(user.new_email); expect(result[1].html).toContain('token=newhash')
  })
  it('escapes user-provided values and rejects unknown template types', () => {
    const payload = mail('password_changed_notification'); payload.user = { ...user, email: '<script>@example.test' }
    expect(authHookMessages(payload, opts)[0].html).not.toContain('<script>')
    expect(() => authHookMessages(mail('unknown'), opts)).toThrow()
  })
  it('rejects unsigned and expired requests before accessing account data', async () => {
    const secret = 'whsec_' + Buffer.from('local-test-webhook-secret-32bytes').toString('base64')
    vi.stubEnv('AUTH_EMAIL_HOOK_SECRET', secret)
    expect((await hook(new Request('https://quantumnhr.com/api/auth-email-hook', { method: 'POST', body: '{}' }))).status).toBe(401)
    const time = new Date(Date.now() - 600_000), id = 'old-delivery', body = JSON.stringify(mail('recovery'))
    const signature = new Webhook(secret).sign(id, time, body)
    expect((await hook(new Request('https://quantumnhr.com/api/auth-email-hook', { method: 'POST', headers: { 'webhook-id': id, 'webhook-timestamp': String(Math.floor(time.getTime()/1000)), 'webhook-signature': signature }, body }))).status).toBe(401)
  })
})
