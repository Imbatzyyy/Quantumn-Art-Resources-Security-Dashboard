import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelEmailSignIn, initialEmailCode, prepareEmailCode } from './supabaseEmailVerification.js'

const { getSession, signOut } = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./supabaseClient.js', () => ({ requireSupabase: () => ({ auth: { getSession, signOut } }) }))
const delivery = { verified: false, maskedEmail: 't•••@example.test', challengeId: 'challenge', expiresAt: null, resendAt: null }
const send = vi.fn()
beforeEach(async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'session-a' } }, error: null })
  signOut.mockResolvedValue({ error: null })
  await cancelEmailSignIn()
  send.mockReset().mockImplementation(async () => new Response(JSON.stringify(delivery)))
  vi.stubGlobal('fetch', send)
})
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('early email dispatch', () => {
  it('reuses the in-flight delivery when the verification page opens', async () => {
    prepareEmailCode('employee', 'session-a')
    expect(await initialEmailCode('employee')).toEqual(delivery)
    expect(send).toHaveBeenCalledTimes(1)
    await initialEmailCode('employee')
    expect(send).toHaveBeenCalledTimes(2) // One-shot only; reload checks server state.
  })
  it.each(['different session', 'different portal', 'expired promise', 'cancelled'])('never reuses a %s', async reason => {
    prepareEmailCode('employee', 'session-a')
    await Promise.resolve()
    if (reason === 'different session') getSession.mockResolvedValue({ data: { session: { access_token: 'session-b' } } })
    if (reason === 'expired promise') { vi.useFakeTimers(); vi.setSystemTime(Date.now() + 31_000) }
    if (reason === 'cancelled') await cancelEmailSignIn()
    await initialEmailCode(reason === 'different portal' ? 'admin' : 'employee')
    expect(send).toHaveBeenCalledTimes(2)
  })
  it('surfaces an early send failure on the verification page without silently retrying', async () => {
    send.mockResolvedValue(new Response(JSON.stringify({ error: 'Delivery unavailable' }), { status: 502 }))
    prepareEmailCode('employee', 'session-a')
    await expect(initialEmailCode('employee')).rejects.toThrow('Delivery unavailable')
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('does not send without an authenticated session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await expect(initialEmailCode('employee')).rejects.toThrow('expired')
    expect(send).not.toHaveBeenCalled()
  })
})
