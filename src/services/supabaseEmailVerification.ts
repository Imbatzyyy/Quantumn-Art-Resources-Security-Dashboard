import { requireSupabase } from './supabaseClient.js'
import type { PortalKind } from '../types/hrms.js'

export interface EmailSignInContext {
  portal: PortalKind
  setupRequired: boolean
  passwordAuthenticated: boolean
  verified: boolean
}

export async function emailSignInContext(): Promise<EmailSignInContext> {
  const { data, error } = await requireSupabase().rpc('signin_email_context')
  if (error || !data || typeof data !== 'object' || Array.isArray(data)
    || typeof data.verified !== 'boolean' || typeof data.setupRequired !== 'boolean'
    || !['admin', 'employee'].includes(String(data.portal))) {
    throw new Error('Your sign-in session could not be verified. Please sign in again.')
  }
  return data as unknown as EmailSignInContext
}

export interface EmailCodeState {
  maskedEmail: string
  verified: boolean
  challengeId: string | null
  expiresAt: string | null
  resendAt: string | null
}

export async function cancelEmailSignIn(): Promise<void> {
  // Cancelling an unfinished sign-in must not sign out the user's other devices.
  const { error } = await requireSupabase().auth.signOut({ scope: 'local' })
  if (error) throw new Error('The sign-in could not be cancelled. Please try again.')
}

export class EmailCodeError extends Error {
  retryAt?: string
  status: number
  constructor(message: string, status: number, retryAt?: string) {
    super(message)
    this.status = status
    this.retryAt = retryAt
  }
}

export async function emailCodeOperation(portal: PortalKind, action: 'status' | 'send' | 'resend' | 'verify', input: { code?: string; challengeId?: string } = {}): Promise<EmailCodeState> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error || !data.session) throw new EmailCodeError('Your sign-in session has expired. Sign in again.', 401)
  const response = await fetch('/api/signin-email', {
    method: 'POST',
    headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ portal, action, ...input }),
    signal: AbortSignal.timeout(25_000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new EmailCodeError(result.error || 'Verification is temporarily unavailable. Please try again.', response.status, result.retryAt)
  return result as EmailCodeState
}
