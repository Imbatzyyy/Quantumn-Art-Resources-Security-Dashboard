import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticate, getCurrentUser } from './supabaseAuth.js'

const mocks = vi.hoisted(() => ({ password: vi.fn(), assurance: vi.fn(), factors: vi.fn(), profile: vi.fn(), session: vi.fn(), prepare: vi.fn(), signOut: vi.fn() }))
vi.mock('./supabaseClient.js', () => ({ requireSupabase: () => ({ auth: { signInWithPassword: mocks.password, signOut: mocks.signOut, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance, listFactors: mocks.factors } } }) }))
vi.mock('./supabaseReads.js', () => ({ getProfileByAuthId: mocks.profile, currentSession: mocks.session, clearCurrentBrowserSessionCode: vi.fn(), currentBrowserSessionCode: vi.fn(), saveCurrentBrowserSessionCode: vi.fn() }))
vi.mock('./supabaseEmailVerification.js', () => ({ prepareEmailCode: mocks.prepare }))
const identity = { id: 'EMP-QA', role: 'employee', email: 'local@example.test', status: 'Active', firstName: 'Local', lastName: 'QA', requiresMfa: false, emailVerified: false, mustChangePassword: true }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.password.mockResolvedValue({ data: { user: { id: 'auth-qa', app_metadata: { must_change_password: true } }, session: { access_token: 'fixture-token' } }, error: null })
  mocks.profile.mockResolvedValue(identity)
  mocks.assurance.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
  mocks.session.mockResolvedValue({ user: { id: 'auth-qa' } })
})
describe('optimized authentication routing', () => {
  it('returns a setup identity, not a false MFA challenge, for a new employee', async () => {
    const result = await authenticate({ email: 'local@example.test', password: 'fictional', portal: 'employee' })
    expect(result).toMatchObject({ id: 'EMP-QA', mustChangePassword: true, portal: 'employee' })
    expect('mfaRequired' in result).toBe(false)
    expect('emailVerificationRequired' in result).toBe(false)
    expect(mocks.prepare).not.toHaveBeenCalled()
  })
  it('starts email dispatch before any identity read for a setup-complete password response', async () => {
    mocks.password.mockResolvedValue({ data: { user: { id: 'auth-qa', app_metadata: {} }, session: { access_token: 'fixture-token' } }, error: null })
    expect(await authenticate({ email: 'local@example.test', password: 'fictional', portal: 'employee' })).toEqual({ emailVerificationRequired: true, portal: 'employee' })
    expect(mocks.prepare).toHaveBeenCalledWith('employee', 'fixture-token')
    expect(mocks.profile).not.toHaveBeenCalled()
  })
  it('does not send if password authentication fails', async () => {
    mocks.password.mockResolvedValue({ error: { message: 'Invalid credentials' } })
    await expect(authenticate({ email: 'local@example.test', password: 'incorrect', portal: 'employee' })).rejects.toThrow('incorrect')
    expect(mocks.prepare).not.toHaveBeenCalled()
  })
  it('does not restore a pending authenticator session or sign out other devices', async () => {
    mocks.profile.mockResolvedValue({ ...identity, mustChangePassword: false, emailVerified: true, requiresMfa: true })
    expect(await getCurrentUser()).toBeNull()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})
