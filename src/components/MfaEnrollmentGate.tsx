import { useState, type FormEvent } from 'react'
import { beginMfaEnrollment, verifyMfaEnrollment } from '../services/supabaseAuth.js'
import { requireSupabase } from '../services/supabaseClient.js'
import type { MfaEnrollment } from '../types/hrms.js'

export default function MfaEnrollmentGate({ onComplete }: { onComplete: () => Promise<void> }) {
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [verified, setVerified] = useState(false)
  const start = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { setEnrollment(await beginMfaEnrollment()) }
    catch { setError('Authenticator setup could not start. Please try again.') }
    finally { setBusy(false) }
  }
  const verify = async (event: FormEvent) => {
    event.preventDefault()
    if (!enrollment || busy) return
    setBusy(true); setError('')
    try {
      if (!verified) {
        await verifyMfaEnrollment({ factorId: enrollment.factorId, code })
        setVerified(true)
      }
      const { data, error: problem } = await requireSupabase().rpc('create_mfa_recovery_codes')
      if (problem || !Array.isArray(data) || data.length !== 8 || !data.every(value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value))) throw new Error('Recovery codes could not be generated. Retry to finish safely.')
      setCodes(data as string[]); setCode(''); setEnrollment(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Verification failed. Try the current code from your authenticator.') }
    finally { setBusy(false) }
  }
  const finish = async () => {
    if (!saved || busy) return
    setBusy(true); setError('')
    try { await onComplete() }
    catch { setError('The workspace could not open. Try again; your saved codes remain valid.') }
    finally { setBusy(false) }
  }
  return <div className="mfa-required-setup" aria-busy={busy}>
    <h2>{codes ? 'Save your recovery codes' : 'Set up your authenticator'}</h2>
    <p>{codes ? 'Each code works once after your password and email verification. Store these privately in a password manager or offline. They are shown only now. Never send them to HR.' : 'Privileged access and recovered accounts require an authenticator. Your workspace stays locked until setup is complete.'}</p>
    {!enrollment && !codes && <button className="button button-primary" disabled={busy} onClick={() => void start()}>{busy ? 'Starting…' : 'Set up authenticator'}</button>}
    {enrollment && <form onSubmit={verify}>
      <img className="mfa-setup-qr" src={enrollment.qrCode} alt="Private authenticator setup QR code" />
      <p>Scan with your authenticator app, or enter this private setup key:</p><code className="mfa-setup-secret">{enrollment.secret}</code>
      <div className="verification-field"><label htmlFor="mfa-setup-code">Authenticator code</label><input id="mfa-setup-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required={!verified} /></div>
      <button className="button button-primary" disabled={busy || (!verified && code.length !== 6)}>{busy ? 'Verifying…' : verified ? 'Generate recovery codes' : 'Verify authenticator'}</button>
    </form>}
    {codes && <><pre className="mfa-recovery-codes" aria-label="Private single-use recovery codes">{codes.join('\n')}</pre><label className="account-policy-confirm"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /><span>I saved these recovery codes somewhere private.</span></label><button className="button button-primary" disabled={!saved || busy} onClick={() => void finish()}>{busy ? 'Opening workspace…' : 'Continue to workspace'}</button></>}
    {error && <p role="alert" className="verification-error">{error}</p>}
  </div>
}
