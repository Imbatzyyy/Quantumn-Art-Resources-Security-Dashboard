import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { requireSupabase } from '../services/supabaseClient.js'
import { adminPasswordReset } from '../services/adminPasswordReset.js'
import { Field } from '../components/readable.js'
import { validatePermanentPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../utils/passwordPolicy.js'

const storageKey = 'quantum-admin-password-reset'
interface ResetSession { requestId: string; expiresAt: string }
interface ExchangeResult extends ResetSession { session: { access_token: string; refresh_token: string } }
const invalidLink = 'This reset link is invalid, expired, or already used. Ask a System Administrator for a new link.'

export default function AdminPasswordResetPage() {
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('reset_token') || '')
  const [grant, setGrant] = useState<ResetSession | null>(null)
  const [factor, setFactor] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let active = true
    // Scrub the capability immediately; it is never persisted or put in query strings.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
    const restore = async () => {
      try {
        if (resetToken) { sessionStorage.removeItem(storageKey); return }
        const saved: Partial<ResetSession> | null = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
        const deadline = typeof saved?.expiresAt === 'string' ? Date.parse(saved.expiresAt) : NaN
        if (typeof saved?.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.requestId)
          || !Number.isFinite(deadline) || deadline <= Date.now()) {
          sessionStorage.removeItem(storageKey)
          throw new Error(invalidLink)
        }
        const client = requireSupabase()
        const { data } = await client.auth.getSession()
        if (!data.session) throw new Error(invalidLink)
        const { data: factors, error: factorError } = await client.auth.mfa.listFactors()
        if (factorError) throw factorError
        if (active) { setGrant({ requestId: saved.requestId, expiresAt: saved.expiresAt! }); setFactor(factors.totp.find(item => item.status === 'verified')?.id || null) }
      } catch { if (active) setError(invalidLink) }
      finally { if (active) setChecking(false) }
    }
    void restore()
    return () => { active = false }
    // Only restore on page mount; exchanging the token is an explicit user action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openReset = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const result = await adminPasswordReset<ExchangeResult>({ action: 'exchange', resetToken })
      const client = requireSupabase()
      const { error: sessionError } = await client.auth.setSession(result.session)
      if (sessionError) throw new Error(invalidLink)
      const saved = { requestId: result.requestId, expiresAt: result.expiresAt }
      // This contains only a request identifier and deadline, never the email token.
      sessionStorage.setItem(storageKey, JSON.stringify(saved))
      const { data, error: factorError } = await client.auth.mfa.listFactors()
      if (factorError) throw new Error('Could not check your authenticator. Refresh this page to try again.')
      setFactor(data.totp.find(item => item.status === 'verified')?.id || null)
      setGrant(saved); setResetToken('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : invalidLink) }
    finally { setBusy(false) }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !grant) return
    setError('')
    if (Date.parse(grant.expiresAt) <= Date.now()) { setError(invalidLink); setGrant(null); sessionStorage.removeItem(storageKey); return }
    const policyError = validatePermanentPassword(password)
    if (policyError) { setError(policyError); return }
    if (password !== confirmation) { setError('The passwords do not match.'); return }
    setBusy(true)
    try {
      const client = requireSupabase()
      if (factor) {
        const { error: mfaError } = await client.auth.mfa.challengeAndVerify({ factorId: factor, code })
        if (mfaError) throw new Error('Enter the current code from your enrolled authenticator.')
        setFactor(null); setCode('')
      }
      await adminPasswordReset({ action: 'complete', requestId: grant.requestId, newPassword: password }, true)
      sessionStorage.removeItem(storageKey)
      await client.auth.signOut({ scope: 'local' })
      setPassword(''); setConfirmation(''); setGrant(null); setSuccess(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update your password.') }
    finally { setBusy(false) }
  }

  return <main className="recovery-page employee-auth admin-reset-page">
    <section className="recovery-shell">
      <div className="recovery-brand"><img src={logoBlue} alt="Quantumn Art Resources" /><span>Administrator account security</span></div>
      <div className="recovery-card">
        <span className="portal-mark" aria-hidden="true">{success ? <CheckCircle2 /> : <LockKeyhole />}</span>
        <span className="portal-label">Administrator portal</span>
        <h1>{success ? 'Your password is updated' : grant ? 'Create a new password' : 'Secure password reset'}</h1>
        <p>{success ? 'Existing HRMS sessions have been revoked. Sign in again with your new password.' : 'Requested by a System Administrator. Your personal link works once and expires 30 minutes after the request.'}</p>
        {checking && <p role="status">Checking reset session…</p>}
        {error && <p className="rf-error" role="alert">{error}</p>}
        {!checking && resetToken && !grant && <button className="login-submit" type="button" onClick={() => void openReset()} disabled={busy}>{busy ? 'Verifying secure link…' : 'Continue securely'}</button>}
        {grant && <form className="admin-reset-form" onSubmit={submit} aria-busy={busy}>
          <p className="rf-help">Link valid until {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(grant.expiresAt))}.</p>
          {factor && <Field label="Authenticator code" help="Your existing authenticator is still required. Contact your System Administrator if you no longer have it.">{control => <input {...control} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />}</Field>}
          <Field label="New password" help="Use at least 15 characters and a unique passphrase.">{control => <input {...control} type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={event => setPassword(event.target.value)} required />}</Field>
          <Field label="Confirm new password">{control => <input {...control} type={visible ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required />}</Field>
          <button className="rf-toggle" type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? <EyeOff /> : <Eye />}{visible ? 'Hide passwords' : 'Show passwords'}</button>
          <button className="login-submit" disabled={busy}>{busy ? 'Updating password…' : 'Save new password'}</button>
        </form>}
        <div className="recovery-assurance"><ShieldCheck aria-hidden="true" /><span>No password is sent by email. Need a new link? Contact your System Administrator.</span></div>
        <Link className="recovery-back" to="/admin/login">Back to administrator sign in</Link>
      </div>
    </section>
  </main>
}
