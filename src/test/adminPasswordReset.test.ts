import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../netlify/functions/admin-reset-password.mjs'
import { EMAIL_LOGO_URL } from '../../netlify/functions/_shared/email-templates.mjs'
import { validSetupAcknowledgment, TERMS_VERSION, PRIVACY_VERSION } from '../utils/accountPolicies.js'

const { createClient, assertCallerAccess, assertSetupAccess } = vi.hoisted(() => ({ createClient: vi.fn(), assertCallerAccess: vi.fn(), assertSetupAccess: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))
vi.mock('../../netlify/functions/_shared/hrms-access.mjs', () => ({ assertCallerAccess, assertSetupAccess }))
const rpc = vi.fn(), send = vi.fn(), update = vi.fn(), generateLink = vi.fn()
const request = (body: unknown, token = 'verified-token') => new Request('https://quantumnhr.com/api/admin-reset-password', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
const id = '30000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key')
  vi.stubEnv('RESEND_API_KEY', 'test-only-mail'); vi.stubEnv('RESEND_FROM_EMAIL', 'HR <hr@example.test>'); vi.stubEnv('APP_URL', 'https://quantumnhr.com')
  assertCallerAccess.mockReset().mockResolvedValue({}); assertSetupAccess.mockReset().mockResolvedValue({})
  rpc.mockReset().mockImplementation(async (_name, input) => ({ data: input.operation === 'reserve' ? { id, userId: 'recipient', email: 'target@example.test', firstName: '<Recipient>', expiresAt: '2026-09-30T10:30:00Z' } : { ok: true, id, userId: 'recipient', email: 'target@example.test' } }))
  send.mockReset().mockResolvedValue(new Response('{"id":"accepted"}', { status: 200 })); vi.stubGlobal('fetch', send)
  update.mockReset(); generateLink.mockReset()
  createClient.mockReturnValue({ rpc, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'issuer', app_metadata: {} } } }), admin: { updateUserById: update, generateLink } }, from: vi.fn() })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('administrator-controlled password reset', () => {
  it('requires a verified System Administrator session before reserving or emailing', async () => {
    expect((await handler(request({ action: 'send' }, ''))).status).toBe(401)
    assertCallerAccess.mockRejectedValue(new Error('not verified'))
    expect((await handler(request({ action: 'send', employeeCode: 'ADM-1', confirmed: true }))).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled()
  })
  it.each([['forbidden', 403], ['ineligible', 409], ['rate_limit', 429]])('rejects %s without email', async (error, status) => {
    rpc.mockResolvedValue({ data: { error } })
    expect((await handler(request({ action: 'send', employeeCode: 'ADM-1', confirmed: true }))).status).toBe(status)
    expect(send).not.toHaveBeenCalled()
  })
  it('sends only to the database recipient using a branded 30-minute one-use capability', async () => {
    const response = await handler(request({ action: 'send', employeeCode: 'ADM-1', confirmed: true, email: 'attacker@example.test' }))
    expect(response.status).toBe(201)
    const payload = JSON.parse(send.mock.calls[0][1].body)
    expect(payload.to).toEqual(['target@example.test'])
    expect(payload.html).toContain(EMAIL_LOGO_URL)
    expect(payload.html).toContain('&lt;Recipient&gt;')
    expect(payload.html).toContain('30 minutes')
    expect(payload.text).toMatch(/https:\/\/quantumnhr.com\/admin\/reset-password#reset_token=[A-Za-z0-9_-]{43}/)
    const body = await response.text()
    expect(body).not.toContain('reset_token'); expect(body).not.toContain('test-only-key')
    expect(generateLink).not.toHaveBeenCalled() // No reusable Supabase OTP is exposed in the email.
    expect(update).not.toHaveBeenCalled() // Sending cannot change password or role.
    expect(rpc.mock.calls.at(-1)?.[1]).toMatchObject({ operation: 'sent', token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) })
  })
  it('fails closed when delivery fails without deleting or modifying the existing account', async () => {
    send.mockRejectedValue(new Error('mail unavailable'))
    expect((await handler(request({ action: 'send', employeeCode: 'ADM-1', confirmed: true }))).status).toBe(502)
    expect(rpc.mock.calls.at(-1)?.[1]).toMatchObject({ operation: 'failed' })
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['expired', 'invalid'])('never mints an Auth token for an %s reset', async error => {
    rpc.mockResolvedValue({ data: { error } })
    expect((await handler(request({ action: 'exchange', resetToken: 'a'.repeat(43) }, ''))).status).toBe(400)
    expect(generateLink).not.toHaveBeenCalled()
  })
  it('cannot use reset completion to skip enrolled MFA', async () => {
    assertSetupAccess.mockRejectedValue(new Error('MFA required'))
    expect((await handler(request({ action: 'complete', requestId: id, newPassword: 'A long private reset passphrase!' }))).status).toBe(403)
    expect(update).not.toHaveBeenCalled()
  })
  it.each([null, [], 'string'])('rejects malformed input %j', async body => {
    expect((await handler(request(body))).status).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('versioned employee setup acknowledgment', () => {
  const valid = { termsAccepted: true, privacyAcknowledged: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }
  it('accepts only separate explicit agreement and acknowledgment of current versions', () => {
    expect(validSetupAcknowledgment(valid)).toBe(true)
    for (const value of [undefined, {}, { ...valid, termsAccepted: false }, { ...valid, privacyAcknowledged: false }, { ...valid, termsVersion: 'old' }, { ...valid, privacyVersion: 'old' }, { ...valid, termsAccepted: 'true' }]) expect(validSetupAcknowledgment(value)).toBeFalsy()
  })
})
