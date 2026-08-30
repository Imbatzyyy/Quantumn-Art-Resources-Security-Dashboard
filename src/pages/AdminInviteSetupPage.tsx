import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowRight, CheckCircle2, Circle, Eye, EyeOff, KeyRound, ShieldCheck, UserCog } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logoWhite from '../../assets/images/mainlogo.png'
import { isSupabaseConfigured, requireSupabase } from '../services/supabaseClient.js'
import { useHrms } from '../state/useHrms.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  passwordStrength,
  validatePermanentPassword,
} from '../utils/passwordPolicy.js'

const roleLabels: Record<string, string> = {
  admin: 'System Administrator',
  hr_admin: 'HR Administrator',
  payroll_admin: 'Payroll Administrator',
  security_admin: 'Security Administrator',
  auditor: 'Compliance Auditor',
}

export default function AdminInviteSetupPage() {
  const { user, completeAdminInvitation } = useHrms()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(isSupabaseConfigured)
  const [ready, setReady] = useState(false)
  const [metadata, setMetadata] = useState({ email: '', firstName: '', lastName: '', role: '' })
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(isSupabaseConfigured
    ? ''
    : 'Secure administrator invitations are not configured in this preview environment.')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    const client = requireSupabase()
    let active = true
    const inspect = async (session: Session | null) => {
      if (!active) return
      const invited = session?.user?.app_metadata?.must_set_password === true
      setReady(invited)
      setMetadata({
        email: session?.user?.email || '',
        firstName: session?.user?.user_metadata?.first_name || '',
        lastName: session?.user?.user_metadata?.last_name || '',
        role: session?.user?.app_metadata?.role || session?.user?.user_metadata?.invited_role || '',
      })
      setChecking(false)
    }
    client.auth.getSession().then(({ data }) => inspect(data.session))
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => inspect(session))
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const context = useMemo(() => ({
    email: metadata.email || user?.email,
    firstName: metadata.firstName || user?.firstName,
    lastName: metadata.lastName || user?.lastName,
  }), [metadata, user])
  const checks = passwordChecks(form.password, context)
  const strength = passwordStrength(form.password, context)
  const matches = Boolean(form.confirmPassword) && form.password === form.confirmPassword
  const readyToSubmit = Object.values(checks).every(Boolean) && matches

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const policyError = validatePermanentPassword(form.password, context)
    if (policyError) return setError(policyError)
    if (!matches) return setError('The password and confirmation do not match.')
    setSubmitting(true)
    try {
      await completeAdminInvitation({ newPassword: form.password })
      setSuccess(true)
      window.setTimeout(() => navigate('/admin/login', { replace: true }), 1500)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The invitation could not be completed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin-invite-page">
      <section className="admin-invite-story">
        <img src={logoWhite} alt="Quantumn Art Resources" />
        <div><span><ShieldCheck /> Privileged account activation</span><h1>Secure your administrator access.</h1><p>Your assigned role uses least-privilege permissions, monitored sessions, and an accountable audit trail.</p></div>
        <small>Quantum HRMS · Administrator identity setup</small>
      </section>
      <section className="admin-invite-panel">
        <div className="admin-invite-card">
          <span className="portal-mark"><UserCog /></span>
          <span className="portal-label">Administrator invitation</span>
          <h2>{success ? 'Your administrator account is ready' : 'Create your private password'}</h2>
          <p>{success ? 'You will be redirected to the administrator sign-in page.' : `Complete the personal invitation for ${roleLabels[metadata.role] || 'your assigned role'}.`}</p>

          {checking && <div className="recovery-status"><span className="status-spinner" /><div><strong>Verifying invitation</strong><small>Checking the secure Supabase session.</small></div></div>}
          {!checking && !ready && !success && <div className="form-error" role="alert">{error || 'This invitation is invalid, expired, or has already been completed. Ask your System Administrator to issue a new invitation.'}</div>}
          {success && <div className="recovery-success"><CheckCircle2 /><div><strong>Password created</strong><p>Use your invited email and new password to sign in.</p></div></div>}

          {ready && !success && (
            <form className="admin-invite-form" onSubmit={submit} aria-busy={submitting}>
              <div className="invited-account-summary"><small>Invited account</small><strong>{metadata.email}</strong><span>{roleLabels[metadata.role] || metadata.role}</span></div>
              <label>New private password<span className="login-input password-field"><KeyRound /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="A long, unique passphrase" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
              <label>Confirm password<span className="login-input"><ShieldCheck /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Enter the same password again" required /></span></label>
              <div className="invite-password-guidance"><div><span>Password strength</span><strong>{strength.label}</strong></div><ul><li className={checks.length ? 'passed' : ''}>{checks.length ? <CheckCircle2 /> : <Circle />}At least {PASSWORD_MIN_LENGTH} characters</li><li className={checks.notCommon ? 'passed' : ''}>{checks.notCommon ? <CheckCircle2 /> : <Circle />}Not commonly used or easily guessed</li><li className={checks.notPersonal ? 'passed' : ''}>{checks.notPersonal ? <CheckCircle2 /> : <Circle />}Does not contain your name, email, or Quantum HRMS</li><li className={matches ? 'passed' : ''}>{matches ? <CheckCircle2 /> : <Circle />}Both password entries match</li></ul></div>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="login-submit" disabled={submitting || !readyToSubmit}><span>{submitting ? 'Securing administrator account…' : 'Create password & activate account'}</span>{!submitting && <ArrowRight />}</button>
            </form>
          )}
          <Link className="recovery-back" to="/admin/login">Return to administrator sign in</Link>
        </div>
      </section>
    </main>
  )
}
