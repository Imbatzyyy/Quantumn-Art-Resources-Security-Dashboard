import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import signinEmail from '../../netlify/functions/signin-email.mjs'
import { EMAIL_LOGO_URL } from '../../netlify/functions/_shared/email-templates.mjs'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }))
const emailFetch = vi.fn()
const context = { sessionId: 'session-1', userId: 'user-1', email: 'verified@example.test', firstName: '<Test>', portal: 'employee', passwordAuthenticated: true, setupRequired: false, verified: false, challengeId: null }
const request = (body: unknown, auth = true) => new Request('https://quantumnhr.com/api/signin-email', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer local-test-token' } : {}) }, body: JSON.stringify(body),
})

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-test-service-key')
  vi.stubEnv('SUPABASE_SECRET_KEY', '')
  vi.stubEnv('RESEND_API_KEY', 'local-test-provider-key')
  vi.stubEnv('RESEND_FROM_EMAIL', 'QA <hello@example.test>')
  vi.stubGlobal('fetch', emailFetch)
  emailFetch.mockReset().mockResolvedValue(new Response('{"id":"accepted"}', { status: 200 }))
  rpc.mockReset().mockImplementation(async (name, input) => ({ data: name === 'signin_email_context' ? context : input.operation === 'reserve' ? { send: true, expiresAt: '2026-09-28T12:10:00Z', resendAt: '2026-09-28T12:01:00Z' } : input.operation === 'sent' ? { sent: true } : input.operation === 'verify' ? { verified: true } : {}, error: null }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('session-bound sign-in email', () => {
  it.each([null, [], 'bad', { action: 'other', portal: 'employee' }])('rejects malformed input', async input => {
    expect((await signinEmail(request(input))).status).toBe(400)
    expect(emailFetch).not.toHaveBeenCalled()
  })
  it('requires a password-authenticated session', async () => {
    expect((await signinEmail(request({ action: 'send', portal: 'employee' }, false))).status).toBe(401)
    rpc.mockResolvedValue({ data: { ...context, passwordAuthenticated: false }, error: null })
    expect((await signinEmail(request({ action: 'send', portal: 'employee' }))).status).toBe(401)
    expect(emailFetch).not.toHaveBeenCalled()
  })
  it.each([{ portal: 'admin' }, { setupRequired: true }])('rejects wrong portal or incomplete account setup', async change => {
    rpc.mockResolvedValue({ data: { ...context, ...change }, error: null })
    expect((await signinEmail(request({ action: 'send', portal: 'employee' }))).status).toBe(change.portal ? 401 : 409)
    expect(emailFetch).not.toHaveBeenCalled()
  })
  it('sends the branded code only to the server-derived address, and stores only its HMAC', async () => {
    const response = await signinEmail(request({ action: 'send', portal: 'employee', email: 'attacker@example.test', userId: 'attacker' }))
    expect(response.status).toBe(200)
    const result = await response.json()
    const [url, options] = emailFetch.mock.calls[0]
    const email = JSON.parse(options.body)
    const code = email.text.match(/Verification code: (\d{6})/)[1]
    expect(url).toBe('https://api.resend.com/emails')
    expect(email.to).toEqual([context.email])
    expect(email.html).toContain(EMAIL_LOGO_URL)
    expect(email.html).toContain('&lt;Test&gt;')
    expect(email.html).toContain(code)
    expect(result.maskedEmail).toBe('v•••@example.test')
    expect(JSON.stringify(result)).not.toContain(code)
    expect(options.headers['Idempotency-Key']).toBe(`signin-${result.challengeId}`)
    const reservation = rpc.mock.calls.find(([, args]) => args?.operation === 'reserve')![1]
    expect(reservation.uid).toBe(context.userId)
    expect(reservation.sid).toBe(context.sessionId)
    expect(reservation.code_hash).toBe(createHmac('sha256', 'local-test-service-key').update(`${context.sessionId}:${result.challengeId}:${code}`).digest('hex'))
  })
  it('reuses an active challenge without sending another email', async () => {
    rpc.mockImplementation(async name => ({ data: name === 'signin_email_context' ? context : { sent: true, challengeId: 'existing' }, error: null }))
    expect((await signinEmail(request({ action: 'send', portal: 'employee' }))).status).toBe(200)
    expect(emailFetch).not.toHaveBeenCalled()
  })
  it.each(['rejected', 'network failure', 'missing receipt'])('fails closed on provider %s', async mode => {
    if (mode === 'rejected') emailFetch.mockResolvedValue(new Response('{}', { status: 422 }))
    else if (mode === 'missing receipt') emailFetch.mockResolvedValue(new Response('{}', { status: 200 }))
    else emailFetch.mockRejectedValue(new Error('No network'))
    const response = await signinEmail(request({ action: 'send', portal: 'employee' }))
    expect(response.status).toBe(502)
    expect(rpc.mock.calls.some(([, args]) => args?.operation === 'failed')).toBe(true)
    expect(rpc.mock.calls.some(([, args]) => args?.operation === 'sent')).toBe(false)
  })
  it('honors server-side attempt limits with a retry time', async () => {
    rpc.mockImplementation(async name => ({ data: name === 'signin_email_context' ? context : { error: 'rate_limit', retryAt: '2026-09-28T13:00:00Z' }, error: null }))
    const response = await signinEmail(request({ action: 'verify', portal: 'employee', code: '012345', challengeId: '30000000-0000-4000-8000-000000000001' }))
    expect(response.status).toBe(429)
    expect((await response.json()).retryAt).toBe('2026-09-28T13:00:00Z')
    expect(emailFetch).not.toHaveBeenCalled()
  })
  it('does not send when already verified or delivery is not configured', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    expect((await signinEmail(request({ action: 'send', portal: 'employee' }))).status).toBe(503)
    rpc.mockResolvedValue({ data: { ...context, verified: true }, error: null })
    expect((await signinEmail(request({ action: 'send', portal: 'employee' }))).status).toBe(200)
    expect(emailFetch).not.toHaveBeenCalled()
  })
})
