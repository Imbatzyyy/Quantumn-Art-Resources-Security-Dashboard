import { useState } from 'react'
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
  UserRound,
  UsersRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import logoWhite from '../../assets/images/mainlogo.png'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { useHrms } from '../state/useHrms.js'

export default function LoginPage({ portal }) {
  const { login, verifyMfaLogin, logout } = useHrms()
  const navigate = useNavigate()
  const isAdmin = portal === 'admin'
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [authenticatorCode, setAuthenticatorCode] = useState('')
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const result = await login({ ...form, portal })
      if (result?.mfaRequired) {
        setMfaChallenge(result)
        setForm((current) => ({ ...current, password: '' }))
        return
      }
      navigate(`/${portal}`)
    } catch (reason) {
      setError(reason.message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitMfa = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await verifyMfaLogin({
        factorId: mfaChallenge.factorId,
        code: authenticatorCode,
        portal,
      })
      navigate(`/${portal}`)
    } catch (reason) {
      setError(reason.message)
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
          <img src={isAdmin ? logoWhite : logoBlue} alt="Quantumn Art Resources" />
          <span>Human Resource Management System</span>
        </div>

        <div className="login-story-content">
          <span className="story-kicker">
            {isAdmin ? <ShieldCheck size={16} /> : <UserRound size={16} />}
            {isAdmin ? 'Administrative control' : 'Employee workspace'}
          </span>
          <h1>{isAdmin ? 'Lead HR operations with clarity.' : 'Your workday, all in one place.'}</h1>
          <p>
            {isAdmin
              ? 'Manage people, approvals, access, and security activity from one accountable workspace.'
              : 'Access attendance, leave, payroll, and personal records through a workspace designed around you.'}
          </p>

          {isAdmin ? (
            <div className="admin-login-summary" aria-label="Administrative workspace protections">
              <article>
                <span><UsersRound size={19} /> People and access</span>
                <strong>Role protected</strong>
                <small>Administrative actions require verified access.</small>
              </article>
              <article>
                <span><Activity size={19} /> Security activity</span>
                <strong>Accountable</strong>
                <small>Sensitive changes remain visible in the audit trail.</small>
              </article>
            </div>
          ) : (
            <div className="employee-login-summary" aria-label="Employee workspace features">
              <div className="employee-summary-feature">
                <span><CalendarCheck2 size={21} /></span>
                <div>
                  <strong>A simpler workday</strong>
                  <small>Complete everyday HR tasks without unnecessary steps.</small>
                </div>
              </div>
              <div className="employee-summary-pills">
                <span><CalendarCheck2 size={16} /> Attendance</span>
                <span><FileCheck2 size={16} /> Requests</span>
                <span><LockKeyhole size={16} /> Private records</span>
              </div>
            </div>
          )}
        </div>

        <div className="login-story-footer">
          <ShieldCheck size={17} />
          <span>{isAdmin ? 'Monitored administrative access' : 'Private access to your employment records'}</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={mfaChallenge ? submitMfa : submit} aria-busy={submitting}>
          <div className="login-heading">
            <span className="portal-mark" aria-hidden="true">
              {isAdmin ? <ShieldCheck size={23} /> : <UserRound size={23} />}
            </span>
            <span className="portal-label">{isAdmin ? 'Admin portal' : 'Employee portal'}</span>
            <h2>{mfaChallenge ? 'Verify your authenticator' : isAdmin ? 'Administrator sign in' : 'Welcome to your workspace'}</h2>
            <p>
              {mfaChallenge
                ? 'Enter the current 6-digit code from the authenticator app connected to your account.'
                : isAdmin
                ? 'Use your authorized administrator account to continue.'
                : 'Sign in with the work account issued by your organization.'}
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

          {!mfaChallenge && <label className="field-label" htmlFor={`${portal}-password`}>
            <span className="password-label-row">
              <span>Password</span>
              {!isAdmin && <Link to="/employee/forgot-password">Forgot password?</Link>}
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
          </label>}

          {mfaChallenge && (
            <label className="field-label" htmlFor={`${portal}-authenticator-code`}>
              Authenticator code
              <span className="login-input">
                <ShieldCheck size={18} aria-hidden="true" />
                <input
                  id={`${portal}-authenticator-code`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength="6"
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
            <span>{submitting ? 'Verifying account…' : mfaChallenge ? 'Verify & continue' : `Sign in to ${isAdmin ? 'Admin Console' : 'Employee Portal'}`}</span>
            {!submitting && <ArrowRight size={18} />}
          </button>

          {mfaChallenge && <button className="text-button login-back-button" type="button" onClick={cancelMfa}>Use a different account</button>}

          <div className="login-assurance">
            <LockKeyhole size={18} aria-hidden="true" />
            <div>
              <strong>Protected account access</strong>
              <span>Your role and permissions are verified before the workspace opens.</span>
            </div>
          </div>

        </form>
      </section>
    </main>
  )
}
