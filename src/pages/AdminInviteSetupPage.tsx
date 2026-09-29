import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Eye, EyeOff, LockKeyhole, ShieldCheck, UserCog } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logoWhite from '../../assets/images/mainlogo.png'
import { Field } from '../components/readable.js'
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

interface InvitationDetails { email: string; firstName: string; lastName: string; role: string }

// `preview` renders a fictional invitation for layout QA only; the real route
// always verifies the invitation through the Supabase session.
export default function AdminInviteSetupPage({ preview }: { preview?: InvitationDetails }) {
  const { user, completeAdminInvitation } = useHrms()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(!preview && isSupabaseConfigured)
  const [ready, setReady] = useState(Boolean(preview))
  const [metadata, setMetadata] = useState<InvitationDetails>(preview ?? { email: '', firstName: '', lastName: '', role: '' })
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(preview || isSupabaseConfigured
    ? ''
    : 'Secure administrator invitations are not configured in this preview environment.')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (preview || !isSupabaseConfigured) return undefined

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
  }, [preview])

  const context = useMemo(() => ({
    email: metadata.email || user?.email,
    firstName: metadata.firstName || user?.firstName,
    lastName: metadata.lastName || user?.lastName,
  }), [metadata, user])
  const checks = passwordChecks(form.password, context)
  const strength = passwordStrength(form.password, context)
  const matches = Boolean(form.confirmPassword) && form.password === form.confirmPassword
  const hasPassword = form.password.length > 0
  const roleLabel = roleLabels[metadata.role] || metadata.role
  const inputType = showPassword ? 'text' : 'password'
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
        <div><span><ShieldCheck aria-hidden="true" /> Privileged account activation</span><h1>Secure your administrator access.</h1><p>Your assigned role uses least-privilege permissions, monitored sessions, and an accountable audit trail.</p></div>
        <small>Quantum HRMS · Administrator identity setup</small>
      </section>
      <section className="admin-invite-panel">
        <div className="admin-invite-card">
          <div className="rf-invite-head">
            <span className={`rf-icon ${success ? 'rf-icon--success' : 'rf-icon--info'}`}>{success ? <CheckCircle2 aria-hidden="true" /> : <UserCog aria-hidden="true" />}</span>
            <div><span className="rf-banner-label">Administrator invitation</span><h2>{success ? 'Your administrator account is ready' : 'Create your private password'}</h2></div>
          </div>
          <p className="rf-invite-lead">{success ? 'You will be taken to the administrator sign-in page in a moment.' : `Set a password to activate your ${roleLabel || 'administrator'} account. Only you will know it.`}</p>

          {checking && <div className="recovery-status"><span className="status-spinner" /><div><strong>Checking your invitation</strong><small>This takes a few seconds.</small></div></div>}
          {!checking && !ready && !success && <p className="rf-error" role="alert">{error || 'This invitation is invalid, expired, or has already been used. Ask your System Administrator to send a new invitation.'}</p>}
          {success && <div className="recovery-success"><CheckCircle2 aria-hidden="true" /><div><strong>Password created</strong><p>Sign in with your invited email and your new password.</p></div></div>}

          {ready && !success && (
            <form className="rf-invite-form" onSubmit={submit} aria-busy={submitting}>
              <dl className="rf-invite-account" aria-label="Invited account">
                <div><dt>Email</dt><dd>{metadata.email}</dd></div>
                <div><dt>Role</dt><dd><span className="badge badge-success">{roleLabel}</span></dd></div>
              </dl>

              <Field label="New password" help={`At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words work well.`}>
                {(control) => <input {...control} type={inputType} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Use a long, unique passphrase" required />}
              </Field>
              <Field label="Confirm new password">
                {(control) => <>
                  <input {...control} className={form.confirmPassword ? matches ? 'is-valid' : 'is-invalid' : ''} type={inputType} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Enter the new password again" required />
                  {form.confirmPassword && <span className={`rf-match ${matches ? 'is-match' : 'is-mismatch'}`}>{matches ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}{matches ? 'Passwords match.' : 'The passwords do not match yet.'}</span>}
                </>}
              </Field>
              <button className="rf-toggle" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{showPassword ? 'Hide passwords' : 'Show passwords'}</button>

              <section className="rf-summary" aria-label="Password requirements">
                <h3>Password requirements</h3>
                <div className="rf-strength">
                  <div className="rf-strength-head"><span>Strength</span><strong>{strength.label}</strong></div>
                  <div className={`rf-meter strength-${strength.score}`} role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score} aria-valuetext={strength.label}><i /><i /><i /><i /></div>
                </div>
                <ul className="rf-checklist">
                  {[
                    [hasPassword && checks.length && checks.maximum, `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters (longer is better)`],
                    [hasPassword && checks.notCommon, 'Not a common or easy-to-guess password'],
                    [hasPassword && checks.notPersonal, 'Does not include your name, email username, or “Quantum HRMS”'],
                    [matches, 'Both password entries match'],
                  ].map(([met, text]) => <li className={met ? 'is-met' : ''} key={String(text)}>{met ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}<span><span className="sr-only">{met ? 'Met: ' : 'Not met yet: '}</span>{text}</span></li>)}
                </ul>
              </section>

              {error && <p className="rf-error" role="alert">{error}</p>}
              <button className="button button-primary rf-invite-submit" disabled={submitting || !readyToSubmit}>{submitting ? 'Securing your account…' : <>Create password &amp; activate account<ArrowRight aria-hidden="true" /></>}</button>
              <p className="rf-note"><LockKeyhole aria-hidden="true" /><span>Your password is never shown to other administrators or stored in your employee record.</span></p>
            </form>
          )}
          <Link className="recovery-back" to="/admin/login">Return to administrator sign in</Link>
        </div>
      </section>
    </main>
  )
}
