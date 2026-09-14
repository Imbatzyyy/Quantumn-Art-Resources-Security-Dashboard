import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { validatePermanentPassword } from '../utils/passwordPolicy.js'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { isSupabaseConfigured, requireSupabase } from '../services/supabaseClient.js'

export default function EmployeeRecoveryPage({ mode, portal = 'employee' }: { mode: 'request' | 'update'; portal?: 'employee' | 'admin' }) {
  const isUpdate = mode === 'update'
  const recoveryUnavailable = isUpdate && !isSupabaseConfigured
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkingLink, setCheckingLink] = useState(isUpdate && isSupabaseConfigured)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [error, setError] = useState(recoveryUnavailable
    ? 'Secure account recovery is not configured in this preview environment.'
    : '')
  const [success, setSuccess] = useState('')
  const [mfaFactor, setMfaFactor] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')

  useEffect(() => {
    if (!isUpdate || !isSupabaseConfigured) return undefined

    const client = requireSupabase()
    let active = true

    const verifyRecoverySession = async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession()
        if (sessionError) throw sessionError
        if (!data.session) { if (active) setRecoveryReady(false); return }
        const { data: assurance, error: assuranceError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) throw assuranceError
        let factor: string | null = null
        if (assurance?.nextLevel === 'aal2' && assurance.currentLevel !== 'aal2') {
          const { data: factors, error: factorError } = await client.auth.mfa.listFactors()
          if (factorError || !factors.totp[0]) throw new Error('Authenticator verification is unavailable. Try opening the recovery link again.')
          factor = factors.totp[0].id
        }
        if (active) { setMfaFactor(factor); setRecoveryReady(true) }
      } catch { if (active) { setError('Your recovery session could not be verified. Open the link again or request a new email.'); setRecoveryReady(false) } }
      finally { if (active) setCheckingLink(false) }
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        // Supabase Auth callbacks must not await another Auth operation under its lock.
        window.setTimeout(() => { if (active) void verifyRecoverySession() }, 0)
      }
    })

    verifyRecoverySession()
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [isUpdate])

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const client = requireSupabase()
      const redirectOrigin = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? window.location.origin
        : 'https://quantumnhr.com'
      const redirectTo = `${redirectOrigin}/${portal}/reset-password`
      const { error: resetError } = await client.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo },
      )
      if (resetError) {
        if (resetError.status === 429) {
          throw new Error('Please wait a minute before requesting another recovery email.')
        }
        throw new Error('The recovery email could not be sent. Please try again shortly.')
      }
      setSuccess('If this email belongs to a registered account, a secure password-reset link has been sent.')
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The recovery email could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSuccess('')

    if (validatePermanentPassword(password)) {
      setError(validatePermanentPassword(password) || 'Choose a secure passphrase.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const client = requireSupabase()
      if (mfaFactor) {
        const { error: mfaError } = await client.auth.mfa.challengeAndVerify({ factorId: mfaFactor, code: mfaCode.trim() })
        if (mfaError) { setError('Enter the current 6-digit code from your authenticator.'); return }
        setMfaFactor(null); setMfaCode('')
      }
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError
      await client.auth.signOut()
      setSuccess('Your password has been updated. You can now sign in with your new password.')
      window.setTimeout(() => window.location.replace(`/${portal}/login`), 1800)
    } catch {
      setError('This recovery link is invalid or has expired. Request a new password-reset email.')
      setRecoveryReady(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="recovery-page employee-auth">
      <section className="recovery-shell">
        <div className="recovery-brand">
          <img src={logoBlue} alt="Quantumn Art Resources" />
          <span>{portal === 'admin' ? 'Administrator' : 'Employee'} account recovery</span>
        </div>

        <div className="recovery-card">
          <span className="portal-mark" aria-hidden="true">
            {success ? <CheckCircle2 size={23} /> : <ShieldCheck size={23} />}
          </span>
          <span className="portal-label">{portal === 'admin' ? 'Administrator' : 'Employee'} portal</span>
          <h1>{isUpdate ? 'Create a new password' : 'Recover your account'}</h1>
          <p>
            {isUpdate
              ? 'Choose a strong, unique passphrase for your work account.'
              : 'Enter the same work email registered by your HR administrator.'}
          </p>

          {checkingLink && (
            <div className="recovery-status" role="status">
              <span className="status-spinner" />
              <div><strong>Checking secure link</strong><small>Please wait a moment.</small></div>
            </div>
          )}

          {isUpdate && !checkingLink && !recoveryReady && !success && (
            <div className="form-error" role="alert">
              {error || 'This recovery link is invalid or has expired. Request a new email to continue.'}
            </div>
          )}

          {!isUpdate && !success && (
            <form onSubmit={requestReset} aria-busy={submitting}>
              <label className="field-label" htmlFor="recovery-email">
                Work email
                <span className="login-input">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="recovery-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </span>
              </label>
              {error && <div className="form-error" role="alert" aria-live="polite">{error}</div>}
              <button className="login-submit" type="submit" disabled={submitting}>
                <span>{submitting ? 'Sending secure email…' : 'Send password-reset email'}</span>
                {!submitting && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {isUpdate && recoveryReady && !success && (
            <form onSubmit={updatePassword} aria-busy={submitting}>
              {mfaFactor && <label className="field-label" htmlFor="recovery-mfa">Authenticator code
                <span className="login-input"><ShieldCheck size={18} aria-hidden="true" /><input id="recovery-mfa" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="6-digit code" /></span>
                <small>Your enrolled authenticator is required even when resetting by email. If you lost access, contact your administrator for verified recovery.</small>
              </label>}
              <label className="field-label" htmlFor="new-password">
                New password
                <span className="login-input password-field">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Enter a strong password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              <label className="field-label" htmlFor="confirm-password">
                Confirm new password
                <span className="login-input">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </span>
              </label>
              <p className="password-requirement">15+ characters · unique passphrase</p>
              {error && <div className="form-error" role="alert" aria-live="polite">{error}</div>}
              <button className="login-submit" type="submit" disabled={submitting}>
                <span>{submitting ? 'Updating password…' : 'Update password'}</span>
                {!submitting && <ArrowRight size={18} />}
              </button>
            </form>
          )}

          {success && (
            <div className="recovery-success" role="status" aria-live="polite">
              <CheckCircle2 size={21} />
              <div><strong>{isUpdate ? 'Password updated' : 'Check your inbox'}</strong><p>{success}</p></div>
            </div>
          )}

          <div className="recovery-assurance">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>For privacy, the recovery request does not reveal whether an email is registered.</span>
          </div>

          <Link className="recovery-back" to={isUpdate && !recoveryReady ? `/${portal}/forgot-password` : `/${portal}/login`}>
            <ArrowLeft size={17} />
            {isUpdate && !recoveryReady ? 'Request a new recovery email' : `Back to ${portal === 'admin' ? 'administrator' : 'employee'} sign in`}
          </Link>
        </div>
      </section>
    </main>
  )
}
