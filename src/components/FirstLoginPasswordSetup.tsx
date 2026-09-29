import { useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { Modal } from './ui.js'
import { Banner, Field, FormFooter } from './readable.js'
import SignOutConfirmation from './SignOutConfirmation.js'
import { useHrms } from '../state/useHrms.js'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  passwordStrength,
  validatePermanentPassword,
} from '../utils/passwordPolicy.js'

export default function FirstLoginPasswordSetup() {
  const { user, completeInitialPassword, logout } = useHrms()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
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
  const hasNewPassword = form.newPassword.length > 0
  const ready = Object.values(checks).every(Boolean) && matches && Boolean(form.currentPassword)
  const inputType = showPasswords ? 'text' : 'password'

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

  return <>
    <Modal title="Secure your employee account" size="wide" dismissible={false}>
      <form className="rf-form rf-form--md rf-first-login" onSubmit={submit} aria-busy={saving}>
        <div className="rf-first-login-notice">
          <Banner icon={ShieldCheck} label="Required before you continue" title="Create your private password">
            The password in your welcome email is temporary. Replace it now so only you can open your HR information.
          </Banner>
        </div>

        <div className="rf-layout">
          <div className="rf-fields">
            <div className="rf-grid rf-grid--single">
              <Field label="Temporary password" help="It’s in your welcome email, “Your Quantum HRMS employee account is ready.”">
                {(control) => <input {...control} type={inputType} autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} placeholder="Enter the temporary password" required />}
              </Field>
              <Field label="New password" help={`At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words work well.`}>
                {(control) => <input {...control} type={inputType} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder="Use a long, unique passphrase" required />}
              </Field>
              <Field label="Confirm new password">
                {(control) => <>
                  <input {...control} className={form.confirmPassword ? matches ? 'is-valid' : 'is-invalid' : ''} type={inputType} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} placeholder="Enter the new password again" required />
                  {form.confirmPassword && <span className={`rf-match ${matches ? 'is-match' : 'is-mismatch'}`}>{matches ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}{matches ? 'Passwords match.' : 'The passwords do not match yet.'}</span>}
                </>}
              </Field>
            </div>
            <button className="rf-toggle" type="button" aria-pressed={showPasswords} onClick={() => setShowPasswords((visible) => !visible)}>{showPasswords ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{showPasswords ? 'Hide passwords' : 'Show passwords'}</button>
            {error && <p className="rf-error" role="alert">{error}</p>}
          </div>

          <aside className="rf-summary" aria-label="Password security guidance">
            <h3>Password requirements</h3>
            <div className="rf-strength">
              <div className="rf-strength-head"><span>Strength</span><strong>{strength.label}</strong></div>
              <div className={`rf-meter strength-${strength.score}`} role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={strength.score} aria-valuetext={strength.label}><i /><i /><i /><i /></div>
            </div>
            <ul className="rf-checklist">
              {[
                [hasNewPassword && checks.length && checks.maximum, `${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters (longer is better)`],
                [hasNewPassword && checks.notCurrent, 'Different from the temporary password'],
                [hasNewPassword && checks.notCommon, 'Not a common or easy-to-guess password'],
                [hasNewPassword && checks.notPersonal, 'Does not include your name, email username, or “Quantum HRMS”'],
                [matches, 'Both new password entries match'],
              ].map(([met, text]) => <li className={met ? 'is-met' : ''} key={String(text)}>{met ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}<span><span className="sr-only">{met ? 'Met: ' : 'Not met yet: '}</span>{text}</span></li>)}
            </ul>
            <p className="rf-note"><LockKeyhole aria-hidden="true" /><span>Tip: a password manager or a multi-word passphrase works well. Never reuse this password or share it by email or chat.</span></p>
          </aside>
        </div>

        <FormFooter icon={ShieldCheck} note="After saving, you go straight to your workspace.">
          <button className="button button-secondary" type="button" onClick={() => setShowSignOutConfirm(true)} disabled={saving}><LogOut aria-hidden="true" />Sign out instead</button>
          <button className="button button-primary" disabled={!ready || saving}>{saving ? 'Securing your account…' : 'Save password & enter workspace'}</button>
        </FormFooter>
      </form>
    </Modal>
    <SignOutConfirmation open={showSignOutConfirm} portal="employee" onCancel={() => setShowSignOutConfirm(false)} onConfirm={logout} />
  </>
}
