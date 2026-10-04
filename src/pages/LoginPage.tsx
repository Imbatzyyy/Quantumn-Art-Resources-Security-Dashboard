import { useState, type FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  CalendarCheck2,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logoWhite from '../../assets/images/mainlogo.png'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { useHrms } from '../state/useHrms.js'
import type { AuthenticationResult, MfaChallenge, PortalKind } from '../types/hrms.js'

const adminFeatures: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: UsersRound, title: 'People and approvals', text: 'Employee records, leave, and HR requests' },
  { icon: CalendarCheck2, title: 'Time and payroll', text: 'Rosters, attendance, and pay periods' },
  { icon: Activity, title: 'Audit trail', text: 'Every sensitive change is recorded' },
]
const employeeFeatures: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: CalendarCheck2, title: 'Time and leave', text: 'Clock in and request time off' },
  { icon: FileCheck2, title: 'HR requests', text: 'Ask HR and follow every reply' },
  { icon: LockKeyhole, title: 'Private records', text: 'Payslips and documents only you can see' },
]

const errorMessage = (reason: unknown) => reason instanceof Error
  ? reason.message
  : 'The account could not be verified. Please try again.'

const isMfaChallenge = (result: AuthenticationResult): result is MfaChallenge =>
  'mfaRequired' in result

export default function LoginPage({ portal }: { portal: PortalKind }) {
  const { login, verifyMfaLogin, logout } = useHrms()
  const navigate = useNavigate()
  const isAdmin = portal === 'admin'
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)
  const [authenticatorCode, setAuthenticatorCode] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await login({ ...form, portal })
      if ('emailVerificationRequired' in result) {
        setForm((current) => ({ ...current, password: '' }))
        navigate(`/${portal}/verify-email`)
        return
      }
      if (isMfaChallenge(result)) {
        setMfaChallenge(result)
        setForm((current) => ({ ...current, password: '' }))
        return
      }
      navigate(`/${portal}`)
    } catch (reason: unknown) {
      setError(errorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  const submitMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mfaChallenge) return
    setSubmitting(true)
    setError('')
    try {
      await verifyMfaLogin({
        factorId: mfaChallenge.factorId,
        code: authenticatorCode,
        portal,
      })
      navigate(`/${portal}`)
    } catch (reason: unknown) {
      setError(errorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  const cancelMfa = async () => {
    await logout()
    setMfaChallenge(null)
    setAuthenticatorCode('')
    setError('')
  }

  return (
    <main className={`login-page ${isAdmin ? 'admin-auth' : 'employee-auth'}`}>
      <section className="login-story" aria-label={`${isAdmin ? 'Administrator' : 'Employee'} portal overview`}>
        <div className="login-brand">
          <img className="logo-on-light" src={logoBlue} alt="Quantumn Art Resources" />
          <img className="logo-on-dark" src={logoWhite} alt="Quantumn Art Resources" />
          <span>Quantum HRMS</span>
        </div>

        <div className="login-story-content">
          <span className="story-kicker">{isAdmin ? 'HR Admin console' : 'Employee portal'}</span>
          <h2>{isAdmin ? 'Run HR operations in one place.' : 'Your workday, all in one place.'}</h2>
          <p>
            {isAdmin
              ? 'People records, approvals, attendance, payroll, and security for your whole organization.'
              : 'Clock in, request leave, read your payslips, and get help from HR without the paperwork.'}
          </p>
          <ul className="login-features">
            {(isAdmin ? adminFeatures : employeeFeatures).map(({ icon: Icon, title, text }) => <li key={title}><span aria-hidden="true"><Icon size={18} /></span><div><strong>{title}</strong><small>{text}</small></div></li>)}
          </ul>
        </div>

        <p className="login-story-footer"><ShieldCheck size={16} aria-hidden="true" />{isAdmin ? 'Administrator access is monitored and recorded.' : 'Your records are visible only to you and authorized HR staff.'}</p>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={mfaChallenge ? submitMfa : submit} aria-busy={submitting}>
          <div className="login-heading">
            <span className="login-form-logo"><img className="logo-on-light" src={logoBlue} alt="Quantumn Art Resources" /><img className="logo-on-dark" src={logoWhite} alt="Quantumn Art Resources" /></span>
            <span className="portal-label">{isAdmin ? 'HR Admin console' : 'Employee portal'}</span>
            <h1>{mfaChallenge ? 'Enter your verification code' : isAdmin ? 'Administrator sign in' : 'Sign in to your workspace'}</h1>
            <p>
              {mfaChallenge
                ? 'Open your authenticator app and enter the current 6-digit code.'
                : isAdmin
                ? 'Use your administrator work account.'
                : 'Use the work email and password from HR.'}
            </p>
          </div>

          {!mfaChallenge && <label className="field-label" htmlFor={`${portal}-email`}>
            Work email
            <span className="login-input">
              <Mail size={18} aria-hidden="true" />
              <input
                id={`${portal}-email`}
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="name@company.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </span>
          </label>}

          {!mfaChallenge && <div className="field-label">
            <span className="password-label-row">
              <label htmlFor={`${portal}-password`}>Password</label>
            </span>
            <span className="login-input password-field">
              <KeyRound size={18} aria-hidden="true" />
              <input
                id={`${portal}-password`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            {<span className="login-recovery-row">
              {isAdmin ? <small>Need help signing in? Contact your System Administrator.</small> : <Link to="/employee/forgot-password">Forgot password?</Link>}
            </span>}
          </div>}

          {mfaChallenge && (
            <label className="field-label" htmlFor={`${portal}-authenticator-code`}>
              Verification code
              <span className="login-input">
                <ShieldCheck size={18} aria-hidden="true" />
                <input
                  id={`${portal}-authenticator-code`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={authenticatorCode}
                  onChange={(event) => setAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  autoFocus
                />
              </span>
            </label>
          )}

          {error && <div className="form-error" role="alert" aria-live="polite">{error}</div>}

          <button className="login-submit" type="submit" disabled={submitting}>
            <span>{submitting ? 'Signing in…' : mfaChallenge ? 'Verify and continue' : 'Sign in'}</span>
            {!submitting && <ArrowRight size={18} />}
          </button>

          {mfaChallenge && <button className="text-button login-back-button" type="button" onClick={cancelMfa}>Use a different account</button>}


        </form>
        <footer className="login-footer">
          <nav aria-label="Legal"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy Notice</Link></nav>
          <small>© {new Date().getFullYear()} Quantumn Art Resources</small>
        </footer>
      </section>
    </main>
  )
}
