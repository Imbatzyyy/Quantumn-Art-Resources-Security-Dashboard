import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { Modal } from './ui.js'
import { useHrms } from '../state/useHrms.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  passwordStrength,
  validatePermanentPassword,
} from '../utils/passwordPolicy.js'

function PasswordRule({ passed, children }: { passed: boolean; children: ReactNode }) {
  return (
    <li className={passed ? 'passed' : ''}>
      {passed ? <CheckCircle2 /> : <Circle />}
      <span>{children}</span>
    </li>
  )
}

export default function FirstLoginPasswordSetup() {
  const { user, completeInitialPassword, logout } = useHrms()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const context = useMemo(() => ({
    currentPassword: form.currentPassword,
    email: user?.email,
    firstName: user?.firstName,
    lastName: user?.lastName,
  }), [form.currentPassword, user])
  if (!user) return null
  const checks = passwordChecks(form.newPassword, context)
  const strength = passwordStrength(form.newPassword, context)
  const matches = Boolean(form.confirmPassword) && form.newPassword === form.confirmPassword
  const ready = Object.values(checks).every(Boolean) && matches && Boolean(form.currentPassword)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const policyError = validatePermanentPassword(form.newPassword, context)
    if (policyError) return setError(policyError)
    if (!matches) return setError('The new password and confirmation do not match.')

    setSaving(true)
    try {
      await completeInitialPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your password could not be updated.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Secure your employee account" size="wide" dismissible={false}>
      <div className="first-login-setup">
        <section className="first-login-intro">
          <span><ShieldCheck /></span>
          <div>
            <small>Required before entering the workspace</small>
            <h2>Create your private password</h2>
            <p>The password in your credentials email is temporary. Replace it now so only you can access your HR information.</p>
          </div>
        </section>

        <form className="first-login-form" onSubmit={submit} aria-busy={saving}>
          <div className="first-login-fields">
            <label>
              Temporary password
              <span className="setup-password-input">
                <KeyRound />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.currentPassword}
                  onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
                  placeholder="From your credentials email"
                  required
                />
              </span>
            </label>
            <label>
              New private password
              <span className="setup-password-input">
                <LockKeyhole />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={form.newPassword}
                  onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
                  placeholder="A long, unique passphrase"
                  required
                />
              </span>
            </label>
            <label>
              Confirm new password
              <span className="setup-password-input">
                <ShieldCheck />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                  placeholder="Enter the same password again"
                  required
                />
              </span>
            </label>
            <button className="setup-visibility" type="button" onClick={() => setShowPasswords((visible) => !visible)}>
              {showPasswords ? <EyeOff /> : <Eye />}
              {showPasswords ? 'Hide passwords' : 'Show passwords'}
            </button>
          </div>

          <aside className="password-guidance" aria-label="Password security guidance">
            <div className="strength-heading">
              <div><span>Password strength</span><strong>{strength.label}</strong></div>
              <div className={`strength-meter strength-${strength.score}`}><i /><i /><i /><i /></div>
            </div>
            <ul>
              <PasswordRule passed={checks.length}>At least {PASSWORD_MIN_LENGTH} characters; longer passphrases are encouraged</PasswordRule>
              <PasswordRule passed={checks.notCurrent}>Different from the emailed temporary password</PasswordRule>
              <PasswordRule passed={checks.notCommon}>Not a commonly used or easily guessed password</PasswordRule>
              <PasswordRule passed={checks.notPersonal}>Does not contain your name, email username, or “Quantum HRMS”</PasswordRule>
              <PasswordRule passed={matches}>Both new-password entries match</PasswordRule>
            </ul>
            <div className="password-tip"><ShieldCheck /><p>Use a password manager or a unique multi-word passphrase. Spaces and symbols are allowed. Never reuse this password or send it by email or chat.</p></div>
          </aside>

          {error && <p className="form-error setup-error" role="alert">{error}</p>}
          <div className="first-login-actions">
            <button className="button button-secondary" type="button" onClick={logout} disabled={saving}><LogOut />Sign out instead</button>
            <button className="button button-primary" disabled={!ready || saving}>{saving ? 'Securing your account…' : 'Save password & enter workspace'}</button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
