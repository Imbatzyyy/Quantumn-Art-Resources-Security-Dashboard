import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, MailCheck, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useHrms } from '../state/useHrms.js'
import { EmailCodeError, emailCodeOperation, cancelEmailSignIn, type EmailCodeState } from '../services/supabaseEmailVerification.js'
import type { MfaChallenge, PortalKind } from '../types/hrms.js'
import logoBlue from '../../assets/images/mainlogo_blue.png'
import { readThemePreference } from '../utils/theme.js'
import './SignInVerificationPage.css'

export default function SignInVerificationPage({ portal }: { portal: PortalKind }) {
  const { completeEmailSignIn, verifyMfaLogin } = useHrms()
  const navigate = useNavigate()
  const initialRequest = useRef<Promise<EmailCodeState> | null>(null)
  const submitting = useRef(false)
  const [delivery, setDelivery] = useState<EmailCodeState | null>(null)
  const [mfa, setMfa] = useState<MfaChallenge | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [retryAt, setRetryAt] = useState<string | null>(null)
  const [restartRequired, setRestartRequired] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    document.documentElement.dataset.theme = readThemePreference()
    let active = true
    // Reuse the request across StrictMode effects; the server also deduplicates.
    initialRequest.current ??= emailCodeOperation(portal, 'send')
    initialRequest.current.then(result => { if (active) setDelivery(result) }).catch(reason => {
      if (!active) return
      setError(reason instanceof Error ? reason.message : 'We could not send your verification code. Please try again.')
      if (reason instanceof EmailCodeError) {
        setRetryAt(reason.retryAt ?? null)
        setRestartRequired([401, 409].includes(reason.status))
      }
    }).finally(() => { if (active) setBusy(false) })
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { active = false; window.clearInterval(timer) }
  }, [portal])

  const remaining = Math.max(0, Math.ceil((Math.max(Date.parse(retryAt || '') || 0, Date.parse(delivery?.resendAt || '') || 0) - now) / 1000))
  const expired = !!delivery?.expiresAt && Date.parse(delivery.expiresAt) <= now && !delivery.verified
  const reportError = (reason: unknown) => {
    setError(reason instanceof Error ? reason.message : 'Verification could not be completed. Please try again.')
    if (reason instanceof EmailCodeError) {
      setRetryAt(reason.retryAt ?? null)
      setRestartRequired([401, 409].includes(reason.status))
    }
  }
  const finish = async () => {
    if (!completeEmailSignIn) throw new Error('Email verification is unavailable. Please sign in again.')
    const result = await completeEmailSignIn(portal)
    if ('mfaRequired' in result) { setMfa(result); setCode(''); return }
    if ('emailVerificationRequired' in result) throw new Error('Verify your email before continuing.')
    navigate(`/${portal}`, { replace: true })
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current || busy) return
    submitting.current = true; setBusy(true); setError('')
    try {
      if (mfa) {
        await verifyMfaLogin({ factorId: mfa.factorId, code, portal })
        navigate(`/${portal}`, { replace: true })
      } else {
        if (!delivery?.verified) {
          if (!delivery?.challengeId) throw new Error('Request a verification code first.')
          const result = await emailCodeOperation(portal, 'verify', { code, challengeId: delivery.challengeId })
          setDelivery(result)
        }
        await finish()
      }
    } catch (reason) { reportError(reason) }
    finally { submitting.current = false; setBusy(false) }
  }
  const resend = async () => {
    if (submitting.current || busy || remaining) return
    submitting.current = true; setBusy(true); setError('')
    try {
      setDelivery(await emailCodeOperation(portal, 'resend'))
      setRetryAt(null); setCode('')
    } catch (reason) { reportError(reason) }
    finally { submitting.current = false; setBusy(false) }
  }
  const cancel = async () => {
    if (submitting.current || busy) return
    submitting.current = true; setBusy(true)
    try { await cancelEmailSignIn(); navigate(`/${portal}/login`, { replace: true }) }
    catch (reason) { reportError(reason) }
    finally { submitting.current = false; setBusy(false) }
  }

  return <main className={`signin-verification ${portal}-verification`}>
    <section className="verification-card" aria-labelledby="verification-title" aria-busy={busy}>
      <div className="verification-brand"><img src={logoBlue} alt="Quantumn Art Resources" /></div>
      <div className="verification-content">
        <div className="verification-icon" aria-hidden="true">{mfa ? <ShieldCheck size={26} /> : <MailCheck size={26} />}</div>
        <p className="verification-kicker">{portal === 'admin' ? 'Administrator' : 'Employee'} sign-in · Verification</p>
        <h1 id="verification-title">{mfa ? 'One more security check' : delivery?.verified ? 'Your email is verified' : 'Check your email'}</h1>
        <p className="verification-intro">{mfa ? 'Enter the six-digit code from your authenticator app to finish signing in.' : delivery?.verified ? 'Continue to complete your sign-in securely.' : delivery?.maskedEmail ? <>We sent a six-digit code to <strong>{delivery.maskedEmail}</strong>. Enter it below to open your workspace.</> : busy ? 'Sending a verification code to your account email…' : 'A verification code is needed before your workspace can open.'}</p>
        <form onSubmit={submit}>
          {(!delivery?.verified || mfa) && <div className="verification-field">
            <label htmlFor="signin-verification-code">{mfa ? 'Authenticator code' : 'Email verification code'}</label>
            <input id="signin-verification-code" name="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
              value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000" spellCheck={false} disabled={busy || restartRequired || (!mfa && !delivery?.challengeId)}
              aria-describedby="verification-help" aria-invalid={!!error} />
            <p id="verification-help">{mfa ? 'Use the current code from your enrolled authenticator.' : expired ? 'This code has expired. Request a new one below.' : 'Your code expires after 10 minutes. Never share it.'}</p>
          </div>}
          {error && <p className="verification-error" role="alert">{error}</p>}
          <button className="button button-primary verification-submit" type="submit" disabled={busy || restartRequired || (!delivery?.verified && (!delivery?.challengeId || expired)) || ((!delivery?.verified || !!mfa) && code.length !== 6)}>
            {busy ? 'Please wait…' : delivery?.verified && !mfa ? 'Continue to workspace' : 'Verify & continue'}<ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        {!mfa && !delivery?.verified && !restartRequired && <div className="verification-resend">
          <p>Can’t find it? Check your spam or junk folder.</p>
          <button type="button" onClick={resend} disabled={busy || remaining > 0}>Send a new code</button>
          {remaining > 0 && <small>Available in {remaining >= 60 ? `${Math.ceil(remaining / 60)} min` : `${remaining}s`}</small>}
        </div>}
        <button type="button" className="verification-back" disabled={busy} onClick={cancel}><ArrowLeft size={16} aria-hidden="true" />Cancel & return to sign in</button>
      </div>
      <footer><ShieldCheck size={17} aria-hidden="true" /><span>Your workspace stays locked until verification is complete.</span></footer>
    </section>
  </main>
}
