import { requireSupabase } from './supabaseClient.js'
import { securityOperation } from './supabaseSecurityApi.js'
import { prepareEmailCode } from './supabaseEmailVerification.js'
import { employeeFromRow } from './supabaseMappers.js'
import type { Tables } from '../types/database.js'
import {
  clearCurrentBrowserSessionCode,
  currentBrowserSessionCode,
  currentSession,
  getProfileByAuthId,
  saveCurrentBrowserSessionCode,
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

const profileAvatarUrl = async (avatarPath?: string): Promise<string | undefined> => {
  if (!avatarPath) return undefined
  const { data, error } = await requireSupabase().storage
    .from('profile-avatars')
    .createSignedUrl(avatarPath, 5 * 60)
  if (error) return undefined
  return `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
}

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
  if (!profile.mustChangePassword && !profile.mustSetPassword && !profile.emailVerified) return null
  if (!['Active', 'On Leave'].includes(profile.status)) {
    await client.auth.signOut()
    throw new Error('This account is inactive. Contact an HR administrator.')
  }
  if (profile.requiresMfa) return null
  return {
    ...profile,
    portal: portalForRole(profile.role),
    avatarUrl: await profileAvatarUrl(profile.avatarPath),
    mustChangePassword: profile.mustChangePassword === true,
    mustSetPassword: profile.mustSetPassword === true,
  }
}

export async function authenticate({ email, password, portal }: LoginCredentials): Promise<AuthenticationResult> {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new Error('Email or password is incorrect.')

  // Metadata here only chooses a UI route. The email endpoint independently
  // checks fresh account status, setup state and portal before sending anything.
  if (!data.user.app_metadata?.must_change_password && !data.user.app_metadata?.must_set_password) {
    prepareEmailCode(portal, data.session.access_token)
    return { emailVerificationRequired: true, portal }
  }

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
    if (resolvedPortal === 'admin' && profile.mustSetPassword === true) {
      await client.auth.signOut()
      throw new Error('Accept the invitation email and create your password before signing in.')
    }

    if (!profile.mustChangePassword && !profile.mustSetPassword && !profile.emailVerified) {
      prepareEmailCode(resolvedPortal, data.session.access_token)
      return { emailVerificationRequired: true, portal: resolvedPortal }
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
      avatarUrl: await profileAvatarUrl(profile.avatarPath),
      mustChangePassword: profile.mustChangePassword === true,
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

export async function completeEmailSignIn(portal: PortalKind): Promise<AuthenticationResult> {
  const session = await currentSession()
  if (!session) throw new Error('Your sign-in session expired. Please sign in again.')
  const { data, error } = await requireSupabase().rpc('finish_hrms_signin', {
    selected_portal: portal, device_label: browserDeviceLabel(),
    location_label: `${Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'} (browser reported)`,
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Sign-in could not be completed.')
  if (data.mfaRequired === true && typeof data.factorId === 'string' && data.portal === portal) {
    return { mfaRequired: true, factorId: data.factorId, portal, email: '' }
  }
  const row = data.profile
  if (!row || typeof row !== 'object' || Array.isArray(row) || row.auth_user_id !== session.user.id || typeof data.sessionCode !== 'string') {
    throw new Error('Your sign-in identity could not be verified.')
  }
  const profile = employeeFromRow(row as Tables<'profiles'>)
  if (portalForRole(profile.role ?? '') !== portal) throw new Error('This account cannot access the selected portal.')
  saveCurrentBrowserSessionCode(session.user.id, data.sessionCode)
  // Photos arrive through the existing batched snapshot fetch, not a duplicate
  // signed-URL request on the verification critical path.
  return { ...profile, portal, mustChangePassword: false, mustSetPassword: false }
}

export async function verifyMfaLogin({ factorId, code, portal }: MfaLoginInput): Promise<PortalIdentity> {
  const client = requireSupabase()
  const normalizedCode = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('Enter the 6-digit authenticator code.')
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: normalizedCode })
  if (error) throw new Error('The authenticator code is invalid or expired.')
  const session = await currentSession()
  if (!session) throw new Error('Your authentication session has expired. Sign in again.')
  if (!session.user.app_metadata?.must_change_password && !session.user.app_metadata?.must_set_password) {
    const result = await completeEmailSignIn(portal)
    if ('mfaRequired' in result || 'emailVerificationRequired' in result) throw new Error('Verification is still required.')
    return result
  }
  const profile = await getProfileByAuthId(session.user.id)
  const resolvedPortal = portalForRole(profile.role)
  if (resolvedPortal !== portal) {
    await client.auth.signOut()
    throw new Error('This account cannot access the selected portal.')
  }
  return { ...profile, portal: resolvedPortal, avatarUrl: await profileAvatarUrl(profile.avatarPath), mustChangePassword: profile.mustChangePassword === true }
}

export async function recordCurrentSession(): Promise<string | null> {
  const session = await currentSession()
  if (!session) return null
  if (session.user.app_metadata?.must_change_password || session.user.app_metadata?.must_set_password) return null
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Location unavailable'
  const { data: sessionCode, error } = await requireSupabase().rpc('record_hrms_session', {
    device_label: browserDeviceLabel(), location_label: `${timeZone} (browser reported)`,
  })
  if (error || !sessionCode) throw new Error('Your session is no longer authorized. Please sign in again.')
  saveCurrentBrowserSessionCode(session.user.id, sessionCode)
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
