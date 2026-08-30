import { useEffect, useState } from 'react'
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
import { Link, useNavigate } from 'react-router-dom'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { requireSupabase } from '../services/supabaseClient.js'

const strongPassword = (password) =>
  password.length >= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password)

export default function EmployeeRecoveryPage({ mode }) {
  const navigate = useNavigate()
  const isUpdate = mode === 'update'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkingLink, setCheckingLink] = useState(isUpdate)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!isUpdate) return undefined

    const client = requireSupabase()
    let active = true

    const verifyRecoverySession = async () => {
      const { data } = await client.auth.getSession()
      if (active) {
        setRecoveryReady(Boolean(data.session))
        setCheckingLink(false)
      }
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        setRecoveryReady(true)
        setCheckingLink(false)
      }
    })

    verifyRecoverySession()
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [isUpdate])

  const requestReset = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const client = requireSupabase()
      const redirectOrigin = window.location.hostname === 'localhost'
        ? window.location.origin
        : 'https://quantumnhr.com'
      const redirectTo = `${redirectOrigin}/employee/reset-password`
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
      setSuccess('If this email belongs to an employee account, a secure password-reset link has been sent.')
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!strongPassword(password)) {
      setError('Use at least 12 characters with uppercase, lowercase, a number, and a symbol.')
      return
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const client = requireSupabase()
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) throw updateError
      await client.auth.signOut()
      setSuccess('Your password has been updated. You can now sign in with your new password.')
      window.setTimeout(() => navigate('/employee/login', { replace: true }), 1800)
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
          <span>Employee account recovery</span>
        </div>

        <div className="recovery-card">
          <span className="portal-mark" aria-hidden="true">
            {success ? <CheckCircle2 size={23} /> : <ShieldCheck size={23} />}
          </span>
          <span className="portal-label">Employee portal</span>
          <h1>{isUpdate ? 'Create a new password' : 'Recover your account'}</h1>
          <p>
            {isUpdate
              ? 'Choose a strong, unique password for your employee account.'
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
              This recovery link is invalid or has expired. Request a new email to continue.
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
              <p className="password-requirement">12+ characters · uppercase · lowercase · number · symbol</p>
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

          <Link className="recovery-back" to={isUpdate && !recoveryReady ? '/employee/forgot-password' : '/employee/login'}>
            <ArrowLeft size={17} />
            {isUpdate && !recoveryReady ? 'Request a new recovery email' : 'Back to employee sign in'}
          </Link>
        </div>
      </section>
    </main>
  )
}
