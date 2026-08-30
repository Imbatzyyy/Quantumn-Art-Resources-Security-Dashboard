import { requireSupabase } from './supabaseClient.js'
import { securityOperation } from './supabaseSecurityApi.js'
import {
  clearCurrentBrowserSessionCode,
  currentBrowserSessionCode,
  currentSession,
  getProfileByAuthId,
} from './supabaseReads.js'
import type {
  AuthenticationResult,
  LoginCredentials,
  MfaEnrollment,
  MfaLoginInput,
  MfaStatus,
  OrganizationSecuritySummary,
  PortalIdentity,
  PortalKind,
} from '../types/hrms.js'

const portalForRole = (role: string): PortalKind => role === 'employee' ? 'employee' : 'admin'

const browserDeviceLabel = (): string => {
  if (typeof navigator === 'undefined') return 'Web browser'
  const agent = navigator.userAgent
  const browser = agent.includes('Edg/') ? 'Microsoft Edge'
    : agent.includes('Chrome/') ? 'Google Chrome'
      : agent.includes('Safari/') ? 'Safari'
        : agent.includes('Firefox/') ? 'Firefox'
          : 'Web browser'
  const browserNavigator = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = browserNavigator.userAgentData?.platform || navigator.platform || 'Unknown device'
  return `${browser} on ${platform}`
}

export async function getCurrentUser(): Promise<PortalIdentity | null> {
  const session = await currentSession()
  if (!session) return null
  const client = requireSupabase()
  const profile = await getProfileByAuthId(session.user.id)
  if (!['Active', 'On Leave'].includes(profile.status)) {
    await client.auth.signOut()
    throw new Error('This account is inactive. Contact an HR administrator.')
  }
  const { data: assurance, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!error && assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
    await client.auth.signOut()
    return null
  }
  return {
    ...profile,
    portal: portalForRole(profile.role),
    mustChangePassword: session.user.app_metadata?.must_change_password === true,
    mustSetPassword: session.user.app_metadata?.must_set_password === true,
  }
}

export async function authenticate({ email, password, portal }: LoginCredentials): Promise<AuthenticationResult> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new Error('Email or password is incorrect.')

  try {
    const profile = await getProfileByAuthId(data.user.id)
    if (!['Active', 'On Leave'].includes(profile.status)) {
      throw new Error('This account is inactive. Contact an HR administrator.')
    }
    const resolvedPortal = portalForRole(profile.role)
    if (resolvedPortal !== portal) {
      await client.auth.signOut()
      throw new Error(portal === 'admin'
        ? 'This account does not have administrator access.'
        : 'Use the administrator portal for this account.')
    }
    if (resolvedPortal === 'admin' && data.user.app_metadata?.must_set_password === true) {
      await client.auth.signOut()
      throw new Error('Accept the invitation email and create your password before signing in.')
    }

    const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (assuranceError) throw assuranceError
    if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
      const { data: factors, error: factorsError } = await client.auth.mfa.listFactors()
      if (factorsError) throw factorsError
      const factor = factors.totp?.[0]
      if (!factor) throw new Error('Your multi-factor authentication setup is incomplete. Contact an administrator.')
      return { mfaRequired: true, factorId: factor.id, portal: resolvedPortal, email: profile.email }
    }
    return {
      ...profile, portal: resolvedPortal,
      mustChangePassword: data.user.app_metadata?.must_change_password === true,
      mustSetPassword: false,
    }
  } catch (reason: unknown) {
    await client.auth.signOut()
    throw reason
  }
}

export async function signOut(): Promise<void> {
  const client = requireSupabase()
  const session = await currentSession()
  if (session) {
    const currentSessionCode = currentBrowserSessionCode(session.user.id)
    try { await securityOperation({ action: 'end-current-session', currentSessionCode }) } catch { /* Sign-out still proceeds. */ }
    clearCurrentBrowserSessionCode(session.user.id)
  }
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function verifyMfaLogin({ factorId, code, portal }: MfaLoginInput): Promise<PortalIdentity> {
  const client = requireSupabase()
  const normalizedCode = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('Enter the 6-digit authenticator code.')
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: normalizedCode })
  if (error) throw new Error('The authenticator code is invalid or expired.')
  const session = await currentSession()
  if (!session) throw new Error('Your authentication session has expired. Sign in again.')
  const profile = await getProfileByAuthId(session.user.id)
  const resolvedPortal = portalForRole(profile.role)
  if (resolvedPortal !== portal) {
    await client.auth.signOut()
    throw new Error('This account cannot access the selected portal.')
  }
  return { ...profile, portal: resolvedPortal, mustChangePassword: false }
}

export async function recordCurrentSession(): Promise<string | null> {
  const session = await currentSession()
  if (!session) return null
  const sessionCode = currentBrowserSessionCode(session.user.id)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Location unavailable'
  const { data: assurance } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel()
  await securityOperation({
    action: 'record-session', sessionCode, device: browserDeviceLabel(),
    location: timeZone === 'Asia/Manila' ? 'Philippines · Asia/Manila' : timeZone,
    assuranceLevel: assurance?.currentLevel ?? 'aal1',
  })
  return sessionCode
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const client = requireSupabase()
  const [{ data: factors, error: factorsError }, { data: assurance, error: assuranceError }] = await Promise.all([
    client.auth.mfa.listFactors(), client.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  if (factorsError) throw factorsError
  if (assuranceError) throw assuranceError
  const verifiedFactor = factors.totp?.[0] ?? null
  return {
    enabled: Boolean(verifiedFactor), factorId: verifiedFactor?.id ?? null,
    friendlyName: verifiedFactor?.friendly_name || 'Quantum HRMS Authenticator',
    currentLevel: assurance?.currentLevel ?? 'aal1',
  }
}

export const getOrganizationSecuritySummary = (): Promise<OrganizationSecuritySummary> =>
  securityOperation<OrganizationSecuritySummary>({ action: 'organization-summary' })

export async function beginMfaEnrollment(): Promise<MfaEnrollment> {
  const client = requireSupabase()
  const { data: factors, error: factorsError } = await client.auth.mfa.listFactors()
  if (factorsError) throw factorsError
  if (factors.totp?.length) throw new Error('Authenticator MFA is already enabled for this account.')
  for (const factor of factors.all.filter((item) => item.factor_type === 'totp' && item.status !== 'verified')) {
    await client.auth.mfa.unenroll({ factorId: factor.id })
  }
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Quantum HRMS Authenticator' })
  if (error) throw error
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
}

export async function verifyMfaEnrollment(input: { factorId: string; code: string }): Promise<MfaStatus> {
  const normalizedCode = String(input.code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('Enter the 6-digit code from your authenticator app.')
  const client = requireSupabase()
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: input.factorId, code: normalizedCode })
  if (error) throw new Error('The authenticator code is invalid or expired.')
  await client.rpc('record_user_activity', {
    activity_action: 'Enabled multi-factor authentication', activity_target: 'Own administrator account',
  })
  return getMfaStatus()
}

export async function disableMfa(factorId: string | null): Promise<MfaStatus> {
  if (!factorId) throw new Error('No authenticator factor is available to disable.')
  const client = requireSupabase()
  const { error } = await client.auth.mfa.unenroll({ factorId })
  if (error) throw new Error('Re-authenticate with your authenticator before disabling MFA.')
  await client.rpc('record_user_activity', {
    activity_action: 'Disabled multi-factor authentication', activity_target: 'Own administrator account',
  })
  return getMfaStatus()
}
